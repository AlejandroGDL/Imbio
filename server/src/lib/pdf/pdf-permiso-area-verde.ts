/**
 * PDF: Permiso de Uso de Espacio Público — Área Verde Municipal.
 *
 * Replica el formato oficial del PDF de referencia
 * (/Users/andro/Downloads/Permiso_AreaVerde_CC-AV-0006.pdf):
 *   - Header con logo a la izquierda + textos institucionales centrados
 *   - Título "PERMISO DE USO DE ESPACIO PÚBLICO" / "ÁREA VERDE MUNICIPAL" en verde
 *   - Folio "CC-AV-####" + fecha de emisión
 *   - Bloque de validación documental con QR a la izquierda y
 *     "VALIDACIÓN DOCUMENTAL" + texto a la derecha, todo dentro de
 *     un cuadro con borde
 *   - Párrafo de autorización
 *   - Bloque "DATOS DEL SOLICITANTE Y DEL EVENTO" como una TABLA
 *     con bordes y filas alternadas (gris claro / blanco). Cada fila
 *     puede ser de 1 columna [label | value] o 2 columnas
 *     [label1 | value1 | label2 | value2].
 *   - Bloque "CONDICIONES DE USO" (7 puntos fijos)
 *   - Bloque "OBSERVACIONES" (caja con borde)
 *   - "QUEDA POR CONFIRMAR FIRMA DE RESPONSABLE" + técnico
 *   - Frase legal larga
 *   - Firmas: director del IMBIO (con imagen) y "Responsable del evento"
 *   - Pie de página "1 / 1"
 *
 * Optimizado para caber en 1 página Letter.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// @ts-expect-error - pdfkit expone la clase via namespace PDFKit
import PDFKit from "pdfkit";
type PDFDocument = PDFKit.PDFDocument;

// =================================================================
// Assets (logo y firma)
// =================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.join(__dirname, "assets");
const LOGO_PATH = path.join(ASSETS_DIR, "logo_ayuntamiento.png");
const FIRMA_PATH = path.join(ASSETS_DIR, "firma_director_imbio.png");

// =================================================================
// Constantes de layout (Letter, márgenes ~ 0.7")
// =================================================================
const PAGE = {
  width: 612,
  height: 792,
  marginX: 50,
  marginTop: 24,
  marginBottom: 18,
};
const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;
const SAFE_BOTTOM = PAGE.height - PAGE.marginBottom; // 774

const COLORS = {
  // Verde institucional (similar al de la referencia)
  primary: "#1f6e3e",
  primaryDark: "#1a5a32",
  text: "#0f172a",
  muted: "#475569",
  border: "#cbd5e1",
  borderLight: "#e2e8f0",
  rowAlt: "#f1f5f9", // gris claro de filas alternadas
  rowWhite: "#ffffff",
  tableHeader: "#1f6e3e",
  white: "#ffffff",
};

const FONT = {
  title: 14,
  h1: 12,
  body: 10,
  bodyMuted: 9,
  small: 8.5,
  cell: 10,
};

// =================================================================
// Tipos
// =================================================================
export interface PermisoAreaVerdeData {
  /** Folio del permiso (ej. "CC-AV-0006") */
  folio: string;
  /** Fecha de emisión */
  fechaEmision: Date;
  /** Cadena de seguridad (para el QR) */
  cadena: string;
  /** Datos del solicitante y del evento */
  areaVerde: string;
  ubicacion: string;
  usuario: string;
  tipoEvento: string;
  fecha: Date;
  horaInicio: string;
  horaFin: string;
  horaMontaje: string;
  horaDesmontaje: string;
  telefono?: string | null;
  responsable: string;
  observaciones?: string | null;
  /** Técnico que emitió el permiso (si existe) */
  emitidoPor?: { nombre: string; cargo?: string | null } | null;
  /** Director del IMBIO (para firma) */
  directorNombre: string;
  /** QR de validación (PNG) */
  qrBuffer?: Buffer;
}

// =================================================================
// Helpers
// =================================================================

function stringVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/** Formato es-MX: DD/MM/YYYY. */
function fmtDate(s: unknown): string {
  if (s instanceof Date) {
    if (isNaN(s.getTime())) return "";
    return s.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }
  if (typeof s === "string") {
    if (s.includes("T")) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("es-MX", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s + "T00:00:00");
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("es-MX", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
      }
    }
  }
  return "";
}

