/**
 * PDF de autorización: Permiso de Traslado de Leña.
 *
 * Replica el formato oficial del PDF de referencia del IMBIO:
 *   - Header centrado con logo del H. Ayuntamiento + texto institucional
 *   - Subtítulo italic ("Comprobante de legal procedencia...")
 *   - Título en bold
 *   - 6 secciones con títulos en color azul
 *   - Label bold negro + valor regular
 *   - Bloque de firma con la imagen del director + "Técnico Operativo
 *     que emitió la Autorización"
 *
 * Optimizado para caber en 1 sola página Letter.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// @ts-expect-error - pdfkit expone la clase via namespace PDFKit; TS6133
// no detecta que PDFKit.PDFDocument usa el símbolo importado.
import PDFKit from "pdfkit";
type PDFDocument = PDFKit.PDFDocument;

import type { PdfContext } from "./common";

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
  marginTop: 40,
  marginBottom: 40,
};
const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;

// Colores (paleta del escudo / institucional)
const COLORS = {
  primary: "#1e1b4b", // azul-marino institucional
  text: "#0f172a",
  muted: "#475569",
  border: "#cbd5e1",
  section: "#0f172a", // títulos de sección en negro
};

// =================================================================
// Helpers
// =================================================================

/**
 * Labels que el usuario pidió quitar de negrita para igualar el
 * estilo de la referencia. Por defecto todos los labels se pintan
 * en Helvetica-Bold; los que estén en este Set se pintan en
 * Helvetica regular.
 */
const LABELS_SIN_NEGRITA: ReadonlySet<string> = new Set([
  "Nombre del responsable:",
  "Identificación del vehículo:",
  "Origen (punto de carga):",
  "Destino (entrega o almacenamiento final):",
  "Estado del material:",
  "Volumen o peso:",
  "Especie (nombre común):",
  "Referencia de origen:",
  "Causal de generación:",
  "Libre de plagas:",
  "Fecha y hora de emisión:",
]);

/** Render de "label: valor" en una línea, con label bold o regular según el set. */
function kvRow(doc: PDFDocument, label: string, value: string) {
  const labelFont = LABELS_SIN_NEGRITA.has(label) ? "Helvetica" : "Helvetica-Bold";
  doc
    .font(labelFont)
    .fontSize(9.5)
    .fillColor(COLORS.text)
    .text(label, PAGE.marginX, doc.y, {
      lineBreak: false,
      continued: true,
    });
  doc
    .font("Helvetica")
    .fillColor(COLORS.text)
    .text(` ${value || "—"}`, {
      width: CONTENT_WIDTH,
    });
  doc.moveDown(0.1);
}

function stringVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/** Formatea fecha con hora, ej "20/07/2026 09:30". */
function fmtDateTime(s: unknown): string {
  if (s instanceof Date) {
    if (isNaN(s.getTime())) return "";
    return formatDMYHm(s);
  }
  if (typeof s === "string") {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return formatDMYHm(d);
    }
  }
  return "";
}

