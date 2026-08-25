/**
 * PDF de autorización: Permiso de Derribo de Árbol.
 *
 * Replica el formato oficial del PDF de referencia del IMBIO:
 *   - Header centrado con logo del H. Ayuntamiento + texto institucional
 *   - 5 secciones planas (sin bullets internos)
 *   - Bloque de firma con la imagen del director + QR de validación
 *
 * Los placeholders (entre paréntesis) se reemplazan con los datos del
 * formulario cuando existen. Si un campo no fue rellenado, se queda
 * con un "—" o vacío.
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
import { tarifaDerriboPara } from "../precios";

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

export function buildPermisoDerribo(
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
      // Ref. Solicitud: usamos el folio de la solicitud
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

      // Texto institucional centrado (formato de la referencia:
      // primera línea: "H. Ayuntamiento de Pabellón de Arteaga | IMBIO"
      // segunda línea: "Instituto Municipal de Biodiversidad y Protección Ambiental")
      doc
        .fillColor(COLORS.primary)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(
          "H. Ayuntamiento de Pabellón de Arteaga | IMBIO",
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
          "Instituto Municipal de Biodiversidad y Protección Ambiental",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );

      // Folio + fecha + Ref. Solicitud
      doc.moveDown(0.4);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(
          `Folio: ${folioAut}  |  Fecha: ${fechaEmision}  |  Ref. Solicitud: ${folioSolicitud}`,
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
          "AUTORIZACIÓN DE DERRIBO",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );
      doc.moveDown(0.6);

      // -------------------------------------------------------------
      // 1. Identificación del ejemplar o ejemplares a derribar
      // -------------------------------------------------------------
      sectionTitle(doc, "1. Identificación del ejemplar o ejemplares a derribar");
      // Sitio de derribo (domicilio registrado): <coordenadas>
      const sitio = stringVal(d.coordenadas);
      doc.moveDown(0.15);
      // Coordenadas del sitio de derribo (domicilio): (Domicilio)
      // Reutilizamos coordenadas (la referencia es redundante con la
      // línea anterior; si no hay, queda en blanco con un guiÃ³n)
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Coordenadas del sitio de derribo (domicilio): ${sitio || "—"}.`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.15);
      // Datos taxonómicos: (Nombre Científico) ((Nombre común)).
      // Si la solicitud trae el campo nuevo `especie` (key de la
      // tabla TARIFAS_DERRIBO), lo traducimos al nombre legible y al
      // nombre científico. Si trae los campos antiguos `nombreComun` /
      // `nombreCientifico`, los respetamos.
      const especieKey = stringVal(d.especie);
      const tarifa = tarifaDerriboPara(especieKey);
      const ci = stringVal(d.nombreCientifico) || tarifa?.cientifico || "";
      const com =
        stringVal(d.nombreComun) ||
        (tarifa && especieKey ? `${tarifa.nombre} (${especieKey})` : "");
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Datos taxonómicos: ${ci || "(Nombre Científico)"} (${com || "(Nombre común)"}).`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.15);
      // Dimensiones: Altura: (Altura) m, DAP: (DAP) cm, Diámetro de copa: (Diametro) m.
      // Si hay `perimetro` (CAP en cm) y/o `factorForma`, los añadimos
      // al final del texto para que queden reflejados en la autorización.
      const altura = stringVal(d.altura);
      const dap = stringVal(d.dap);
      const dcopa = stringVal(d.diametroCopa);
      const perimetro = stringVal(d.perimetro);
      const factorForma = stringVal(d.factorForma);
      const extrasDim: string[] = [];
      if (perimetro) extrasDim.push(`Perímetro (CAP): ${perimetro} cm`);
      if (factorForma)
        extrasDim.push(`Factor de forma: f = ${factorForma}`);
      const extrasTexto =
        extrasDim.length > 0 ? `; ${extrasDim.join("; ")}` : "";
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Dimensiones: Altura: ${altura || "(Altura)"} metro, DAP: ${dap || "(DAP)"} cm, Diámetro de copa: ${dcopa || "(Diametro)"} metro${extrasTexto}.`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );

      // -------------------------------------------------------------
      // 2. Sustento jurídico y dictamen técnico
      // -------------------------------------------------------------
      sectionTitle(doc, "2. Sustento jurídico y dictamen técnico");
      // Causal de derribo: (CAUSAL). Nivel de riesgo: (Nivel Riesgo)
      const causal = stringVal(d.causal);
      const nivelRiesgo = stringVal(d.nivelRiesgo);
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Causal de derribo: ${causal || "(CAUSAL)"}. Nivel de riesgo: ${nivelRiesgo || "(Nivel Riesgo)"}`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.15);

      // -------------------------------------------------------------
      // 3. Condicionantes para la ejecución
      // -------------------------------------------------------------
      sectionTitle(doc, "3. Condicionantes para la ejecución");
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          "Método: desmantelamiento seccionado o caída dirigida según zona. Destino de residuos: retiro de biomasa a sitios autorizados (vivero municipal o centro de acopio). Extracción de tocón según criterio técnico.",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );

      // -------------------------------------------------------------
      // 4. Medidas de compensación ambiental (restitución)
      // -------------------------------------------------------------
      sectionTitle(doc, "4. Medidas de compensación ambiental (restitución)");
      // Plazo de cumplimiento: . (texto fijo)
      doc.moveDown(0.15);
      // Cantidad de árboles a reponer: (Cantidad Especies). Especies sugeridas: (Especie Sugerida).
      const cantEspecies = stringVal(d.cantidadEspeciesReponer);
      const espSugeridas = stringVal(d.especiesSugeridas);
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Cantidad de árboles a reponer: ${cantEspecies || "No Aplica"}. Especies sugeridas: ${espSugeridas || "No aplica"}.`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );
      doc.moveDown(0.15);
      // Texto en itálica
      doc
        .font("Helvetica-Oblique")
        .fontSize(9)
        .fillColor(COLORS.text)
        .text(
          "Los ejemplares de reposición deberán ser plantados en un radio de un kilómetro a la redonda del sitio de afectación, o bien ser entregados al IMBIO para su destino en áreas verdes municipales.",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );

      // -------------------------------------------------------------
      // 5. Vigencia y restricciones
      // -------------------------------------------------------------
      sectionTitle(doc, "5. Vigencia y restricciones");
      const vigencia = stringVal(d.vigenciaPermiso);
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Vigencia: ${vigencia || "30"} días. Horarios que no afecten tránsito o paz pública. El solicitante asume responsabilidad civil por daños a terceros.`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "justify" },
        );

      // -------------------------------------------------------------
      // LÍNEA SEPARADORA + LUGAR Y FECHA (fuera de las secciones)
      // -------------------------------------------------------------
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
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(COLORS.text)
        .text(
          `Lugar y fecha: Pabellón de Arteaga, Ags. ${fechaEmision}`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH },
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
