import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma";
import { errors, handleError } from "../lib/errors";
import { debeGenerarPdf, generarPdfAutorizacion } from "../lib/pdf";
import { calcularVencimientoContenedor } from "../lib/precios";

/**
 * Rutas para gestionar autorizaciones.
 *
 * - GET  /autorizaciones/:id          → datos completos (solicitud, ciudadano, trámite)
 * - GET  /autorizaciones/:id/pdf      → descarga/visualiza el PDF (lazy gen)
 * - PATCH /autorizaciones/:id         → edita los datos, regenera el PDF
 *
 * Como aún no tenemos autenticación, los endpoints son públicos dentro
 * de la LAN. Si después se agrega auth, basta con añadir un hook
 * `preHandler` de autenticación.
 */

// =================================================================
// Schemas
// =================================================================
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const updateAutorizacionSchema = z.object({
  // Datos dinámicos del trámite (mismos campos que Solicitud.datos).
  // Se actualizan en Solicitud.datos y se regenera el PDF con ellos.
  datos: z.record(z.any()).optional(),
  // Campos propios de la autorización
  fechaVencimiento: z
    .string()
    .regex(dateRegex, "Fecha inválida (YYYY-MM-DD)")
    .optional()
    .or(z.literal("")),
  considerandos: z.string().trim().max(2000).optional().or(z.literal("")),
  observaciones: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function autorizacionesRoutes(app: FastifyInstance) {
  /**
   * GET /autorizaciones/:id
   * Devuelve la autorización con todos los datos relacionados
   * (solicitud, ciudadano, trámite, técnico que emitió).
   * Sirve para el modo "editar" del formulario.
   */
  app.get<{ Params: { id: string } }>(
    "/autorizaciones/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const aut = await prisma.autorizacion.findUnique({
          where: { id },
          include: {
            solicitud: {
              include: {
                tramite: true,
                ciudadano: true,
              },
            },
            emitidoPor: true,
          },
        });
        if (!aut) throw errors.notFound("Autorización", id);

        // No devolver el PDF (pesado); se obtiene por GET /:id/pdf
        const { documentoPdf, ...rest } = aut;
        return {
          ok: true,
          data: {
            ...rest,
            documentoPdf: undefined,
            tienePdf: !!documentoPdf,
          },
        };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * PATCH /autorizaciones/:id
   * Edita los datos de la solicitud (campos dinámicos) y/o los campos
   * propios de la autorización. Si el trámite genera PDF, lo regenera
   * automáticamente y lo guarda.
   *
   * Útil cuando se generó una autorización con algún dato mal y hay
   * que corregirlo y volver a imprimir sin perder el número ni la fecha.
   */
  app.patch<{ Params: { id: string } }>(
    "/autorizaciones/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const body = updateAutorizacionSchema.parse(request.body);

        // Carga completa (la necesitamos para regenerar el PDF)
        const aut = await prisma.autorizacion.findUnique({
          where: { id },
          include: {
            solicitud: {
              include: {
                tramite: true,
                ciudadano: true,
              },
            },
            emitidoPor: true,
          },
        });
        if (!aut) throw errors.notFound("Autorización", id);

        // 1) Actualizar Solicitud.datos si vinieron
        if (body.datos !== undefined) {
          await prisma.solicitud.update({
            where: { id: aut.solicitudId },
            data: { datos: body.datos as object },
          });
        }

        // 2) Actualizar campos propios de la autorización
        const updateData: Record<string, unknown> = {};
        if (body.fechaVencimiento !== undefined) {
          updateData.fechaVencimiento =
            body.fechaVencimiento && body.fechaVencimiento !== ""
              ? new Date(`${body.fechaVencimiento}T00:00:00.000Z`)
              : null;
        }

        // 2b) Auto-recalcular fechaVencimiento para USO_CONTENEDORES.
        //
        // Si el trámite es USO_CONTENEDORES y el body NO mandó
        // fechaVencimiento explícita, la recalculamos en base a los
        // mesesPermiso actuales de la solicitud. Esto garantiza que
        // si el operador edita los meses del permiso, la vigencia
        // quede consistente con el nuevo periodo.
        if (
          aut.solicitud.tramite.codigo === "USO_CONTENEDORES" &&
          body.fechaVencimiento === undefined
        ) {
          // Recargar la solicitud para obtener los datos nuevos
          const solActualizada = await prisma.solicitud.findUnique({
            where: { id: aut.solicitudId },
            select: { datos: true },
          });
          const datos = (solActualizada?.datos ?? {}) as Record<string, unknown>;
          const meses = datos.mesesPermiso as number | string | null | undefined;
          // Mantenemos la fechaEmision original (no la cambiamos al
          // editar, sería raro: el permiso cuenta desde la emisión
          // original). Si se quiere otra fecha base, el operador
          // puede mandar `fechaVencimiento` explícita.
          const calculada = calcularVencimientoContenedor(
            aut.fechaEmision,
            meses,
          );
          if (calculada) {
            updateData.fechaVencimiento = calculada;
          }
        }
        if (body.considerandos !== undefined) {
          updateData.considerandos =
            body.considerandos && body.considerandos !== ""
              ? body.considerandos
              : null;
        }
        if (body.observaciones !== undefined) {
          updateData.observaciones =
            body.observaciones && body.observaciones !== ""
              ? body.observaciones
              : null;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.autorizacion.update({
            where: { id },
            data: updateData,
          });
        }

        // 3) Regenerar PDF si corresponde
        const tramiteCodigo = aut.solicitud.tramite.codigo;
        let pdfRegenerado = false;
        if (debeGenerarPdf(tramiteCodigo)) {
          // Recargar la autorización con los datos actualizados
          const autActualizada = await prisma.autorizacion.findUnique({
            where: { id },
            include: {
              solicitud: { include: { tramite: true, ciudadano: true } },
              emitidoPor: true,
            },
          });
          if (autActualizada) {
            const pdfBuffer = await generarPdfAutorizacion(tramiteCodigo, {
              tramite: autActualizada.solicitud.tramite as any,
              solicitud: {
                id: autActualizada.solicitud.id,
                folio: autActualizada.solicitud.folio,
                datos:
                  (autActualizada.solicitud.datos as Record<string, unknown> | null) ??
                  {},
              },
              autorizacion: {
                ...autActualizada,
                emitidoPor: autActualizada.emitidoPor
                  ? {
                      id: autActualizada.emitidoPor.id,
                      nombre: autActualizada.emitidoPor.nombre,
                      cargo: autActualizada.emitidoPor.cargo,
                    }
                  : null,
              },
              ciudadano: autActualizada.solicitud.ciudadano,
            });

            await prisma.autorizacion.update({
              where: { id },
              data: { documentoPdf: pdfBuffer },
            });
            pdfRegenerado = true;
            request.log.info(
              { autorizacionId: id, tramite: tramiteCodigo },
              "PDF regenerado tras edición",
            );
          }
        }

        // Devolver la autorización actualizada (sin el PDF)
        const result = await prisma.autorizacion.findUnique({
          where: { id },
          include: {
            solicitud: { include: { tramite: true, ciudadano: true } },
            emitidoPor: true,
          },
        });
        if (!result) throw errors.notFound("Autorización", id);

        const { documentoPdf, ...rest } = result;
        return {
          ok: true,
          data: {
            ...rest,
            documentoPdf: undefined,
            tienePdf: !!documentoPdf,
          },
          pdfRegenerado,
        };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  /**
   * GET /autorizaciones/:id/pdf
   * Devuelve el PDF de la autorización con el Content-Type correcto.
   *
   * Si la autorización no tiene PDF guardado, intenta generarlo
   * on-demand (lazy generation) siempre que el trámite asociado
   * esté en la lista de los que generan PDF.
   */
  app.get<{ Params: { id: string } }>(
    "/autorizaciones/:id/pdf",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const aut = await prisma.autorizacion.findUnique({
          where: { id },
          include: {
            solicitud: {
              include: {
                tramite: true,
                ciudadano: true,
              },
            },
            emitidoPor: true,
          },
        });
        if (!aut) throw errors.notFound("Autorización", id);

        if (aut.documentoPdf) {
          return enviarPdf(
            reply,
            Buffer.from(aut.documentoPdf),
            aut.numeroAutorizacion,
          );
        }

        const tramiteCodigo = aut.solicitud.tramite.codigo;
        if (!debeGenerarPdf(tramiteCodigo)) {
          throw errors.notFound(
            "PDF de autorización",
            `${aut.numeroAutorizacion} (el trámite ${tramiteCodigo} no genera PDF)`,
          );
        }

        request.log.info(
          { autorizacionId: id, tramite: tramiteCodigo },
          "Generando PDF on-demand (no estaba en BD)",
        );

        const pdfBuffer = await generarPdfAutorizacion(tramiteCodigo, {
          tramite: aut.solicitud.tramite as any,
          solicitud: {
            id: aut.solicitud.id,
            folio: aut.solicitud.folio,
            datos:
              (aut.solicitud.datos as Record<string, unknown> | null) ?? {},
          },
          autorizacion: {
            ...aut,
            emitidoPor: aut.emitidoPor
              ? {
                  id: aut.emitidoPor.id,
                  nombre: aut.emitidoPor.nombre,
                  cargo: aut.emitidoPor.cargo,
                }
              : null,
          },
          ciudadano: aut.solicitud.ciudadano,
        });

        await prisma.autorizacion.update({
          where: { id },
          data: { documentoPdf: pdfBuffer },
        });

        return enviarPdf(reply, pdfBuffer, aut.numeroAutorizacion);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}

function enviarPdf(
  reply: any,
  buffer: Buffer,
  numeroAutorizacion: string,
): any {
  return reply
    .header("Content-Type", "application/pdf")
    .header(
      "Content-Disposition",
      `inline; filename="autorizacion-${numeroAutorizacion.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf"`,
    )
    .header("Content-Length", buffer.length.toString())
    // Importante: no permitir que el navegador (ni proxies intermedios)
    // cachee el PDF. Si se regenera el documento tras una edición,
    // queremos que `window.open(url)` siempre traiga la versión más
    // reciente y no una copia vieja del cache.
    .header("Cache-Control", "no-store, no-cache, must-revalidate, private")
    .header("Pragma", "no-cache")
    .header("Expires", "0")
    .send(buffer);
}

