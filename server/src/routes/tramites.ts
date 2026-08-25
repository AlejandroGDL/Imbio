import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../prisma";
import { errors, handleError } from "../lib/errors";

const listQuerySchema = z.object({
  categoria: z.enum(["PERMISO", "SERVICIO", "SANCION"]).optional(),
  activo: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  q: z.string().trim().optional(),
});

const createSchema = z.object({
  codigo: z.string().trim().min(2).max(50),
  nombre: z.string().trim().min(1),
  descripcion: z.string().trim().optional().nullable(),
  categoria: z.enum(["PERMISO", "SERVICIO", "SANCION"]),
  campos: z.array(z.record(z.any())).min(1, "Debe definir al menos un campo"),
  precioBase: z.number().nonnegative().optional().nullable(),
  reglaPrecio: z.record(z.any()).optional().nullable(),
  requierePago: z.boolean().default(true),
  // Si no se envía al crear, se asume true (visible en el wizard).
  // En el PATCH, se puede activar/desactivar explícitamente.
  activo: z.boolean().optional(),
  orden: z.number().int().default(0),
});

const updateSchema = createSchema.partial();

export async function tramitesRoutes(app: FastifyInstance) {
  // Listar catálogo
  app.get("/tramites", async (request, reply) => {
    try {
      const { categoria, activo, q } = listQuerySchema.parse(request.query);
      const where = {
        ...(categoria ? { categoria } : {}),
        ...(activo === undefined ? {} : { activo }),
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: "insensitive" as const } },
                { codigo: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const items = await prisma.tramite.findMany({
        where,
        orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      });
      return { ok: true, data: items };
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // Obtener uno
  app.get<{ Params: { idOrCodigo: string } }>(
    "/tramites/:idOrCodigo",
    async (request, reply) => {
      try {
        const key = request.params.idOrCodigo;
        const where = Number.isFinite(Number(key))
          ? { id: Number(key) }
          : { codigo: key.toUpperCase() };
        const tramite = await prisma.tramite.findUnique({ where });
        if (!tramite) throw errors.notFound("Trámite", key);
        return { ok: true, data: tramite };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // Crear (para que el operador pueda agregar nuevos trámites desde Configuración)
  app.post("/tramites", async (request, reply) => {
    try {
      const body = createSchema.parse(request.body);
      const created = await prisma.tramite.create({
        data: {
          ...body,
          // Default: activo = true al crear si no se especifica.
          activo: body.activo ?? true,
          codigo: body.codigo.toUpperCase(),
        } as any,
      });
      return reply.status(201).send({ ok: true, data: created });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // Actualizar
  app.patch<{ Params: { id: string } }>(
    "/tramites/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const body = updateSchema.parse(request.body);
        const updated = await prisma.tramite.update({
          where: { id },
          data: {
            ...body,
            codigo: body.codigo ? body.codigo.toUpperCase() : undefined,
          } as any,
        });
        return { ok: true, data: updated };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // Desactivar
  app.delete<{ Params: { id: string } }>(
    "/tramites/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        await prisma.tramite.update({
          where: { id },
          data: { activo: false },
        });
        return { ok: true, data: { id, activo: false } };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
