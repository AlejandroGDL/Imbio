/**
 * Helpers compartidos para construir PDFs de autorización.
 *
 * Usan pdfkit (https://pdfkit.org/). Cada función recibe un `doc` de
 * PDFKit ya creado y va escribiendo en él.
 *
 * El layout es tipo A4 carta con márgenes generosos para que sea
 * fácil de imprimir y firmar.
 */

// @ts-expect-error - pdfkit expone la clase via namespace PDFKit; TS6133
// no detecta que PDFKit.PDFDocument usa el símbolo importado.
import PDFKit from "pdfkit";
type PDFDocument = PDFKit.PDFDocument;

// =================================================================
// Tipos compartidos
// =================================================================
// Mantenemos estos tipos flexibles (no atados a Prisma) para que
// cualquier caller pueda armar el contexto a partir de queries
// distintas sin problemas de tipos.

export interface PdfCiudadano {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  curp: string | null;
  telefono: string | null;
  direccion: string | null;
}

export interface PdfCampo {
  key: string;
  label: string;
  tipo?: string;
  showInAuthorization?: boolean;
}

export interface PdfTramite {
  id: number;
  codigo: string;
  nombre: string;
  campos: PdfCampo[];
}

export interface PdfTecnico {
  id: number;
  nombre: string;
  cargo: string;
}

export interface PdfAutorizacion {
  id: number;
  numeroAutorizacion: string;
  fechaEmision: Date | string;
  fechaVencimiento: Date | string | null;
  considerandos: string | null;
  emitidoPor?: PdfTecnico | null;
}

export interface PdfSolicitud {
  id: number;
  folio: string;
  datos: Record<string, unknown>;
}

export interface PdfContext {
  doc: PDFDocument;
  tramite: PdfTramite;
  solicitud: PdfSolicitud;
  autorizacion: PdfAutorizacion;
  ciudadano: PdfCiudadano;
}

// =================================================================
// Constantes de layout (en puntos, 1pt = 1/72 inch)
// =================================================================
export const PAGE = {
  width: 612, // 8.5" * 72
  height: 792, // 11" * 72
  margin: 54, // ~0.75"
};

export const COLORS = {
  primary: "#047857", // emerald-700
  text: "#0f172a", // slate-900
  muted: "#64748b", // slate-500
  border: "#cbd5e1", // slate-300
  bg: "#f1f5f9", // slate-100
};

// =================================================================
// Builders
// =================================================================

/** Línea horizontal delgada. */
export function hr(
  doc: PDFDocument,
  y?: number,
  color = COLORS.border,
): void {
  const yPos = y ?? doc.y;
  doc
    .save()
    .strokeColor(color)
    .lineWidth(0.5)
    .moveTo(PAGE.margin, yPos)
    .lineTo(PAGE.width - PAGE.margin, yPos)
    .stroke()
    .restore();
  doc.y = yPos + 6;
}

