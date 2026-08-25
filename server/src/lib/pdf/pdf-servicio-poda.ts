/**
 * PDF de autorización: Servicio de Poda de Árbol.
 *
 * Replica el formato oficial del PDF de referencia del IMBIO:
 * es un "oficio de respuesta" con cuerpo en prosa, no un formato
 * enumerado por secciones.
 *
 * Estructura del oficio:
 *   - Header centrado con logo del H. Ayuntamiento + texto institucional
 *   - Folio + Ref. Solicitud centrados
 *   - Título "OFICIO DE RESPUESTA — SERVICIO DE PODA TÉCNICA"
 *   - Párrafo introductorio (justificado, con negritas en los énfasis)
 *   - 3 líneas con datos del árbol (Ubicación, Especie, Tipo de poda)
 *   - Sección "CONDICIONANTES DEL SERVICIO Y LINEAMIENTOS:" con 5
 *     párrafos en prosa
 *   - Texto final en itálica
 *   - Lugar y fecha alineado a la derecha
 *   - Bloque de firma con la imagen del director + "Auxiliar técnico
 *     que generó el oficio"
 *   - QR + cadena de seguridad en el footer
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
};

// =================================================================
// Helpers
// =================================================================

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

export function buildServicioPoda(
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
      // El folio del servicio de poda tiene prefijo "OF-POD" en la
      // referencia; usamos el folio de la autorización + folio solicitud.
      const folioSolicitud = ctx.solicitud.folio;
      const cadena = `IMBIO-AUT-${folioAut}-${ctx.autorizacion.id ?? "x"}`;

      // -------------------------------------------------------------
      // HEADER: logo centrado + texto institucional centrado debajo
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

      // Texto institucional centrado
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

      // Oficio de respuesta + Folio + Fecha
      doc.moveDown(0.4);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(
          `Oficio de respuesta – Poda técnica (servicio municipal)  |  Folio: ${folioAut}  |  ${fechaEmision}`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );

      // Título
      doc.moveDown(0.5);
      doc
        .fillColor(COLORS.primary)
        .font("Helvetica-Bold")
        .fontSize(13)
        .text(
          "OFICIO DE RESPUESTA — SERVICIO DE PODA TÉCNICA",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );
      doc.moveDown(0.6);

      // -------------------------------------------------------------
      // PÁRRAFO INTRODUCTORIO
      // -------------------------------------------------------------
      // En la referencia hay texto bold dentro del párrafo: "Código
      // Municipal de Pabellón de Arteaga", "oficio de respuesta",
      // "servicio de poda técnica", "IMB-3-2026-00004".
      // Para emular el bold inline, usamos varios text() con
      // continued: true, alternando Helvetica regular y Helvetica-Bold.
      drawParagraphWithEmphasized(
        doc,
        [
          { text: "En atención a su solicitud y de conformidad con las atribuciones que el ", bold: false },
          { text: "Código Municipal de Pabellón de Arteaga ", bold: true },
          { text: " confiere a este Instituto en materia de conservación de la biodiversidad y servicios ambientales, se emite el presente ", bold: false },
          { text: "oficio de respuesta", bold: true },
          { text: " relativo al ", bold: false },
          { text: "servicio de poda técnica ", bold: true },
          { text: " solicitado, habiéndose validado previamente la inspección de campo y el pago de derechos bajo el folio ", bold: false },
          { text: folioSolicitud, bold: true },
          { text: ".", bold: false },
        ],
      );
      doc.moveDown(0.4);

      // -------------------------------------------------------------
      // "Dicha intervención se realizará bajo las siguientes especificaciones:"
      // -------------------------------------------------------------
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(COLORS.text)
        .text(
          "Dicha intervención se realizará bajo las siguientes especificaciones:",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.3);

      // -------------------------------------------------------------
      // 3 líneas con datos del árbol (Ubicación, Especie, Tipo de poda)
      // -------------------------------------------------------------
      const ubicacion = stringVal(d.ubicacionArbol);
      const ci = stringVal(d.nombreCientifico);
      const com = stringVal(d.nombreComun);
      const tipoPoda = stringVal(d.tipoPoda);
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.text)
        .text(
          `Ubicación: ${ubicacion || "—"} `,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.15);
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.text)
        .text(
          `Especie: ${ci} / ${com }`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.15);
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(COLORS.text)
        .text(
          `Tipo de poda del servicio: ${tipoPoda || "Limpieza"}`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.4);

      // -------------------------------------------------------------
      // "CONDICIONANTES DEL SERVICIO Y LINEAMIENTOS:" (título en bold)
      // -------------------------------------------------------------
      doc
        .font("Helvetica-Bold")
        .fontSize(10.5)
        .fillColor(COLORS.text)
        .text(
          "CONDICIONANTES DEL SERVICIO Y LINEAMIENTOS:",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH },
        );
      doc.moveDown(0.2);

      // 5 párrafos con énfasis bold en el inicio (label)
      condicionante(doc, "Fundamento Legal:",
        "El servicio se presta en cumplimiento con el Código Municipal vigente, el cual regula el mantenimiento del arbolado urbano para garantizar la seguridad pública y la sanidad vegetal del municipio.");
      condicionante(doc, "Programación:",
        "El personal operativo del IMBIO realizará los trabajos en un periodo estimado de 15 días hábiles. Se solicita al ciudadano facilitar el acceso y asegurar que no existan obstáculos que comprometan la seguridad de la cuadrilla.");
      condicionante(doc, "Criterios Técnicos:",
        "La poda se ejecutará bajo estándares profesionales para evitar el debilitamiento del ejemplar. Queda estrictamente prohibido el \"desmoche\" o \"terciado\" (corte de ramas principales a mitad de sección), privilegiando siempre la salud estructural del árbol.");
      condicionante(doc, "Higiene Forestal:",
        "Se garantiza el uso de herramientas desinfectadas para prevenir la propagación de patógenos o muérdago, asegurando que los cortes sean limpios y cercanos al cuello de la rama para una correcta cicatrización.");
      condicionante(doc, "Manejo de Biomasa:",
        "El residuo verde (ramas y follaje) será recolectado y trasladado por el IMBIO para su tratamiento o trituración, manteniendo la vía pública libre de desechos orgánicos tras la jornada de trabajo.");

      // -------------------------------------------------------------
      // Texto final en itálica
      // -------------------------------------------------------------
      doc.moveDown(0.2);
      doc
        .font("Helvetica-Oblique")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          "El presente oficio ampara el servicio municipal de poda técnica respecto del ejemplar señalado y debe ser conservado por el solicitante como comprobante del cumplimiento de la normativa ambiental municipal.",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.4);

      // -------------------------------------------------------------
      // LUGAR Y FECHA (alineado a la derecha)
      // -------------------------------------------------------------
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(COLORS.text)
        .text(
          `Pabellón de Arteaga, Ags., a ${fechaEmisionLetras(fechaEmision)}`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "right" },
        );
      doc.moveDown(0.6);

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

      // Auxiliar técnico (no "Técnico Operativo", como dice la referencia)
      const tecnico =
        stringVal(ctx.autorizacion.emitidoPor?.nombre) ||
        stringVal(d.nombreTecnicoAutoriza);
      const tecnicoLabel = tecnico
        ? `Auxiliar técnico que generó el oficio: ${tecnico}`
        : "Auxiliar técnico que generó el oficio: ____________________";
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(COLORS.text)
        .text(tecnicoLabel, PAGE.marginX, doc.y, {
          width: CONTENT_WIDTH,
          align: "center",
        });

      // -------------------------------------------------------------
      // FOOTER (síncrono): QR + cadena de seguridad.
      // -------------------------------------------------------------
      const qrSize = 50;
      const qrX = PAGE.width - PAGE.marginX - qrSize;
      const qrY = PAGE.height - PAGE.marginBottom - qrSize - 24;
      if (qrBuffer) {
        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      }

      // "1 / 1" arriba del QR, alineado a la derecha
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

/** Formatea una fecha. Acepta string YYYY-MM-DD o Date object. */
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