/** Formato largo: "24 días del mes de agosto de 2026". */
function fmtFechaLarga(d: Date): string {
  if (isNaN(d.getTime())) return "";
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${d.getDate()} días del mes de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

// =================================================================
// Condiciones de uso (texto fijo del PDF de referencia)
// =================================================================
const CONDICIONES_USO: string[] = [
  "El uso del espacio queda limitado estrictamente al horario autorizado en el presente permiso.",
  "Queda prohibido dañar árboles, jardinería, mobiliario urbano e infraestructura del área verde.",
  "El responsable deberá retirar toda la basura generada y dejar el área limpia al término del evento.",
  "Se deberán respetar los niveles de ruido permitidos por la normatividad municipal.",
  "Queda prohibida la introducción, consumo y/o venta de bebidas alcohólicas sin autorización expresa del H. Ayuntamiento.",
  "El responsable responderá por cualquier daño al patrimonio municipal derivado del evento.",
  "El incumplimiento de estas condiciones facultará al IMBIO a suspender el evento de forma inmediata.",
];

// =================================================================
// Helpers de layout — tabla con bordes
// =================================================================

interface Cell {
  text: string;
  isLabel?: boolean;
  /** Peso de la celda (default 1). Suma de pesos = ancho del row. */
  weight?: number;
}

interface Row {
  cells: Cell[];
  /** Alto de la fila (default = 14). */
  height?: number;
}

interface TableOptions {
  x: number;
  y: number;
  width: number;
  rows: Row[];
  /** Si true, dibuja un borde exterior grueso alrededor de toda la tabla. */
  border?: boolean;
}

/**
 * Dibuja una tabla simple con celdas y bordes. Cada celda tiene
 * un fondo alternado (gris/blanco) según la fila.
 *
 * NO avanza el cursor: devuelve la posición Y después de la última
 * fila dibujada.
 */
function drawTable(doc: PDFDocument, opts: TableOptions): number {
  const { x, y, width, rows, border = true } = opts;
  let cursorY = y;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const rowH = row.height ?? 19;
    const totalWeight = row.cells.reduce(
      (s, c) => s + (c.weight ?? 1),
      0,
    );
    const isAlt = r % 2 === 1; // filas alternadas (1, 3, 5...)
    const rowFill = isAlt ? COLORS.rowAlt : COLORS.rowWhite;

    // Fondo de la fila (toda la fila)
    doc.save();
    doc.rect(x, cursorY, width, rowH).fillColor(rowFill).fill();
    doc.restore();

    // Texto de cada celda
    let cellX = x;
    for (let c = 0; c < row.cells.length; c++) {
      const cell = row.cells[c];
      const cellW = (width * (cell.weight ?? 1)) / totalWeight;
      const textColor = cell.isLabel ? COLORS.muted : COLORS.text;
      const fontName = cell.isLabel ? "Helvetica" : "Helvetica";
      const padX = 6;
      const padY = 5;
      doc
        .font(fontName)
        .fontSize(FONT.cell)
        .fillColor(textColor)
        .text(
          cell.text,
          cellX + padX,
          cursorY + padY,
          {
            width: cellW - padX * 2,
            lineBreak: false,
            ellipsis: true,
          },
        );
      cellX += cellW;
    }

    // Línea separadora horizontal debajo de la fila (excepto la última
    // si no se quiere borde inferior)
    doc.save();
    doc
      .strokeColor(COLORS.borderLight)
      .lineWidth(0.5)
      .moveTo(x, cursorY + rowH)
      .lineTo(x + width, cursorY + rowH)
      .stroke();
    doc.restore();

    cursorY += rowH;
  }

  if (border) {
    // Borde exterior de la tabla
    doc.save();
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.8)
      .rect(x, y, width, cursorY - y)
      .stroke();
    doc.restore();
  }

  return cursorY;
}

// =================================================================
// Builder principal
// =================================================================

