/**
 * Dispatcher principal: dado un código de trámite, genera el PDF
 * de autorización correspondiente.
 *
 * Devuelve un Buffer con el PDF listo para guardar o enviar.
 */

import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import { buildPermisoDerribo } from "./pdf-permiso-derribo";
import { buildPermisoPoda } from "./pdf-permiso-poda";
import { buildPermisoQuema } from "./pdf-permiso-quema";
import { buildPermisoTrasladoLena } from "./pdf-permiso-traslado-lena";
import { buildPermisoContenedores } from "./pdf-permiso-contenedores";
import { buildServicioDerribo } from "./pdf-servicio-derribo";
import { buildServicioPoda } from "./pdf-servicio-poda";
import { debeGenerarPdf } from "./tramites-con-pdf";
import type { PdfContext } from "./common";

export type { PdfContext } from "./common";
export { debeGenerarPdf, TRAMITES_CON_PDF } from "./tramites-con-pdf";

/**
 * Genera el PDF para el trámite indicado. Lanza error si el trámite
 * no tiene un formato PDF definido todavía.
 */
export async function generarPdfAutorizacion(
  tramiteCodigo: string,
  ctx: Omit<PdfContext, "doc">,
): Promise<Buffer> {
  if (!debeGenerarPdf(tramiteCodigo)) {
    throw new Error(`El trámite ${tramiteCodigo} no genera PDF de autorización`);
  }

  // Pre-generamos el QR aquí (async) para poder pasarlo como Buffer
  // al builder. Esto permite que el builder pinte el footer de forma
  // totalmente sincrónica, evitando problemas con bufferedPageRange +
  // switchToPage al final.
  const cadena = `IMBIO-AUT-${ctx.autorizacion.numeroAutorizacion}-${ctx.autorizacion.id ?? "x"}`;
  const qrBuffer = await QRCode.toBuffer(cadena, {
    type: "png",
    width: 200,
    margin: 1,
  });

  // pdfkit: defaults a A4 (595x842). Forzamos letter para que coincida
  // con el resto de los documentos del IMBIO.
  const doc = new PDFDocument({
    size: "LETTER",
    margins: {
      top: 54,
      bottom: 54,
      left: 54,
      right: 54,
    },
    info: {
      Title: `Autorización ${tramiteCodigo}`,
      Author: "Sistema IMBIO",
      Subject: ctx.autorizacion.numeroAutorizacion,
      CreationDate: new Date(),
    },
  });

  const fullCtx: PdfContext = { ...ctx, doc };

  switch (tramiteCodigo) {
    case "PERMISO_QUEMA":
      return buildPermisoQuema(doc, fullCtx, qrBuffer);
    case "PERMISO_PODA":
      return buildPermisoPoda(doc, fullCtx, qrBuffer);
    case "PERMISO_DERRIBO":
      return buildPermisoDerribo(doc, fullCtx, qrBuffer);
    case "PERMISO_TRASLADO_LENA":
      return buildPermisoTrasladoLena(doc, fullCtx, qrBuffer);
    case "SERVICIO_PODA":
      return buildServicioPoda(doc, fullCtx, qrBuffer);
    case "SERVICIO_DERRIBO":
      return buildServicioDerribo(doc, fullCtx, qrBuffer);
    case "USO_CONTENEDORES":
      return buildPermisoContenedores(doc, fullCtx, qrBuffer);
    default:
      throw new Error(
        `No hay generador PDF para el trámite ${tramiteCodigo}`,
      );
  }
}