/** Convierte "24/07/2026" → "24 de julio de 2026" para el lugar y fecha. */
function fechaEmisionLetras(s: string): string {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const [, mm, dd, yyyy] = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)!;
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const mesIdx = parseInt(mm, 10) - 1;
  if (mesIdx < 0 || mesIdx > 11) return s;
  return `${parseInt(dd, 10)} de ${meses[mesIdx]} de ${yyyy}`;
}

/** Renderiza un párrafo con texto en bold inline (segmentos alternados). */
function drawParagraphWithEmphasized(
  doc: PDFDocument,
  segments: Array<{ text: string; bold: boolean }>,
): void {
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.text);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    doc.font(seg.bold ? "Helvetica-Bold" : "Helvetica");
    if (i === 0) {
      doc.text(seg.text, PAGE.marginX, doc.y, {
        width: CONTENT_WIDTH,
        align: "justify",
        continued: i < segments.length - 1,
      });
    } else {
      // continued: true excepto en el último segmento
      const isLast = i === segments.length - 1;
      if (isLast) {
        doc.text(seg.text, { continued: false });
      } else {
        doc.text(seg.text, { continued: true });
      }
    }
  }
}

/** Renderiza un párrafo "Label: contenido" con label en bold. */
function condicionante(doc: PDFDocument, label: string, texto: string): void {
  doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .fillColor(COLORS.text)
    .text(label, PAGE.marginX, doc.y, {
      width: CONTENT_WIDTH,
      continued: true,
    });
  doc
    .font("Helvetica")
    .fillColor(COLORS.text)
    .text(` ${texto}`, {
      width: CONTENT_WIDTH,
      align: "justify",
    });
  doc.moveDown(0.15);
}
