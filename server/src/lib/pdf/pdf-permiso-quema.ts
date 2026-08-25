/**
 * PDF de autorización: Permiso de Quema de Horno Ladrillera.
 *
 * Replica el formato oficial del PDF de referencia del IMBIO:
 *   - Header centrado con logo del H. Ayuntamiento + texto institucional
 *   - 7 secciones numeradas con placeholders para los datos
 *   - Bloque de firma con la imagen del director + QR de validación
 *
 * Los placeholders (entre paréntesis) se reemplazan con los datos del
 * formulario cuando existen. Si un campo no fue rellenado, el paréntesis
 * queda vacío (no se imprime "undefined" ni nada raro).
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
// En ESM no existe __dirname, así que derivamos la ruta del módulo actual.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.join(__dirname, "assets");
const LOGO_PATH = path.join(ASSETS_DIR, "logo_ayuntamiento.png");
const FIRMA_PATH = path.join(ASSETS_DIR, "firma_director_imbio.png");

// =================================================================
// Constantes de layout (Letter, márgenes ~ 0.6")
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
};

// =================================================================
// Helpers
// =================================================================

/**
 * Formatea una fecha. Acepta:
 *   - string YYYY-MM-DD (formato de input del formulario)
 *   - Date object (de Prisma, ej. autorizacion.fechaEmision)
 * Devuelve string en formato DD/MM/YYYY o "" si no se puede parsear.
 */
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
    // Si ya viene en formato ISO completo (con T), parsear con Date
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
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
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString("es-MX", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    }
  }
  return "";
}

/** Devuelve el string o vacío si es null/undefined/vacío. */
function stringVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

// =================================================================
// Builder principal
// =================================================================

