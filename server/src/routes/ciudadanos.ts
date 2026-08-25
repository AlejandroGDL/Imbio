import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../prisma";
import { errors, handleError } from "../lib/errors";

const createSchema = z.object({
  curp: z.string().trim().length(18).optional().nullable(),
  nombre: z.string().trim().min(1, "Nombre requerido"),
  apellidoPaterno: z.string().trim().min(1, "Apellido paterno requerido"),
  apellidoMaterno: z.string().trim().optional().nullable(),
  telefono: z.string().trim().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  direccion: z.string().trim().optional().nullable(),
  fechaNacimiento: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional()
    .nullable(),
  notas: z.string().trim().optional().nullable(),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  activo: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export async function ciudadanosRoutes(app: FastifyInstance) {
  // Listar
  app.get("/ciudadanos", async (request, reply) => {
    try {
      const { q, page, limit, activo } = listQuerySchema.parse(request.query);

      const where = {
        // Por default solo muestra activos. Pasar activo=false para ver inactivos.
        ...(activo === undefined ? { activo: true } : { activo }),
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: "insensitive" as const } },
                {
                  apellidoPaterno: {
                    contains: q,
                    mode: "insensitive" as const,
                  },
                },
                {
                  apellidoMaterno: {
                    contains: q,
                    mode: "insensitive" as const,
                  },
                },
                { curp: { contains: q.toUpperCase() } },
                { telefono: { contains: q } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        prisma.ciudadano.findMany({
          where,
          orderBy: [{ apellidoPaterno: "asc" }, { nombre: "asc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.ciudadano.count({ where }),
      ]);

      return {
        ok: true,
        data: items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // Obtener uno
  app.get<{ Params: { id: string } }>("/ciudadanos/:id", async (request, reply) => {
    try {
      const id = Number(request.params.id);
      if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

      const ciudadano = await prisma.ciudadano.findUnique({
        where: { id },
        include: {
          solicitudes: {
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { tramite: { select: { nombre: true, codigo: true } } },
          },
        },
      });

      if (!ciudadano) throw errors.notFound("Ciudadano", id);
      return { ok: true, data: ciudadano };
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // Buscar por CURP (atajo)
  app.get<{ Params: { curp: string } }>(
    "/ciudadanos/curp/:curp",
    async (request, reply) => {
      try {
        const curp = request.params.curp.toUpperCase();
        const ciudadano = await prisma.ciudadano.findUnique({ where: { curp } });
        if (!ciudadano) throw errors.notFound("Ciudadano con CURP " + curp);
        return { ok: true, data: ciudadano };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // Crear
  app.post("/ciudadanos", async (request, reply) => {
    try {
      const body = createSchema.parse(request.body);

      const created = await prisma.ciudadano.create({
        data: {
          ...body,
          curp: body.curp ? body.curp.toUpperCase() : null,
          email: body.email === "" ? null : body.email ?? null,
          fechaNacimiento: body.fechaNacimiento
            ? new Date(body.fechaNacimiento)
            : null,
        },
      });

      return reply.status(201).send({ ok: true, data: created });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // Actualizar
  app.patch<{ Params: { id: string } }>(
    "/ciudadanos/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const body = updateSchema.parse(request.body);
        const updated = await prisma.ciudadano.update({
          where: { id },
          data: {
            ...body,
            curp:
              body.curp === undefined
                ? undefined
                : body.curp
                  ? body.curp.toUpperCase()
                  : null,
            email:
              body.email === undefined
                ? undefined
                : body.email === ""
                  ? null
                  : body.email,
            fechaNacimiento:
              body.fechaNacimiento === undefined
                ? undefined
                : body.fechaNacimiento
                  ? new Date(body.fechaNacimiento)
                  : null,
          },
        });
        return { ok: true, data: updated };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // Borrado lógico (desactivar)
  app.delete<{ Params: { id: string } }>(
    "/ciudadanos/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        await prisma.ciudadano.update({
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
