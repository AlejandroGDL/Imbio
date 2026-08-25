/**
 * CRUD de Incidencias.
 *
 * Modelo: server/prisma/schema.prisma → Incidencia
 * Cada incidencia pertenece a un empleado (Personal) vía FK.
 * Tipos: FALTA | JUSTIFICANTE | RETARDO | PERMISO_SIN_GOCE_SUELDO
 *        | PERMISO_CON_GOCE_SUELDO
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../prisma";
import { errors, handleError } from "../lib/errors";

// =================================================================
// Catálogos
// =================================================================
export const TIPOS_INCIDENCIA = [
  "FALTA",
  "JUSTIFICANTE",
  "RETARDO",
  "PERMISO_SIN_GOCE_SUELDO",
  "PERMISO_CON_GOCE_SUELDO",
] as const;

export const TIPOS_INCIDENCIA_LABEL: Record<
  (typeof TIPOS_INCIDENCIA)[number],
  string
> = {
  FALTA: "Falta",
  JUSTIFICANTE: "Justificante",
  RETARDO: "Retardo",
  PERMISO_SIN_GOCE_SUELDO: "Permiso sin goce de sueldo",
  PERMISO_CON_GOCE_SUELDO: "Permiso con goce de sueldo",
};

// =================================================================
// Schemas de validación
// =================================================================
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  personalId: z
    .number()
    .int()
    .positive("Empleado requerido"),
  tipo: z.enum(TIPOS_INCIDENCIA, {
    message: "Tipo de incidencia inválido",
  }),
  fecha: z
    .string()
    .regex(dateRegex, "Fecha inválida (YYYY-MM-DD)"),
  descripcion: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  personalId: z.coerce.number().int().positive().optional(),
  tipo: z.enum(TIPOS_INCIDENCIA).optional(),
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
  if (body.tipo !== undefined) data.tipo = body.tipo;
  if (body.fecha !== undefined) data.fecha = new Date(body.fecha);
  if (body.descripcion !== undefined) {
    data.descripcion =
      body.descripcion && body.descripcion !== "" ? body.descripcion : null;
  }
  return data;
}

// =================================================================
// Rutas
// =================================================================
export async function incidenciasRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // Catálogo de tipos
  // -----------------------------------------------------------------
  app.get("/incidencias/opciones", async () => {
    return {
      ok: true,
      data: {
        tipos: TIPOS_INCIDENCIA,
        tiposLabel: TIPOS_INCIDENCIA_LABEL,
      },
    };
  });

  // -----------------------------------------------------------------
  // Listar (incluye datos básicos del empleado)
  // -----------------------------------------------------------------
  app.get("/incidencias", async (request, reply) => {
    try {
      const { q, personalId, tipo, desde, hasta, page, limit, activo } =
        listQuerySchema.parse(request.query);

      const where = {
        ...(activo === undefined ? { activo: true } : { activo }),
        ...(personalId ? { personalId } : {}),
        ...(tipo ? { tipo } : {}),
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
                { descripcion: { contains: q, mode: "insensitive" as const } },
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
        prisma.incidencia.findMany({
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
        prisma.incidencia.count({ where }),
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
    "/incidencias/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const item = await prisma.incidencia.findUnique({
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
        if (!item) throw errors.notFound("Incidencia", id);
        return { ok: true, data: item };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Crear
  // -----------------------------------------------------------------
  app.post("/incidencias", async (request, reply) => {
    try {
      const body = createSchema.parse(request.body);

      // Verificar que el empleado exista y esté activo
      const personal = await prisma.personal.findUnique({
        where: { id: body.personalId },
        select: { id: true, activo: true },
      });
      if (!personal) {
        throw errors.badRequest(`Empleado #${body.personalId} no existe`);
      }
      if (!personal.activo) {
        throw errors.badRequest(
          `Empleado #${body.personalId} está inactivo (no se puede asignar incidencia)`,
        );
      }

      const created = await prisma.incidencia.create({
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
    "/incidencias/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const body = updateSchema.parse(request.body);
        const current = await prisma.incidencia.findUnique({ where: { id } });
        if (!current) throw errors.notFound("Incidencia", id);

        if (body.personalId !== undefined) {
          const personal = await prisma.personal.findUnique({
            where: { id: body.personalId },
            select: { id: true, activo: true },
          });
          if (!personal) {
            throw errors.badRequest(
              `Empleado #${body.personalId} no existe`,
            );
          }
          if (!personal.activo) {
            throw errors.badRequest(
              `Empleado #${body.personalId} está inactivo`,
            );
          }
        }

        const updated = await prisma.incidencia.update({
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
    "/incidencias/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        await prisma.incidencia.update({
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