/** Devuelve un Date parseando Date|string, o null. */
function parseDateLike(s: unknown): Date | null {
  if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
  if (typeof s === "string") {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatDMYHm(d: Date): string {
  const date = d.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const time = d.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} ${time}`;
}

// =================================================================
// Builder principal
// =================================================================

export function buildPermisoTrasladoLena(
  doc: PDFDocument,
  ctx: PdfContext,
  qrBuffer?: Buffer,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      const d = ctx.solicitud.datos as Record<string, unknown>;
      const fechaEmision = fmtDateTime(ctx.autorizacion.fechaEmision);
      const folioAut = ctx.autorizacion.numeroAutorizacion;
      const cadena = `IMBIO-AUT-${folioAut}-${ctx.autorizacion.id ?? "x"}`;

      // -------------------------------------------------------------
      // HEADER: logo centrado + texto institucional
      // -------------------------------------------------------------
      doc.y = PAGE.marginTop;

      if (fs.existsSync(LOGO_PATH)) {
        const logoW = 120;
        const logoH = 62;
        const logoX = (PAGE.width - logoW) / 2;
        doc.image(LOGO_PATH, logoX, doc.y, { width: logoW, height: logoH });
        doc.y += logoH + 4;
      } else {
        doc.y += 30;
      }

      doc
        .fillColor(COLORS.primary)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(
          "H. Ayuntamiento del Municipio de Pabellón de Arteaga 2024-2027",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );
      doc.moveDown(0.2);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(COLORS.primary)
        .text(
          "Instituto Municipal de Biodiversidad y Protección Ambiental (IMBIO)",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );

      // Subtítulo italic (encima del título, como en la referencia)
      doc.moveDown(0.3);
      doc
        .font("Helvetica-Oblique")
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(
          "Comprobante de legal procedencia para el transporte. Atribuciones del IMBIO y criterios de manejo forestal en zonas no forestales.",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );

      // Título
      doc.moveDown(0.4);
      doc
        .fillColor(COLORS.primary)
        .font("Helvetica-Bold")
        .fontSize(13)
        .text(
          "AUTORIZACIÓN DE TRASLADO DE LEÑA SECA",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );
      doc.moveDown(0.2);

      // Folio + Fecha (con hora)
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(
          `Folio: ${folioAut}  |  Fecha de emisión: ${fechaEmision}`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );
      doc.moveDown(0.5);

      // -------------------------------------------------------------
      // 1. Datos del titular y del vehículo
      // -------------------------------------------------------------
      sectionTitle(doc, "1. Datos del titular y del vehículo");
      kvRow(doc, "Nombre del responsable:", stringVal(d.nombreResponsable));

      // Identificación del vehículo: Tipo: , Marca: , Modelo: , Color: , Placas:
      const tipo = stringVal(d.tipoVehiculo);
      const marca = stringVal(d.marca);
      const modelo = stringVal(d.modelo);
      const color = stringVal(d.color);
      const placas = stringVal(d.placas);
      kvRow(
        doc,
        "Identificación del vehículo:",
        `Tipo: ${tipo || "—"}, Marca: ${marca || "—"}, Modelo: ${modelo || "—"}, Color: ${color || "—"}, Placas: ${placas || "—"}`,
      );

      kvRow(doc, "Origen (punto de carga):", stringVal(d.origen));
      kvRow(doc, "Destino (entrega o almacenamiento final):", stringVal(d.destino));

      // -------------------------------------------------------------
      // 2. Especificaciones del producto (leña)
      // -------------------------------------------------------------
      sectionTitle(doc, "2. Especificaciones del producto (leña)");
      // Estado del material: <estado> (descripción)
      const estado = stringVal(d.estadoMaterial);
      let estadoTexto: string;
      switch (estado) {
        case "Verde":
          estadoTexto = `${estado} (madera recién cortada). Requiere permiso de derribo vigente.`;
          break;
        case "Seco":
          estadoTexto = `${estado} (madera muerta o subproducto de podas/derribos autorizados).`;
          break;
        case "Mixto":
          estadoTexto = `${estado} (combinación de leña seca y verde). El componente verde requiere permiso de derribo.`;
          break;
        default:
          estadoTexto = "— (madera muerta o subproducto de podas/derribos autorizados).";
      }
      kvRow(doc, "Estado del material:", estadoTexto);
      kvRow(doc, "Volumen o peso:", stringVal(d.volumenPeso));

      // Especie (nombre común): — para verificar que no se trate de especies protegidas sin manejo especial.
      const especie = stringVal(d.especie);
      kvRow(
        doc,
        "Especie (nombre común):",
        `${especie || "—"} para verificar que no se trate de especies protegidas sin manejo especial.`,
      );

      // -------------------------------------------------------------
      // 3. Sustento de procedencia
      // -------------------------------------------------------------
      sectionTitle(doc, "3. Sustento de procedencia");
      kvRow(doc, "Referencia de origen:", stringVal(d.referenciaOrigen));
      kvRow(doc, "Causal de generación:", stringVal(d.causalGeneracion));

      // -------------------------------------------------------------
      // 4. Condicionantes para el traslado
      // -------------------------------------------------------------
      sectionTitle(doc, "4. Condicionantes para el traslado");

      // Calculamos la vigencia concreta: desde fechaEmision hasta
      // fechaEmision + 24 horas. Mostramos fecha + hora de inicio y
      // fin en formato "DD/MM/YYYY HH:mm" para que quede claro cuándo
      // empieza y cuándo vence.
      const inicio = parseDateLike(ctx.autorizacion.fechaEmision);
      const fin = inicio ? new Date(inicio.getTime() + 24 * 60 * 60 * 1000) : null;
      const fechaInicio = fmtDateTime(inicio);
      const fechaFin = fmtDateTime(fin);

      // Párrafo inicial con vigencia concreta
      if (fechaInicio && fechaFin) {
        doc
          .font("Helvetica")
          .fontSize(9.5)
          .fillColor(COLORS.text)
          .text(
            `Esta autorización tiene una vigencia de 24 horas, desde el ${fechaInicio} hasta el ${fechaFin}. En caso de vencimiento, el titular deberá tramitar una nueva autorización para realizar el traslado.`,
            PAGE.marginX,
            doc.y,
            { width: CONTENT_WIDTH, align: "justify" },
          );
      } else {
        // Fallback si no hay fechaEmision (no debería pasar)
        doc
          .font("Helvetica")
          .fontSize(9.5)
          .fillColor(COLORS.text)
          .text(
            "Esta autorización tiene una vigencia temporal de 24 horas a partir de la fecha y hora de expedición. En caso de vencimiento, el titular deberá tramitar una nueva autorización para realizar el traslado.",
            PAGE.marginX,
            doc.y,
            { width: CONTENT_WIDTH, align: "justify" },
          );
      }
      doc.moveDown(0.15);

      // Ruta definida: <ruta> (REMAIN BOLD)
      const ruta = stringVal(d.rutaDefinida);
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Ruta definida: `,
          PAGE.marginX,
          doc.y,
          { continued: true, width: CONTENT_WIDTH },
        );
      doc
        .font("Helvetica")
        .fillColor(COLORS.text)
        .text(ruta || "Ruta", { width: CONTENT_WIDTH });
      doc.moveDown(0.15);

      // Párrafo sobre portar el documento
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          "El conductor está obligado a portar el documento original en todo momento y mostrarlo a las autoridades de Seguridad Pública o inspectores del IMBIO si se lo solicita.",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.15);

      // Uso del material: <texto fijo> (REMAIN BOLD)
      const uso = stringVal(d.usoMaterial);
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Uso del material: `,
          PAGE.marginX,
          doc.y,
          { continued: true, width: CONTENT_WIDTH },
        );
      doc
        .font("Helvetica")
        .fillColor(COLORS.text)
        .text(
          `${uso || "Se declara que la leña es para uso doméstico o industrial (ladrilleras), siempre que cumpla con los combustibles permitidos en la norma de emisiones."}`,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.15);

      // Prohibición de mezcla: <texto fijo> (REMAIN BOLD)
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Prohibición de mezcla: `,
          PAGE.marginX,
          doc.y,
          { continued: true, width: CONTENT_WIDTH },
        );
      doc
        .font("Helvetica")
        .fillColor(COLORS.text)
        .text(
          "No se permite transportar leña verde o trocería de árboles recién cortados si no están amparados en el permiso de derribo correspondiente.",
          { width: CONTENT_WIDTH, align: "justify" },
        );

      // -------------------------------------------------------------
      // 5. Medidas sanitarias
      // -------------------------------------------------------------
      sectionTitle(doc, "5. Medidas sanitarias");
      kvRow(
        doc,
        "Libre de plagas:",
        "La leña ha sido inspeccionada visualmente y no presenta evidencia de insectos barrenadores o muérdago vivo que pueda propagarse durante el transporte.",
      );

      // -------------------------------------------------------------
      // 6. Validación administrativa
      // -------------------------------------------------------------
      sectionTitle(doc, "6. Validación administrativa");
      kvRow(doc, "Fecha y hora de emisión:", fechaEmision);

      // -------------------------------------------------------------
      // LÍNEA SEPARADORA (antes del bloque de firma)
      // -------------------------------------------------------------
      doc.moveDown(0.4);
      doc
        .save()
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .moveTo(PAGE.marginX, doc.y)
        .lineTo(PAGE.width - PAGE.marginX, doc.y)
        .stroke()
        .restore();
      doc.y += 12;

      // -------------------------------------------------------------
      // BLOQUE DE FIRMA
      // -------------------------------------------------------------
      const firmaY = doc.y;
      const firmaW = 140;
      const firmaH = 60;
      const firmaX = (PAGE.width - firmaW) / 2;
      if (fs.existsSync(FIRMA_PATH)) {
        doc.image(FIRMA_PATH, firmaX, firmaY, {
          width: firmaW,
          height: firmaH,
        });
      }
      doc.y = firmaY + firmaH + 2;
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          "BIÓL. LUIS FELIPE LOZANO ROMÁN",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(COLORS.muted)
        .text(
          "Director del IMBIO",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );
      doc.moveDown(0.3);

      // Técnico Operativo
      const tecnico =
        stringVal(ctx.autorizacion.emitidoPor?.nombre) ||
        stringVal(d.nombreTecnicoAutoriza);
      // Imprimimos label (bold) + valor (regular) centrados como una sola línea visual.
      const labelTecnico = "Técnico Operativo que emitió la Autorización: ";
      const valueTecnico = tecnico || "____________________";
      // Etiqueta centrada (sin width para que pdfkit posicione por sí solo)
      const tw = doc.font("Helvetica-Bold").fontSize(8.5).widthOfString(labelTecnico + valueTecnico);
      const startX = (PAGE.width - tw) / 2;
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(COLORS.text)
        .text(labelTecnico, startX, doc.y, { lineBreak: false, continued: true });
      doc
        .font("Helvetica")
        .fillColor(COLORS.text)
        .text(valueTecnico, { lineBreak: false });

      // -------------------------------------------------------------
      // FOOTER (síncrono): QR + cadena de seguridad.
      // -------------------------------------------------------------
      const qrSize = 50;
      const qrX = PAGE.width - PAGE.marginX - qrSize;
      const qrY = PAGE.height - PAGE.marginBottom - qrSize - 24;
      if (qrBuffer) {
        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      }

      // "1 / 1" arriba del QR
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text("1 / 1", qrX, qrY - 12, {
          width: qrSize,
          align: "right",
        });

      // Cadena de seguridad a la izquierda del QR
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(COLORS.muted)
        .text(
          `Código QR de validación — Cadena de seguridad: ${cadena}`,
          PAGE.marginX,
          qrY + 18,
          { width: CONTENT_WIDTH - qrSize - 8, align: "left" },
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// =================================================================
// Helpers internos de layout
// =================================================================

/** Título de sección numerado, en color azul. */
function sectionTitle(doc: PDFDocument, title: string) {
  doc.moveDown(0.3);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.section)
    .text(title, PAGE.marginX, doc.y);
  doc.moveDown(0.1);
}
