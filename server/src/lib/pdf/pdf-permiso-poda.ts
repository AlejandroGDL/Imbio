/**
 * PDF de autorización: Permiso de Poda de Árbol.
 *
 * Replica el formato oficial del PDF de referencia del IMBIO:
 *   - Header centrado con logo del H. Ayuntamiento + texto institucional
 *   - 5 secciones planas (sin bullets internos)
 *   - Bloque de firma con la imagen del director + QR de validación
 *
 * Los placeholders (entre paréntesis) se reemplazan con los datos del
 * formulario cuando existen. Si un campo no fue rellenado, el paréntesis
 * queda vacío.
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

export function buildPermisoPoda(
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

      // Folio + fecha
      doc.moveDown(0.4);
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

      // Título
      doc.moveDown(0.5);
      doc
        .fillColor(COLORS.primary)
        .font("Helvetica-Bold")
        .fontSize(14)
        .text(
          "AUTORIZACIÓN DE PODA",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );
      doc.moveDown(0.6);

      // -------------------------------------------------------------
      // 1. Datos de referencia y ubicación
      // -------------------------------------------------------------
      sectionTitle(doc, "1. Datos de referencia y ubicación");
      // Solicitante: <nombre>. Domicilio registrado: <direccion>.
      const solicitante = stringVal(d.nombreSolicitante);
      const domicilio = stringVal(d.direccionArbol);
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Solicitante: ${solicitante || "—"}`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.15);
      // Georreferenciación (UTM, Datum WGS84): <coordenadas>
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Georreferenciación del árbol(UTM, Datum WGS84): ${domicilio || "—"}`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.15);
      // Identificación del ejemplar: Nombre científico: <ci>, Nombre común: <com>, ID inventario: [Si aplica]
      const ci = stringVal(d.nombreCientifico);
      const com = stringVal(d.nombreComun);
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Identificación del ejemplar: Nombre científico: ${ci || "—"}, Nombre común: ${com || "—"}`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );

      // -------------------------------------------------------------
      // 2. Contenido del dictamen técnico (sustento)
      // -------------------------------------------------------------
      sectionTitle(doc, "2. Contenido del dictamen técnico (sustento)");
      // Datos dendrométricos: Altura total: (Altura) m, DAP (1.30 m): (DAP) cm, Diámetro de copa: (Diametro Copa) m.
      const altura = stringVal(d.altura);
      const dap = stringVal(d.dap);
      const dcopa = stringVal(d.diametroCopa);
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Datos dendrométricos: Altura total: ${altura || "—"} metros, DAP : ${dap || "—"} cm, Diámetro de copa: ${dcopa || "—"} metros.`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.15);
      // Estado fitosanitario: (Estado). Causal de la poda: (Causal)
      const estado = stringVal(d.estadoFitosanitario);
      const causal = stringVal(d.causal);
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Estado fitosanitario: ${estado || "—"}. Causal de la poda: ${causal || "—"}.`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );

      // -------------------------------------------------------------
      // 3. Especificaciones técnicas de la autorización
      // -------------------------------------------------------------
      sectionTitle(doc, "3. Especificaciones técnicas de la autorización");
      // Texto fijo según la referencia
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          "Tipos de poda permitidos (Cap. III Norma): Formación, Limpieza, Elevación (faldeado), Reducción o Aclareo.",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.15);
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          "Restricciones críticas: Prohibición total de desmoche (topping) o terciado. Límite máximo 20-25% de eliminación de follaje vivo. Técnica de Tres Cortes obligatoria para ramas > 5 cm. Prohibido uso de selladores o pinturas en heridas.",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );

      // -------------------------------------------------------------
      // 4. Medidas de higiene y seguridad
      // -------------------------------------------------------------
      sectionTitle(doc, "4. Medidas de higiene y seguridad");
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          "Desinfección de herramientas (alcohol 70% o cloro) entre cada ejemplar. Acordonar perímetro de seguridad si la intervención lo requiere.",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );

      // -------------------------------------------------------------
      // 5. Medidas de compensación (si aplica)
      // -------------------------------------------------------------
      sectionTitle(doc, "5. Medidas de compensación (si aplica)");
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          "En poda severa o manejo mayor, indicar medidas de restitución o compensación ambiental.",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );

      // -------------------------------------------------------------
      // LÍNEA SEPARADORA + VIGENCIA (fuera de las secciones)
      // -------------------------------------------------------------
      // Línea horizontal fina
      doc
        .save()
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .moveTo(PAGE.marginX, doc.y + 4)
        .lineTo(PAGE.width - PAGE.marginX, doc.y + 4)
        .stroke()
        .restore();
      doc.y += 12;
      doc
        .font("Helvetica-Oblique")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Vigencia: ${stringVal(d.vigenciaPermiso) || "30"} días para ejecutar los trabajos.`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH },
        );
      doc.moveDown(0.6);

      // -------------------------------------------------------------
      // BLOQUE DE FIRMA
      // -------------------------------------------------------------
      // Firma del director (imagen) + texto, centrados
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

      // Técnico que emitió
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

      // -------------------------------------------------------------
      // FOOTER (síncrono): QR + cadena de seguridad.
      // Todo dentro del área segura para que no se cree una página extra.
      // -------------------------------------------------------------
      const qrSize = 50;
      const qrX = PAGE.width - PAGE.marginX - qrSize;
      // qrY suficientemente arriba del bottom margin para que la
      // cadena y el número de página quepan dentro del área segura.
      const qrY = PAGE.height - PAGE.marginBottom - qrSize - 24;
      if (qrBuffer) {
        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      }

      // "1 / 1" arriba del QR, alineado a la derecha (mismo X que el QR)
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

/** Título de sección numerado, sin línea horizontal. */
function sectionTitle(doc: PDFDocument, title: string) {
  doc.moveDown(0.25);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(title, PAGE.marginX, doc.y);
  doc.moveDown(0.1);
}
