/**
 * PDF de autorización: Uso de Contenedores Municipales (RSU).
 *
 * Replica el formato oficial del PDF de referencia (TEST.pdf):
 *   - Página 1: header + secciones 1 a 5 (Identificación,
 *     Especificaciones, Condicionantes, Costos, Sanciones)
 *   - Página 2: header repetido + bloque de firma + QR
 *
 * Los placeholders (entre paréntesis) se reemplazan con los datos
 * del formulario cuando existen. Si un campo no fue rellenado, el
 * paréntesis queda con el label original.
 *
 * Optimizado para caber en 2 páginas Letter (cuerpo a 8.5pt,
 * lineGap 0, márgenes reducidos).
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
  marginTop: 24,
  marginBottom: 28,
};
const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;

const COLORS = {
  primary: "#1e1b4b",
  text: "#0f172a",
  muted: "#475569",
  border: "#cbd5e1",
};

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

/** Formato moneda: $1,234.56 */
function fmtMoney(n: unknown): string {
  if (n === null || n === undefined || n === "") return "—";
  const raw = typeof n === "string" ? Number(n) : n;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return "—";
  return `$${raw.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// =================================================================
// Constantes de la referencia (TEST.pdf)
// =================================================================
const CLASIFICACION_VOLUMEN =
  "Microgenerador (hasta 10 kg/día); " +
  "Pequeño Generador (mayor a 10 kg y hasta 50 kg/día o equivalente 400 kg/mes).";

const HORARIO_DEPOSITO =
  "Para evitar la acumulación y focos de infección, se establece un horario estricto de depósito: de 19:00 a 07:00 horas. Queda prohibido el depósito fuera de este rango para asegurar la recolección eficiente por parte de los servicios municipales.";

const RESIDUOS_PERMITIDOS =
  "Únicamente Residuos Sólidos Urbanos (RSU): restos orgánicos, papel, cartón, plásticos, vidrios y envases.\n" +
  "Prohibición de Residuos de Manejo Especial o Peligrosos: no se autoriza el depósito de aceites, químicos, baterías, neumáticos, escombro ni cadáveres de animales.\n" +
  "Residuos de ladrilleras: Las cenizas y residuos de procesos industriales (p. ej. ladrilleras) no entran en esta categoría y requieren un manejo separado.";

const MODO_DISPOSICION =
  "Los residuos deberán entregarse debidamente embolsados y amarrados. Queda prohibido dejar basura fuera del contenedor o en el piso.";

const INSPECCION =
  "El IMBIO se reserva la facultad de realizar visitas aleatorias para verificar que el volumen y tipo de residuo coincida con lo autorizado.";
const CAUSAS_REVOCACION =
  "Causas de revocación: depositar residuos peligrosos; exceder los límites de peso diario autorizados; depositar fuera del horario establecido.";
const MULTAS =
  "El incumplimiento derivará en sanciones administrativas conforme al Reglamento de Medio Ambiente de Pabellón de Arteaga.";

// =================================================================
// Builder principal
// =================================================================

export function buildPermisoContenedores(
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
      const fechaVto = fmtDate(ctx.autorizacion.fechaVencimiento);
      const folioAut = ctx.autorizacion.numeroAutorizacion;
      const cadena = `IMBIO-AUT-${folioAut}-${ctx.autorizacion.id ?? "x"}`;
      // Versión compacta de la cadena (sin el prefijo "IMBIO-AUT-")
      // para que quepa en el ancho del QR (~38pt)
      const cadenaCompacta = cadena.length > 22
        ? cadena.slice(cadena.length - 22)
        : cadena;

      // ----- Datos del formulario -----
      const tipoGenerador = stringVal(d.tipoGenerador) || "(Tipo de generador)";
      const nombreRazon = stringVal(d.nombreRazonSocial) || "(Nombre o Razón Social)";
      const rfc = stringVal(d.rfc) || "(RFC)";
      const ubicEst = stringVal(d.ubicacionEstablecimiento) || "(Ubicación Establecimiento)";
      const vigenciaFiscal = stringVal(d.vigenciaFiscal)
        ? yearOf(d.vigenciaFiscal) || "(Vigencia Fiscal)"
        : "(Vigencia Fiscal)";
      const volumen = stringVal(d.volumenAutorizado) || "(Volumen)";
      const ubiCont = stringVal(d.ubicacionContenedor) || "(Ubicación)";
      const mesesPermiso = stringVal(d.mesesPermiso) || "—";

      // Cálculo del monto: factor × VVUMA × mesesPermiso
      const FACTORES: Record<string, number> = {
        "Micro-generador (1-40 kg/semana)": 3,
        "Pequeño generador (40-80 kg/semana)": 4,
        "Pequeño generador (80-150 kg/semana)": 6,
        "Pequeño generador (150-180 kg/semana)": 8,
        "Pequeño generador (180-200 kg/semana)": 11,
      };
      const factor = FACTORES[tipoGenerador] ?? null;
      const vvuma = Number((d as Record<string, unknown>).vvuma ?? 117.31);
      const mesesNum = Number(mesesPermiso);
      const monto =
        factor && Number.isFinite(vvuma) && Number.isFinite(mesesNum) && mesesNum > 0
          ? `$${(factor * vvuma * mesesNum).toLocaleString("es-MX", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : stringVal(d.precioFinal)
          ? fmtMoney(d.precioFinal)
          : "(Cuota)";

      // =============================================================
      // PÁGINA 1
      // =============================================================
      doc.y = PAGE.marginTop;

      // ----- HEADER (logo + texto institucional centrado) -----
      if (fs.existsSync(LOGO_PATH)) {
        const logoW = 78;
        const logoH = 40;
        const logoX = (PAGE.width - logoW) / 2;
        doc.image(LOGO_PATH, logoX, doc.y, { width: logoW, height: logoH });
        doc.y += logoH + 1;
      } else {
        doc.y += 18;
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(COLORS.primary)
        .text(
          "H. Ayuntamiento del Municipio de Pabellón de Arteaga 2024-2027",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center", lineBreak: false },
        );
      doc.moveDown(0.05);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.primary)
        .text(
          "Instituto Municipal de Biodiversidad y Protección Ambiental (IMBIO)",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center", lineBreak: false },
        );
      doc.moveDown(0.15);

      // ----- TÍTULO -----
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(COLORS.primary)
        .text(
          "AUTORIZACIÓN DE USO DE CONTENEDORES MUNICIPALES (RSU)",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center", lineBreak: false },
        );
      doc.moveDown(0.1);

      // ----- Folio + fecha de emisión -----
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(
          `Folio: ${folioAut} | Fecha de emisión: ${fechaEmision || "—"}`,
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center", lineBreak: false },
        );
      doc.moveDown(0.15);

      // ----- Subtítulo (compacto: 1 línea) -----
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(COLORS.text)
        .text(
          "AUTORIZACIÓN DE USO DE CONTENEDORES MUNICIPALES PARA RESIDUOS SÓLIDOS URBANOS (RSU)",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center" },
        );
      doc.moveDown(0.04);

      // ----- Intro (1 línea) -----
      doc
        .font("Helvetica-Oblique")
        .fontSize(7)
        .fillColor(COLORS.muted)
        .text(
          "Lineamientos de la Ley de Ingresos de Pabellón de Arteaga 2026 y facultades del IMBIO.",
          PAGE.marginX,
          doc.y,
          { width: CONTENT_WIDTH, align: "center", lineBreak: false },
        );
      doc.moveDown(0.12);

      // ----- Estilos comunes para el cuerpo -----
      const paraOpts = { width: CONTENT_WIDTH, align: "justify" as const, lineGap: 1 };
      const bodyFont = "Helvetica";
      const bodySize = 8.5;
      const titleSize = 9.5;
      const gap = 0.3;

      const para = (txt: string, bold = false, italic = false) => {
        const font = bold ? "Helvetica-Bold" : italic ? "Helvetica-Oblique" : bodyFont;
        doc
          .font(font)
          .fontSize(bodySize)
          .fillColor(COLORS.text)
          .text(txt, PAGE.marginX, doc.y, paraOpts);
        doc.moveDown(gap);
      };

      // ----- 1. Identificación del generador -----
      sectionTitle(doc, "1. Identificación del generador", titleSize);
      para(`Tipo de generador: ${tipoGenerador}.`);
      para(`Nombre o razón social: ${nombreRazon}. RFC: ${rfc}.`);
      para(`Ubicación del establecimiento o domicilio: ${ubicEst}.`);
      para(`Clasificación según volumen: ${CLASIFICACION_VOLUMEN}`);

      // ----- 2. Especificaciones de la autorización -----
      sectionTitle(doc, "2. Especificaciones de la autorización", titleSize);
      para(`Vigencia fiscal: ${vigenciaFiscal}.`);
      para(
        `Volumen autorizado: Cantidad máxima diaria permitida para depósito en contenedor municipal: ${volumen} kg (conforme a su clasificación).`,
      );
      para(`Ubicación del contenedor o zona asignada: ${ubiCont}.`);
      para(
        `Vigencia del permiso: del ${fechaEmision || "—"} al ${fechaVto || "—"}.`,
        true,
      );
      doc
        .font("Helvetica-Oblique")
        .fontSize(6.5)
        .fillColor(COLORS.muted)
        .text(
          "Vencido el periodo de vigencia, el titular deberá tramitar una nueva autorización para continuar utilizando los contenedores municipales; el uso de estos sin permiso vigente será sancionado conforme al Reglamento de Medio Ambiente de Pabellón de Arteaga.",
          PAGE.marginX,
          doc.y,
          paraOpts,
        );
      doc.moveDown(gap);

      // ----- 3. Condicionantes de uso (3 sub-bloques en flujo normal) -----
      sectionTitle(doc, "3. Condicionantes de uso", titleSize);
      para("A. Horarios de disposición:", true);
      doc
        .font(bodyFont)
        .fontSize(bodySize)
        .fillColor(COLORS.text)
        .text(HORARIO_DEPOSITO, PAGE.marginX, doc.y, paraOpts);
      doc.moveDown(gap);
      para("B. Tipo de residuos permitidos:", true);
      doc
        .font(bodyFont)
        .fontSize(bodySize)
        .fillColor(COLORS.text)
        .text(RESIDUOS_PERMITIDOS, PAGE.marginX, doc.y, paraOpts);
      doc.moveDown(gap);
      para("C. Modo de disposición:", true);
      doc
        .font(bodyFont)
        .fontSize(bodySize)
        .fillColor(COLORS.text)
        .text(MODO_DISPOSICION, PAGE.marginX, doc.y, paraOpts);
      doc.moveDown(gap);

      // ----- 4. Costos y derechos -----
      sectionTitle(doc, "4. Costos y derechos (Ley de Ingresos 2026)", titleSize);
      para(
        `Referencia al artículo correspondiente de la Ley de Ingresos del Municipio de Pabellón de Arteaga 2026 por la prestación del servicio de recolección y disposición final para comercios y prestadores de servicios. (Cálculo: ${factor ?? "—"} × VVUMA × ${mesesPermiso} = ${monto}.)`,
      );
      para(`Cuota (UMA vigente 2026 / monto): ${monto}.`);

      // ----- 5. Medidas de control y sanciones (3 sub-bloques) -----
      sectionTitle(doc, "5. Medidas de control y sanciones", titleSize);
      para("Inspección:", true);
      doc
        .font(bodyFont)
        .fontSize(bodySize)
        .fillColor(COLORS.text)
        .text(INSPECCION, PAGE.marginX, doc.y, paraOpts);
      doc.moveDown(gap);
      para("Causas de revocación:", true);
      doc
        .font(bodyFont)
        .fontSize(bodySize)
        .fillColor(COLORS.text)
        .text(CAUSAS_REVOCACION, PAGE.marginX, doc.y, paraOpts);
      doc.moveDown(gap);
      para("Multas:", true);
      doc
        .font(bodyFont)
        .fontSize(bodySize)
        .fillColor(COLORS.text)
        .text(MULTAS, PAGE.marginX, doc.y, paraOpts);

      // =============================================================
      // FIRMA + QR al final de la página 1 (1 sola página)
      // =============================================================
      const tecnicoP1 =
        stringVal(ctx.autorizacion.emitidoPor?.nombre) ||
        stringVal(d.nombreTecnicoAutoriza);
      const tecnicoLabelP1 = tecnicoP1
        ? `Técnico Operativo que emitió la Autorización:   ${tecnicoP1}`
        : "Técnico Operativo que emitió la Autorización:   (Técnico Operativo)";

      // =============================================================
      // FIRMA + QR en flujo normal al final del contenido.
      //
      // Estrategia: el contenido (secciones 1-5) se escribe con buen
      // padding (gap=0.2, lineGap=0, bodySize=8pt) para distribuirse
      // bien en la página. El footer se escribe en flujo normal al
      // final, sin posición absoluta. Si todo cabe en 1 hoja, queda
      // bien distribuido. Si se desborda, se va a la página 2.
      // =============================================================
      doc.moveDown(1.0);

      // QR a la derecha (en la misma línea que la firma)
      const qrSize = 50;
      const qrX = PAGE.width - PAGE.marginX - qrSize;
      const qrY = doc.y;
      if (qrBuffer) {
        doc.save();
        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
        doc.restore();
      }

      // Firma del director (imagen) — al lado izquierdo del QR
      const firmaW = 130;
      const firmaH = 40;
      const firmaX = (PAGE.width - firmaW) / 2 - 30;
      const firmaY = doc.y;
      if (fs.existsSync(FIRMA_PATH)) {
        doc.save();
        doc.image(FIRMA_PATH, firmaX, firmaY, {
          width: firmaW,
          height: firmaH,
        });
        doc.restore();
      }

      // "1 / 1" debajo del QR
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(COLORS.muted)
        .text("1 / 1", qrX, qrY + qrSize + 2, {
          width: qrSize,
          align: "right",
          lineBreak: false,
        });

      // Cadena de seguridad pequeña debajo del "1 / 1"
      doc
        .font("Helvetica")
        .fontSize(6)
        .fillColor(COLORS.muted)
        .text(cadenaCompacta, qrX, qrY + qrSize + 12, {
          width: qrSize,
          align: "right",
          lineBreak: false,
        });

      // Textos debajo de la firma
      const textY = firmaY + firmaH + 4;
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.text)
        .text("BIÓL. LUIS FELIPE LOZANO ROMÁN", PAGE.marginX, textY, {
          width: CONTENT_WIDTH,
          align: "center",
        });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text("Director del IMBIO", PAGE.marginX, doc.y, {
          width: CONTENT_WIDTH,
          align: "center",
        });
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(COLORS.text)
        .text(tecnicoLabelP1, PAGE.marginX, doc.y, {
          width: CONTENT_WIDTH,
          align: "center",
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// =================================================================
// Helpers internos de layout
// =================================================================

function yearOf(s: unknown): string {
  if (typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s)) {
    return `Ejercicio ${s.slice(0, 4)}`;
  }
  if (s instanceof Date) {
    return `Ejercicio ${s.getFullYear()}`;
  }
  return "";
}

function sectionTitle(doc: PDFDocument, title: string, size = 9.5) {
  doc.moveDown(0.6);
  doc
    .font("Helvetica-Bold")
    .fontSize(size)
    .fillColor(COLORS.text)
    .text(title, PAGE.marginX, doc.y);
  doc.moveDown(0.2);
}