export function buildPermisoQuema(
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
      const fechaEmision = fmtDate(ctx.autorizacion.fechaEmision);
      const folioAut = ctx.autorizacion.numeroAutorizacion;
      const cadena = `IMBIO-AUT-${folioAut}-${ctx.autorizacion.id ?? "x"}`;

      // -------------------------------------------------------------
      // HEADER: logo centrado + texto institucional centrado debajo
      // -------------------------------------------------------------
      doc.y = PAGE.marginTop;

      if (fs.existsSync(LOGO_PATH)) {
        // El logo mide 1730x900. Lo centramos y escalamos a ~120x62pt.
        const logoW = 120;
        const logoH = 62;
        const logoX = (PAGE.width - logoW) / 2;
        doc.image(LOGO_PATH, logoX, doc.y, { width: logoW, height: logoH });
        doc.y += logoH + 4;
      } else {
        doc.y += 30;
      }

      // Texto institucional centrado
      doc
        .fillColor(COLORS.primary)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(
          "H. Ayuntamiento del Municipio de Pabellón de Arteaga 2024-2027",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );
      doc.moveDown(0.2);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.primary)
        .text(
          "Instituto Municipal de Biodiversidad y Protección Ambiental (IMBIO)",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );

      // -------------------------------------------------------------
      // TÍTULO
      // -------------------------------------------------------------
      doc.moveDown(0.5);
      doc
        .fillColor(COLORS.primary)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(
          "AUTORIZACIÓN DE QUEMA EN HORNOS LADRILLEROS",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );
      doc.moveDown(0.2);

      // Folio + fecha
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
      doc.moveDown(0.6);

      // Subtítulo repetido
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(COLORS.text)
        .text(
          "AUTORIZACIÓN DE QUEMA EN HORNOS LADRILLEROS",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );
      doc.moveDown(0.1);
      doc
        .font("Helvetica-Oblique")
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(
          "Gestión de emisiones atmosféricas y mitigación de impactos a la salud pública.",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );
      doc.moveDown(1.5);

      // -------------------------------------------------------------
      // 1. Datos de identificación y ubicación
      // -------------------------------------------------------------
      sectionTitle(doc, "1. Datos de identificación y ubicación");
      kvRow(doc, "Folio de autorización:", folioAut);
      kvRow(doc, "Responsable (propietario o encargado):", stringVal(d.responsable));
      kvRow(
        doc,
        "Nucleo de la ladrillera:",
        `${stringVal(d.nucleoLadrillera)}. `,
      );
      kvRow(
        doc,
        "Capacidad del horno (volumen o piezas declaradas para esta quema):",
        stringVal(d.capacidadHorno),
      );

      // -------------------------------------------------------------
      // 2. Especificaciones de la quema
      // -------------------------------------------------------------
      sectionTitle(doc, "2. Especificaciones de la quema");
      kvRow(
        doc,
        "Fecha y horario autorizado:",
        `del ${fmtDate(d.fechaInicio)} al ${fmtDate(d.fechaFin)}, de ${stringVal(d.horaInicio)} a ${stringVal(d.horaFin)}.`,
      );
      doc.moveDown(0.2);
      doc
        .font("Helvetica-Oblique")
        .fontSize(8.5)
        .fillColor(COLORS.text)
        .text(
          "Queda estrictamente prohibida la quema de llantas, plásticos, aceites usados, basura doméstica o cualquier residuo peligroso.",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.2);

      // -------------------------------------------------------------
      // 3. Condicionantes técnicas y ambientales
      // -------------------------------------------------------------
      sectionTitle(doc, "3. Condicionantes técnicas y ambientales");
      kvLabelValue(
        doc,
        "Condiciones climáticas:",
        "La quema queda suspendida automáticamente si hay contingencia ambiental, ausencia de viento para la dispersión de contaminantes o si la dirección del viento se dirige directamente a zonas habitadas.",
      );
      kvLabelValue(
        doc,
        "Eficiencia de combustión:",
        "Obligación de mantener el horno en condiciones estructurales óptimas para evitar fugas de calor y exceso de humo negro.",
      );
      kvLabelValue(
        doc,
        "Manejo de cenizas:",
        "Acopio y disposición final adecuada de las cenizas generadas para evitar que se dispersen por el viento.",
      );

      // -------------------------------------------------------------
      // 4. Medidas de seguridad y protección civil
      // -------------------------------------------------------------
      sectionTitle(doc, "4. Medidas de seguridad y protección civil");
      bullet(doc, "Supervisión: Presencia obligatoria de personal durante todo el proceso de quema.");
      bullet(doc, "Equipo contra incendios: Contar con extintores, arena o depósitos de agua cercanos al área del horno.");
      bullet(doc, "Perímetro de seguridad: Mantener el área circundante al horno libre de maleza seca o materiales inflamables.");

      // -------------------------------------------------------------
      // 5. Medidas de mitigación y compensación
      // -------------------------------------------------------------
      sectionTitle(doc, "5. Medidas de mitigación y compensación");
      bullet(
        doc,
        "Barreras vivas: Compromiso de mantener o plantar cortinas de árboles alrededor de la ladrillera para atrapar partículas suspendidas.",
      );
      bullet(
        doc,
        "Aportación al vivero: En caso de quemas recurrentes, establecer la donación de árboles para reforestaciones urbanas como compensación por la huella de carbono.",
      );

      // -------------------------------------------------------------
      // 6. Vigilancia y sanciones
      // -------------------------------------------------------------
      sectionTitle(doc, "6. Vigilancia y sanciones");
      kvLabelValue(
        doc,
        "Inspección:",
        "El titular acepta que personal del IMBIO o Seguridad Pública pueda inspeccionar el tipo de combustible utilizado en cualquier momento.",
      );
      kvLabelValue(
        doc,
        "Revocación:",
        "El incumplimiento de cualquiera de las condicionantes anula la autorización y derivará en multas administrativas.",
      );

      // -------------------------------------------------------------
      // 7. Bloque de firma y vigencia
      // -------------------------------------------------------------
      sectionTitle(doc, "7. Bloque de firma y vigencia");
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(COLORS.text)
        .text(
          "Vigencia: La vigencia de esta autorización se limita únicamente al periodo de la quema solicitada (no es permanente).",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.6);

      // Firma del director (imagen) + texto, centrados
      const firmaY = doc.y;
      const firmaW = 140;
      const firmaH = 60;
      const firmaX = (PAGE.width - firmaW) / 2;
      if (fs.existsSync(FIRMA_PATH)) {
        doc.image(FIRMA_PATH, firmaX, firmaY, { width: firmaW, height: firmaH });
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

      // Técnico que emitió
      // Preferencia: 1) emitidoPor (de la tabla Tecnico), 2) nombre
      // capturado en el formulario. Si ninguno está, mostramos
      // placeholder para que no quede en blanco.
      const tecnico =
        stringVal(ctx.autorizacion.emitidoPor?.nombre) ||
        stringVal(d.nombreTecnicoAutoriza);
      const tecnicoLabel = tecnico
        ? `Técnico Operativo que emitió la Autorización: ${tecnico}`
        : "Técnico Operativo que emitió la Autorización: ____________________";
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(COLORS.text)
        .text(tecnicoLabel, PAGE.marginX, doc.y, {
          width: CONTENT_WIDTH,
          align: "center",
        });
      doc.moveDown(0.2);

      // (El "Sello oficial" no se imprime para no chocar con la cadena
      // de seguridad del footer. La referencia tampoco lo muestra
      // explícitamente como texto.)

      // -------------------------------------------------------------
      // FOOTER (síncrono): QR + cadena de seguridad.
      // Se pinta en la página actual dentro del área segura (respetando
      // el bottom margin). Como el contenido cabe en 1 página, queda
      // perfecto en una sola página.
      // -------------------------------------------------------------
      const qrSize = 50;
      const qrX = PAGE.width - PAGE.marginX - qrSize;
      // qrY se calcula para que el QR quede dentro del área segura
      // (y < PAGE.height - bottom margin = 738)
      const qrY = PAGE.height - PAGE.marginBottom - qrSize - 6;
      if (qrBuffer) {
        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      }

      // Cadena de seguridad a la izquierda del QR, en la misma línea
      // vertical. Así no se sale del área segura.
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

/** Título de sección numerado. */
function sectionTitle(doc: PDFDocument, title: string) {
  doc.moveDown(0.2);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(title, PAGE.marginX, doc.y);
  doc.moveDown(0.1);
}

/**
 * Labels que el usuario pidió quitar de negrita para igualar el
 * estilo de la referencia. Por defecto todos los labels se pintan
 * en Helvetica-Bold; los que estén en este Set se pintan en
 * Helvetica regular.
 */
const LABELS_SIN_NEGRITA: ReadonlySet<string> = new Set([
  "Folio de autorización:",
  "Responsable (propietario o encargado):",
  "Nucleo de la ladrillera:",
  "Capacidad del horno (volumen o piezas declaradas para esta quema):",
  "Fecha y horario autorizado:",
  "Condiciones climáticas:",
  "Eficiencia de combustión:",
  "Manejo de cenizas:",
  "Inspección:",
  "Revocación:",
]);

/** Render de "label: valor" en una línea, sin líneas decorativas. */
function kvRow(doc: PDFDocument, label: string, value: string) {
  const labelFontSize = 9;
  const labelFont = LABELS_SIN_NEGRITA.has(label) ? "Helvetica" : "Helvetica-Bold";
  doc.font(labelFont).fontSize(labelFontSize);
  // Sin `width` en el primer text, pdfkit no fuerza wrap al final
  // del label. `lineBreak: false` garantiza que el label se renderiza
  // en una sola línea. `continued: true` deja el cursor pegado al
  // label para que el value siga en la misma línea.
  doc
    .fillColor(COLORS.text)
    .text(label, PAGE.marginX, doc.y, {
      lineBreak: false,
      continued: true,
    });
  // El value se renderiza después, con el ancho restante. Le damos
  // un width generoso (CONTENT_WIDTH) y dejamos que pdfkit haga wrap
  // natural si el texto es muy largo.
  doc
    .font("Helvetica")
    .fillColor(COLORS.text)
    .text(` ${value || "—"}`, {
      width: CONTENT_WIDTH,
    });
  doc.moveDown(0.1);
}

/** Render de "label valor" en varias líneas, alineado justificado. */
function kvLabelValue(doc: PDFDocument, label: string, value: string) {
  // Para textos largos justificados, dejamos que label y valor
  // compartan el mismo flujo justificado en lugar de un ancho fijo.
  const labelFont = LABELS_SIN_NEGRITA.has(label) ? "Helvetica" : "Helvetica-Bold";
  doc
    .font(labelFont)
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(`${label} `, PAGE.marginX, doc.y, {
      width: CONTENT_WIDTH,
      continued: true,
    });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(value, {
      width: CONTENT_WIDTH,
      align: "justify",
    });
  doc.moveDown(0.1);
}

/** Render de bullet point (•  texto). */
function bullet(doc: PDFDocument, text: string) {
  const bulletText = `•  ${text}`;
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(bulletText, PAGE.marginX + 12, doc.y, {
      width: CONTENT_WIDTH - 12,
      align: "justify",
    });
  doc.moveDown(0.05);
}
