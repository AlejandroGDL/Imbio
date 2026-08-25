import { prisma } from "../prisma";

/**
 * Genera el siguiente folio de solicitud con el formato:
 *   <SERIE>-<AÑO>-<NUMERO 6 dígitos>
 * Ej: SOL-2026-000123
 *
 * Usa una transacción para que el contador no se repita
 * si dos PCs piden folio al mismo tiempo.
 */
export async function generarFolioSolicitud(): Promise<string> {
  const anio = new Date().getFullYear();

  return await prisma.$transaction(async (tx) => {
    const config = await tx.configuracion.update({
      where: { id: 1 },
      data: { siguienteFolioSolicitud: { increment: 1 } },
    });
    const serie = config.serieFolioSolicitud || "SOL";
    const num = String(config.siguienteFolioSolicitud).padStart(6, "0");
    return `${serie}-${anio}-${num}`;
  });
}

/**
 * Genera el siguiente número de autorización.
 *   <SERIE>-<AÑO>-<NUMERO 6 dígitos>
 */
export async function generarNumeroAutorizacion(): Promise<string> {
  const anio = new Date().getFullYear();

  return await prisma.$transaction(async (tx) => {
    const config = await tx.configuracion.update({
      where: { id: 1 },
      data: { siguienteFolioAutorizacion: { increment: 1 } },
    });
    const serie = config.serieFolioAutorizacion || "AUT";
    const num = String(config.siguienteFolioAutorizacion).padStart(6, "0");
    return `${serie}-${anio}-${num}`;
  });
}

/**
 * Genera el siguiente folio de Permiso de Área Verde.
 *   <SERIE>-<NUMERO 4 dígitos>
 * Ej: CC-AV-0006
 *
 * El contador es independiente de los folios de solicitud/autorización
 * (no se reinicia cada año) y se guarda como parte del registro de
 * AreaVerde para que cada permiso tenga un folio estable.
 */
export async function generarFolioPermisoAreaVerde(): Promise<string> {
  return await prisma.$transaction(async (tx) => {
    const config = await tx.configuracion.update({
      where: { id: 1 },
      data: { siguienteFolioAreaVerde: { increment: 1 } },
    });
    const serie = config.serieFolioAreaVerde || "CC-AV";
    const num = String(config.siguienteFolioAreaVerde).padStart(4, "0");
    return `${serie}-${num}`;
  });
}
