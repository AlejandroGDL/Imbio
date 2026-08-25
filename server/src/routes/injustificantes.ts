/**
 * CRUD de Injustificantes.
 *
 * Modelo: server/prisma/schema.prisma → Injustificante
 * Cada registro es una ausencia no justificada de un empleado.
 * Campos: personalId, fecha, razon.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../prisma";
import { errors, handleError } from "../lib/errors";

// =================================================================
// Schemas
// =================================================================
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  personalId: z.number().int().positive("Empleado requerido"),
  fecha: z.string().regex(dateRegex, "Fecha inválida (YYYY-MM-DD)"),
  razon: z
    .string()
    .trim()
    .min(1, "Razón requerida")
    .max(500, "Máximo 500 caracteres"),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  personalId: z.coerce.number().int().positive().optional(),
  desde: z.string().regex(dateRegex).optional(),
  hasta: z.string().regex(dateRegex).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  activo: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

// =================================================================
// Helper
// =================================================================
function normalizePayload(
  body: Partial<z.infer<typeof createSchema>>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (body.personalId !== undefined) data.personalId = body.personalId;
  if (body.fecha !== undefined) data.fecha = new Date(body.fecha);
  if (body.razon !== undefined) data.razon = body.razon.trim();
  return data;
}

// =================================================================
// Rutas
// =================================================================
export async function injustificantesRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // Listar (incluye datos del empleado)
  // -----------------------------------------------------------------
  app.get("/injustificantes", async (request, reply) => {
    try {
      const { q, personalId, desde, hasta, page, limit, activo } =
        listQuerySchema.parse(request.query);

      const where: Record<string, unknown> = {
        ...(activo === undefined ? { activo: true } : { activo }),
        ...(personalId ? { personalId } : {}),
        ...(desde || hasta
          ? {
              fecha: {
                ...(desde ? { gte: new Date(desde) } : {}),
                ...(hasta ? { lte: new Date(hasta) } : {}),
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { razon: { contains: q, mode: "insensitive" as const } },
                {
                  personal: {
                    nombre: { contains: q, mode: "insensitive" as const },
                  },
                },
                {
                  personal: {
                    apellidos: {
                      contains: q,
                      mode: "insensitive" as const,
                    },
                  },
                },
                {
                  personal: {
                    puesto: { contains: q, mode: "insensitive" as const },
                  },
                },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        prisma.injustificante.findMany({
          where,
          orderBy: [{ fecha: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
          include: {
            personal: {
              select: {
                id: true,
                nombre: true,
                apellidos: true,
                puesto: true,
                tipo: true,
              },
            },
          },
        }),
        prisma.injustificante.count({ where }),
      ]);

      return {
        ok: true,
        data: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // -----------------------------------------------------------------
  // Obtener uno
  // -----------------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    "/injustificantes/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const item = await prisma.injustificante.findUnique({
          where: { id },
          include: {
            personal: {
              select: {
                id: true,
                nombre: true,
                apellidos: true,
                puesto: true,
                tipo: true,
              },
            },
          },
        });
        if (!item) throw errors.notFound("Injustificante", id);
        return { ok: true, data: item };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Helper: validar empleado
  // -----------------------------------------------------------------
  async function validarEmpleadoActivo(personalId: number): Promise<void> {
    const personal = await prisma.personal.findUnique({
      where: { id: personalId },
      select: { id: true, activo: true },
    });
    if (!personal) {
      throw errors.badRequest(`Empleado #${personalId} no existe`);
    }
    if (!personal.activo) {
      throw errors.badRequest(
        `Empleado #${personalId} está inactivo (no se puede asignar injustificante)`,
      );
    }
  }

  // -----------------------------------------------------------------
  // Crear
  // -----------------------------------------------------------------
  app.post("/injustificantes", async (request, reply) => {
    try {
      const body = createSchema.parse(request.body);
      await validarEmpleadoActivo(body.personalId);

      const created = await prisma.injustificante.create({
        data: normalizePayload(body),
        include: {
          personal: {
            select: {
              id: true,
              nombre: true,
              apellidos: true,
              puesto: true,
              tipo: true,
            },
          },
        },
      });
      return reply.status(201).send({ ok: true, data: created });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // -----------------------------------------------------------------
  // Actualizar
  // -----------------------------------------------------------------
  app.patch<{ Params: { id: string } }>(
    "/injustificantes/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const body = updateSchema.parse(request.body);
        const current = await prisma.injustificante.findUnique({
          where: { id },
        });
        if (!current) throw errors.notFound("Injustificante", id);

        if (body.personalId !== undefined && body.personalId !== current.personalId) {
          await validarEmpleadoActivo(body.personalId);
        }

        const updated = await prisma.injustificante.update({
          where: { id },
          data: normalizePayload(body),
          include: {
            personal: {
              select: {
                id: true,
                nombre: true,
                apellidos: true,
                puesto: true,
                tipo: true,
              },
            },
          },
        });
        return { ok: true, data: updated };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Borrado lógico
  // -----------------------------------------------------------------
  app.delete<{ Params: { id: string } }>(
    "/injustificantes/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        await prisma.injustificante.update({
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
