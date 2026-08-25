/**
 * Lista hardcodeada de trámites que generan un PDF de autorización.
 *
 * Por ahora sólo estos códigos. Si más adelante se quiere flexibilidad
 * total, esto puede pasar a un campo `generaPdfAutorizacion` en la tabla
 * Tramite.
 */
export const TRAMITES_CON_PDF: ReadonlySet<string> = new Set([
  "PERMISO_QUEMA",
  "PERMISO_PODA",
  "PERMISO_DERRIBO",
  "PERMISO_TRASLADO_LENA",
  "USO_CONTENEDORES",
  "SERVICIO_PODA",
  "SERVICIO_DERRIBO",
]);

/** Devuelve true si el trámite con este código debe generar PDF. */
export function debeGenerarPdf(tramiteCodigo: string): boolean {
  return TRAMITES_CON_PDF.has(tramiteCodigo);
}