export function buildPermisoAreaVerde(
  doc: PDFDocument,
  data: PermisoAreaVerdeData,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      // =============================================================
      // HEADER (logo a la izquierda + textos centrados a la derecha)
      // =============================================================
      let headerY = PAGE.marginTop;

      if (fs.existsSync(LOGO_PATH)) {
        const logoW = 70;
        const logoH = 36;
        doc.image(LOGO_PATH, PAGE.marginX, headerY, {
          width: logoW,
          height: logoH,
        });
      }

      // Textos institucionales centrados en el ancho completo
      const txtX = PAGE.marginX;
      const txtW = CONTENT_WIDTH;
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(COLORS.primary)
        .text(
          "H. Ayuntamiento de Pabellón de Arteaga 2024-2027",
          txtX,
          headerY,
          { width: txtW, align: "center", lineBreak: false },
        );
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(COLORS.primary)
        .text(
          "Instituto Municipal de Biodiversidad y Protección Ambiental (IMBIO)",
          txtX,
          headerY + 12,
          { width: txtW, align: "center", lineBreak: false },
        );
      headerY += 32;

      // ----- TÍTULO en verde -----
      doc
        .font("Helvetica-Bold")
        .fontSize(FONT.title)
        .fillColor(COLORS.primary)
        .text(
          "PERMISO DE USO DE ESPACIO PÚBLICO",
          txtX,
          headerY,
          { width: txtW, align: "center", lineBreak: false },
        );
      doc
        .font("Helvetica-Bold")
        .fontSize(FONT.title)
        .fillColor(COLORS.primary)
        .text(
          "ÁREA VERDE MUNICIPAL",
          txtX,
          headerY + 14,
          { width: txtW, align: "center", lineBreak: false },
        );
      headerY += 30;

      // ----- Folio + Emisión -----
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(COLORS.muted)
        .text(
          `Folio: ${data.folio}  |  Emisión: ${fmtDate(data.fechaEmision) || "—"}`,
          txtX,
          headerY,
          { width: txtW, align: "center", lineBreak: false },
        );
      headerY += 16;

      // =============================================================
      // VALIDACIÓN DOCUMENTAL — bloque con QR a la izquierda
      // =============================================================
      const validX = PAGE.marginX;
      const validW = CONTENT_WIDTH;
      const qrSize = 56;
      const validH = qrSize + 8; // 64
      const validY = headerY;

      // Borde exterior del bloque
      doc.save();
      doc
        .strokeColor(COLORS.border)
        .lineWidth(0.8)
        .rect(validX, validY, validW, validH)
        .stroke();
      doc.restore();

      // QR a la izquierda dentro del bloque
      if (data.qrBuffer) {
        doc.image(data.qrBuffer, validX + 4, validY + 4, {
          width: qrSize,
          height: qrSize,
        });
      }

      // Texto a la derecha del QR
      const txtValidX = validX + qrSize + 12;
      const txtValidW = validW - qrSize - 16;
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.primary)
        .text("VALIDACIÓN DOCUMENTAL", txtValidX, validY + 6, {
          width: txtValidW,
          lineBreak: false,
        });
      doc
        .font("Helvetica")
        .fontSize(FONT.small)
        .fillColor(COLORS.muted)
        .text(
          "Escanee el código QR para verificar la autenticidad de este permiso oficial.",
          txtValidX,
          validY + 19,
          { width: txtValidW, lineBreak: false },
        );
      doc
        .font("Helvetica-Bold")
        .fontSize(FONT.small)
        .fillColor(COLORS.text)
        .text(
          "Cadena de seguridad:",
          txtValidX,
          validY + 33,
          { width: 90, lineBreak: false },
        );
      doc
        .font("Helvetica")
        .fontSize(FONT.small)
        .fillColor(COLORS.muted)
        .text(
          data.cadena,
          txtValidX + 92,
          validY + 33,
          { width: txtValidW - 92, lineBreak: false },
        );

      // =============================================================
      // PÁRRAFO DE AUTORIZACIÓN
      // =============================================================
      // Bloque con "AUTORIZA" en negrita inline usando `continued: true`
      // para mantener todo en una sola línea justificada.
      let y = validY + validH + 12;
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.text)
        .text(
          "El Instituto Municipal de Biodiversidad y Protección Ambiental (IMBIO), en el ámbito de sus atribuciones, ",
          PAGE.marginX,
          y,
          { width: CONTENT_WIDTH, continued: true, align: "justify" },
        );
      doc
        .font("Helvetica-Bold")
        .fillColor(COLORS.primary)
        .text("AUTORIZA ", { continued: true });
      doc
        .font("Helvetica")
        .fillColor(COLORS.text)
        .text(
          "el uso del espacio público descrito a continuación, sujeto a las condiciones y horarios del presente permiso.",
          { width: CONTENT_WIDTH, align: "justify" },
        );
      y = doc.y + 14;

      // =============================================================
      // TÍTULO DE SECCIÓN: DATOS DEL SOLICITANTE Y DEL EVENTO
      // =============================================================
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(COLORS.primary)
        .text("DATOS DEL SOLICITANTE Y DEL EVENTO", PAGE.marginX, y);
      y = doc.y + 5;

      // ----- Tabla con los datos del evento -----
      const tableX = PAGE.marginX;
      const tableW = CONTENT_WIDTH;
      const tableRows: Row[] = [
        // Fila 1: Área verde | Ubicación
        {
          cells: [
            { text: "Área verde", isLabel: true, weight: 1 },
            { text: data.areaVerde || "(Área verde)", weight: 1.2 },
            { text: "Ubicación", isLabel: true, weight: 1 },
            { text: data.ubicacion || "(Ubicación)", weight: 1.5 },
          ],
        },
        // Fila 2: Solicitante (ancho completo)
        {
          cells: [
            { text: "Solicitante", isLabel: true, weight: 1 },
            { text: data.usuario || "(Usuario/Institución)", weight: 3.5 },
          ],
        },
        // Fila 3: Tipo de evento | Fecha
        {
          cells: [
            { text: "Tipo de evento", isLabel: true, weight: 1 },
            { text: data.tipoEvento || "(Tipo de evento)", weight: 1.2 },
            { text: "Fecha", isLabel: true, weight: 1 },
            { text: fmtDate(data.fecha) || "(Fecha)", weight: 1.2 },
          ],
        },
        // Fila 4: Horario
        {
          cells: [
            { text: "Horario", isLabel: true, weight: 1 },
            {
              text: `${data.horaInicio || "00:00"} a ${data.horaFin || "00:00"} horas`,
              weight: 3.5,
            },
          ],
        },
        // Fila 5: Montaje | Desmontaje
        {
          cells: [
            { text: "Montaje", isLabel: true, weight: 1 },
            { text: data.horaMontaje || "00:00", weight: 1.2 },
            { text: "Desmontaje", isLabel: true, weight: 1 },
            {
              text: data.horaDesmontaje || "00:00",
              weight: 1.5,
            },
          ],
        },
        // Fila 6: Teléfono
        {
          cells: [
            { text: "Teléfono", isLabel: true, weight: 1 },
            {
              text: stringVal(data.telefono) || "(Teléfono)",
              weight: 3.5,
            },
          ],
        },
        // Fila 7: Responsable
        {
          cells: [
            { text: "Responsable", isLabel: true, weight: 1 },
            { text: data.responsable || "(Responsable)", weight: 3.5 },
          ],
        },
      ];
      y = drawTable(doc, {
        x: tableX,
        y,
        width: tableW,
        rows: tableRows,
        border: true,
      });
      y += 12;

      // =============================================================
      // CONDICIONES DE USO
      // =============================================================
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(COLORS.primary)
        .text("CONDICIONES DE USO", PAGE.marginX, y);
      y = doc.y + 5;
      for (let i = 0; i < CONDICIONES_USO.length; i++) {
        doc
          .font("Helvetica")
          .fontSize(FONT.body)
          .fillColor(COLORS.text)
          .text(`${i + 1}. ${CONDICIONES_USO[i]}`, PAGE.marginX, y, {
            width: CONTENT_WIDTH,
            align: "justify",
            lineBreak: false,
          });
        y = doc.y + 2;
      }
      y += 8;

      // =============================================================
      // OBSERVACIONES
      // =============================================================
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(COLORS.primary)
        .text("OBSERVACIONES", PAGE.marginX, y);
      y = doc.y + 5;

      // Caja de observaciones
      const obsText = data.observaciones?.trim() || "—";
      const obsH = 16;
      // Una sola línea visible; si el texto es largo, se ajusta
      doc.save();
      doc
        .strokeColor(COLORS.border)
        .lineWidth(0.8)
        .rect(PAGE.marginX, y, CONTENT_WIDTH, obsH)
        .stroke();
      doc.restore();
      doc
        .font("Helvetica")
        .fontSize(FONT.body)
        .fillColor(COLORS.text)
        .text(obsText, PAGE.marginX + 4, y + 3, {
          width: CONTENT_WIDTH - 8,
          lineBreak: false,
          ellipsis: true,
        });
      y += obsH + 4;

      // (Eliminado: "QUEDA POR CONFIRMAR FIRMA DE RESPONSABLE" y
      // "Técnico Operativo que emitió el permiso" — el usuario
      // pidió quitarlos del PDF.)

      // =============================================================
      // FIRMAS — pie de página
      // =============================================================
      // Si ya casi no queda espacio, ajustamos
      const firmaY = Math.max(y, SAFE_BOTTOM - 70);

      // Frase legal
      doc
        .font("Helvetica-Oblique")
        .fontSize(FONT.small)
        .fillColor(COLORS.muted)
        .text(
          `Se expide el presente permiso en Pabellón de Arteaga, Aguascalientes, a los ${fmtFechaLarga(data.fechaEmision)}.`,
          PAGE.marginX,
          firmaY,
          { width: CONTENT_WIDTH, align: "center", lineBreak: false },
        );
      const fraseY = firmaY + 10;

      // Línea base de firmas
      const sigLineY = fraseY + 24;

      // Mitad izquierda: responsable del evento
      const halfW = CONTENT_WIDTH / 2 - 6;
      const leftX = PAGE.marginX;
      const rightX = PAGE.marginX + CONTENT_WIDTH / 2 + 6;
      // (sin imagen, solo línea + texto)
      doc.save();
      doc
        .strokeColor(COLORS.text)
        .lineWidth(0.8)
        .moveTo(leftX, sigLineY)
        .lineTo(leftX + halfW, sigLineY)
        .stroke();
      doc.restore();
      doc
        .font("Helvetica-Bold")
        .fontSize(FONT.body)
        .fillColor(COLORS.text)
        .text("Responsable del evento", leftX, sigLineY + 2, {
          width: halfW,
          align: "center",
          lineBreak: false,
        });
      doc
        .font("Helvetica")
        .fontSize(FONT.small)
        .fillColor(COLORS.muted)
        .text(data.responsable || "(Responsable)", leftX, sigLineY + 12, {
          width: halfW,
          align: "center",
          lineBreak: false,
        });

      // Mitad derecha: director del IMBIO
      const firmaImgW = 90;
      const firmaImgH = 26;
      const firmaImgX = rightX + (halfW - firmaImgW) / 2;
      const firmaImgY = sigLineY - firmaImgH + 2;
      if (fs.existsSync(FIRMA_PATH)) {
        doc.save();
        doc.image(FIRMA_PATH, firmaImgX, firmaImgY, {
          width: firmaImgW,
          height: firmaImgH,
        });
        doc.restore();
      }
      doc.save();
      doc
        .strokeColor(COLORS.text)
        .lineWidth(0.8)
        .moveTo(rightX, sigLineY)
        .lineTo(rightX + halfW, sigLineY)
        .stroke();
      doc.restore();
      doc
        .font("Helvetica-Bold")
        .fontSize(FONT.body)
        .fillColor(COLORS.text)
        .text(data.directorNombre, rightX, sigLineY + 2, {
          width: halfW,
          align: "center",
          lineBreak: false,
        });
      doc
        .font("Helvetica")
        .fontSize(6.5)
        .fillColor(COLORS.muted)
        .text(
          "Director del Instituto Municipal de Biodiversidad y Protección Ambiental (IMBIO)",
          rightX,
          sigLineY + 12,
          { width: halfW, align: "center", lineBreak: true },
        );

      // Pie de página "1 / 1" — siempre al final, dentro del safe area
      const footerY = SAFE_BOTTOM - 10;
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text("1 / 1", PAGE.marginX, footerY, {
          width: CONTENT_WIDTH,
          align: "center",
          lineBreak: false,
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
