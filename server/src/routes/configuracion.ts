import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "../prisma";
import { handleError, errors } from "../lib/errors";
import { VVUMA_DEFAULT } from "../lib/precios";

// Esquema para el PATCH: cualquier subset de campos editables.
const updateSchema = z.object({
  nombreInstitucion: z.string().trim().min(1).optional(),
  direccion: z.string().trim().optional().nullable(),
  telefono: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  sitioWeb: z.string().trim().optional().nullable(),
  piePaginaAutorizacion: z.string().trim().optional().nullable(),
  // vvuma: entre 0 y 10000, con hasta 4 decimales (cabe en Decimal(10,4))
  vvuma: z
    .number()
    .nonnegative()
    .max(10000)
    .optional()
    .nullable(),
});

export async function configuracionRoutes(app: FastifyInstance) {
  /**
   * GET /configuracion
   * Devuelve la configuración del sistema. La fila es singleton (id=1);
   * si no existe todavía, la crea con defaults.
   */
  app.get("/configuracion", async (_request, reply) => {
    try {
      const config = await prisma.configuracion.upsert({
        where: { id: 1 },
        create: { id: 1, vvuma: VVUMA_DEFAULT },
        update: {},
      });
      return { ok: true, data: config };
    } catch (err) {
      return handleError(reply, err);
    }
  });

  /**
   * PATCH /configuracion
   * Actualiza uno o varios campos. Pensado principalmente para que
   * el módulo de Configuración de la UI pueda ajustar el vvuma cada
   * año (o cualquier otro parámetro).
   */
  app.patch("/configuracion", async (request, reply) => {
    try {
      const body = updateSchema.parse(request.body);

      // Aseguramos que la fila exista
      await prisma.configuracion.upsert({
        where: { id: 1 },
        create: { id: 1, vvuma: VVUMA_DEFAULT },
        update: {},
      });

      const data: Prisma.ConfiguracionUpdateInput = {};
      if (body.nombreInstitucion !== undefined) {
        data.nombreInstitucion = body.nombreInstitucion;
      }
      if (body.direccion !== undefined) data.direccion = body.direccion;
      if (body.telefono !== undefined) data.telefono = body.telefono;
      if (body.email !== undefined) data.email = body.email || null;
      if (body.sitioWeb !== undefined) data.sitioWeb = body.sitioWeb;
      if (body.piePaginaAutorizacion !== undefined) {
        data.piePaginaAutorizacion = body.piePaginaAutorizacion;
      }
      if (body.vvuma !== undefined && body.vvuma !== null) {
        data.vvuma = body.vvuma;
      }

      if (Object.keys(data).length === 0) {
        throw errors.badRequest("No se envió ningún campo para actualizar");
      }

      const updated = await prisma.configuracion.update({
        where: { id: 1 },
        data,
      });
      return { ok: true, data: updated };
    } catch (err) {
      return handleError(reply, err);
    }
  });
}