/** Header institucional (logo, nombre, subtítulo). */
export function header(
  doc: PDFDocument,
  ctx: PdfContext,
): void {
  const startY = PAGE.margin;

  // Banda superior con color institucional
  doc
    .save()
    .rect(0, 0, PAGE.width, 8)
    .fill(COLORS.primary)
    .restore();

  // Nombre de la institución
  doc
    .fillColor(COLORS.primary)
    .font("Helvetica-Bold")
    .fontSize(13)
    .text("INSTITUTO MUNICIPAL DE BIODIVERSIDAD", PAGE.margin, startY, {
      align: "center",
      width: PAGE.width - PAGE.margin * 2,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("DE PABELLÓN DE ARTEAGA", PAGE.margin, doc.y, {
      align: "center",
      width: PAGE.width - PAGE.margin * 2,
    });

  // Tag del tipo de documento
  doc.moveDown(0.4);
  doc
    .fillColor(COLORS.text)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("AUTORIZACIÓN", PAGE.margin, doc.y, {
      align: "center",
      width: PAGE.width - PAGE.margin * 2,
    });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(ctx.tramite.nombre.toUpperCase(), PAGE.margin, doc.y, {
      align: "center",
      width: PAGE.width - PAGE.margin * 2,
    });

  doc.moveDown(0.6);
  hr(doc);
}

/** Bloque de metadatos (número de autorización, folio, fecha). */
export function metaBox(
  doc: PDFDocument,
  ctx: PdfContext,
): void {
  const colWidth = (PAGE.width - PAGE.margin * 2) / 3;

  const y0 = doc.y;
  const fecha = new Date(ctx.autorizacion.fechaEmision).toLocaleDateString(
    "es-MX",
    { year: "numeric", month: "long", day: "numeric" },
  );

  // Columna 1: número de autorización
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text("N° DE AUTORIZACIÓN", PAGE.margin, y0, { width: colWidth });
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(ctx.autorizacion.numeroAutorizacion, PAGE.margin, doc.y, {
      width: colWidth,
    });

  // Columna 2: folio de solicitud
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text("FOLIO DE SOLICITUD", PAGE.margin + colWidth, y0, { width: colWidth });
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(ctx.solicitud.folio, PAGE.margin + colWidth, doc.y, {
      width: colWidth,
    });

  // Columna 3: fecha
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text("FECHA DE EMISIÓN", PAGE.margin + colWidth * 2, y0, {
      width: colWidth,
    });
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(fecha, PAGE.margin + colWidth * 2, doc.y, { width: colWidth });

  doc.y = Math.max(doc.y, y0 + 30) + 4;
  hr(doc);
}

/** Bloque de datos del ciudadano. */
export function ciudadanoBox(
  doc: PDFDocument,
  ctx: PdfContext,
): void {
  sectionTitle(doc, "Datos del Solicitante");

  const c = ctx.ciudadano;
  const fullName = [c.nombre, c.apellidoPaterno, c.apellidoMaterno]
    .filter(Boolean)
    .join(" ");

  const rows: Array<[string, string]> = [
    ["Nombre", fullName],
    ...(c.curp ? [["CURP", c.curp] as [string, string]] : []),
    ...(c.telefono ? [["Teléfono", c.telefono] as [string, string]] : []),
    ...(c.direccion ? [["Dirección", c.direccion] as [string, string]] : []),
  ];

  kvTable(doc, rows);
  doc.moveDown(0.4);
}

/** Bloque de datos dinámicos del trámite (campos capturados). */
export function tramiteBox(
  doc: PDFDocument,
  ctx: PdfContext,
  title = "Datos del Trámite",
  filterKeys?: string[],
): void {
  const campos = ctx.tramite.campos
    .filter((c) =>
      filterKeys ? filterKeys.includes(c.key) : c.showInAuthorization !== false,
    )
    .map((c) => {
      const raw = (ctx.solicitud.datos as Record<string, unknown> | null)?.[
        c.key
      ];
      return [c.label, formatValue(raw)] as [string, string];
    })
    .filter(([, v]) => v !== "" && v !== "—");

  if (campos.length === 0) return;
  sectionTitle(doc, title);
  kvTable(doc, campos);
  doc.moveDown(0.4);
}

/** Bloque de firmas. */
export function firmasBox(
  doc: PDFDocument,
  ctx: PdfContext,
): void {
  // Empujar al fondo si hay espacio
  const minY = PAGE.height - 180;
  if (doc.y < minY) doc.y = minY;

  const colWidth = (PAGE.width - PAGE.margin * 2) / 2 - 20;
  const y0 = doc.y;

  // Columna 1: técnico que autoriza
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text("POR EL INSTITUTO", PAGE.margin, y0, { width: colWidth });
  doc.moveDown(2);
  doc
    .save()
    .moveTo(PAGE.margin, doc.y)
    .lineTo(PAGE.margin + colWidth, doc.y)
    .strokeColor(COLORS.text)
    .lineWidth(0.7)
    .stroke()
    .restore();
  doc.moveDown(0.3);
  const tecnico: string =
    ctx.autorizacion.emitidoPor?.nombre
    ?? (ctx.solicitud.datos as Record<string, unknown>)?.nombreTecnicoAutoriza as string
    ?? "Sistema IMBIO";
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(tecnico, PAGE.margin, doc.y, { width: colWidth });
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(COLORS.muted)
    .text("Técnico que autoriza", PAGE.margin, doc.y, { width: colWidth });

  // Columna 2: ciudadano
  const yRight = y0;
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text("EL SOLICITANTE", PAGE.margin + colWidth + 40, yRight, {
      width: colWidth,
    });
  doc.y = yRight + 14;
  doc
    .save()
    .moveTo(PAGE.margin + colWidth + 40, doc.y)
    .lineTo(PAGE.margin + colWidth + 40 + colWidth, doc.y)
    .strokeColor(COLORS.text)
    .lineWidth(0.7)
    .stroke()
    .restore();
  doc.moveDown(0.3);
  const ciud = [ctx.ciudadano.nombre, ctx.ciudadano.apellidoPaterno, ctx.ciudadano.apellidoMaterno]
    .filter(Boolean)
    .join(" ");
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(ciud, PAGE.margin + colWidth + 40, doc.y, { width: colWidth });
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(COLORS.muted)
    .text("Ciudadano", PAGE.margin + colWidth + 40, doc.y, { width: colWidth });
}

/** Footer (número de página, identificador). */
export function footer(
  doc: PDFDocument,
  ctx: PdfContext,
): void {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const y = PAGE.height - 30;
    hr(doc, y, COLORS.border);
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(
        `Documento generado por el Sistema IMBIO — ${ctx.autorizacion.numeroAutorizacion}`,
        PAGE.margin,
        y + 8,
        { width: PAGE.width - PAGE.margin * 2, align: "center" },
      );
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(
        `Página ${i + 1} de ${range.count}`,
        PAGE.margin,
        y + 18,
        { width: PAGE.width - PAGE.margin * 2, align: "center" },
      );
  }
}

// =================================================================
// Helpers internos
// =================================================================

function sectionTitle(doc: PDFDocument, title: string): void {
  doc.moveDown(0.3);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.primary)
    .text(title.toUpperCase(), PAGE.margin, doc.y, {
      characterSpacing: 0.5,
    });
  doc.moveDown(0.2);
  hr(doc, doc.y, COLORS.primary);
  doc.moveDown(0.3);
}

function kvTable(
  doc: PDFDocument,
  rows: Array<[string, string]>,
): void {
  const labelW = 130;
  const valueW = PAGE.width - PAGE.margin * 2 - labelW - 8;

  for (const [label, value] of rows) {
    const y0 = doc.y;
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(label, PAGE.margin, y0, { width: labelW });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(value, PAGE.margin + labelW + 8, y0, { width: valueW });
    doc.y = Math.max(doc.y, y0 + 14);
  }
}

function formatValue(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "boolean") return raw ? "Sí" : "No";
  if (typeof raw === "string") {
    // Si parece fecha YYYY-MM-DD, formatearla
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const d = new Date(raw + "T00:00:00");
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("es-MX", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
    }
    return raw;
  }
  return JSON.stringify(raw);
}
