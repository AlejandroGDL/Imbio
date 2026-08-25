/**
 * CRUD de Vacaciones.
 *
 * Modelo: server/prisma/schema.prisma → Vacacion
 * Cada solicitud de vacaciones pertenece a un empleado (Personal)
 * vía FK. Campos: personalId, fechaInicio, fechaFin, diasSolicitados,
 * observaciones.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../prisma";
import { errors, handleError } from "../lib/errors";

// =================================================================
// Helpers
// =================================================================
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/** Calcula los días entre dos fechas (inclusive en ambos extremos). */
function diffDias(inicio: string, fin: string): number {
  const a = new Date(`${inicio}T00:00:00Z`);
  const b = new Date(`${fin}T00:00:00Z`);
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86_400_000) + 1;
}

// =================================================================
// Schemas de validación
// =================================================================
const createSchema = z
  .object({
    personalId: z.number().int().positive("Empleado requerido"),
    fechaInicio: z
      .string()
      .regex(dateRegex, "Fecha de inicio inválida (YYYY-MM-DD)"),
    fechaFin: z
      .string()
      .regex(dateRegex, "Fecha de fin inválida (YYYY-MM-DD)"),
    // Opcional: si no se envía, el backend lo calcula a partir de
    // fechaInicio/fechaFin.
    diasSolicitados: z
      .number()
      .int()
      .positive("Días solicitados debe ser un entero positivo")
      .max(365, "Máximo 365 días por solicitud")
      .optional(),
    observaciones: z
      .string()
      .trim()
      .max(500, "Máximo 500 caracteres")
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => data.fechaFin >= data.fechaInicio, {
    message: "La fecha de fin debe ser igual o posterior a la fecha de inicio",
    path: ["fechaFin"],
  });

const updateSchema = z
  .object({
    personalId: z.number().int().positive().optional(),
    fechaInicio: z.string().regex(dateRegex).optional(),
    fechaFin: z.string().regex(dateRegex).optional(),
    diasSolicitados: z
      .number()
      .int()
      .positive()
      .max(365)
      .optional(),
    observaciones: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.fechaInicio && data.fechaFin) {
        return data.fechaFin >= data.fechaInicio;
      }
      return true;
    },
    {
      message:
        "La fecha de fin debe ser igual o posterior a la fecha de inicio",
      path: ["fechaFin"],
    },
  );

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
// Helper de normalización
// =================================================================
function normalizePayload(
  body: Partial<z.infer<typeof createSchema>>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (body.personalId !== undefined) data.personalId = body.personalId;
  if (body.fechaInicio !== undefined) data.fechaInicio = new Date(body.fechaInicio);
  if (body.fechaFin !== undefined) data.fechaFin = new Date(body.fechaFin);
  if (body.diasSolicitados !== undefined) data.diasSolicitados = body.diasSolicitados;
  if (body.observaciones !== undefined) {
    data.observaciones =
      body.observaciones && body.observaciones !== "" ? body.observaciones : null;
  }
  return data;
}

// =================================================================
// Rutas
// =================================================================
export async function vacacionesRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // Listar (incluye datos del empleado)
  // -----------------------------------------------------------------
  app.get("/vacaciones", async (request, reply) => {
    try {
      const { q, personalId, desde, hasta, page, limit, activo } =
        listQuerySchema.parse(request.query);

      // Filtro por rango de fechas: la solicitud se solapa con [desde, hasta]
      // si fechaInicio <= hasta Y fechaFin >= desde.
      const where: Record<string, unknown> = {
        ...(activo === undefined ? { activo: true } : { activo }),
        ...(personalId ? { personalId } : {}),
        ...(desde || hasta
          ? {
              AND: [
                ...(hasta ? [{ fechaInicio: { lte: new Date(hasta) } }] : []),
                ...(desde ? [{ fechaFin: { gte: new Date(desde) } }] : []),
              ],
            }
          : {}),
        ...(q
          ? {
              OR: [
                { observaciones: { contains: q, mode: "insensitive" as const } },
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
        prisma.vacacion.findMany({
          where,
          orderBy: [{ fechaInicio: "desc" }, { id: "desc" }],
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
        prisma.vacacion.count({ where }),
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
    "/vacaciones/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const item = await prisma.vacacion.findUnique({
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
        if (!item) throw errors.notFound("Vacación", id);
        return { ok: true, data: item };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Helper: validar empleado y recalcular días en create/update
  // -----------------------------------------------------------------
  async function validarEmpleadoYNormalizar(
    body: Partial<z.infer<typeof createSchema>>,
    current?: { fechaInicio: Date; fechaFin: Date },
  ): Promise<Record<string, unknown>> {
    if (body.personalId !== undefined) {
      const personal = await prisma.personal.findUnique({
        where: { id: body.personalId },
        select: { id: true, activo: true },
      });
      if (!personal) {
        throw errors.badRequest(`Empleado #${body.personalId} no existe`);
      }
      if (!personal.activo) {
        throw errors.badRequest(
          `Empleado #${body.personalId} está inactivo`,
        );
      }
    }

    // Resolver fechas (combinar nuevas con actuales) y validar
    const newInicioStr = body.fechaInicio;
    const newFinStr = body.fechaFin;
    const currentInicioStr = current
      ? current.fechaInicio.toISOString().slice(0, 10)
      : undefined;
    const currentFinStr = current
      ? current.fechaFin.toISOString().slice(0, 10)
      : undefined;

    const finalInicio = newInicioStr ?? currentInicioStr;
    const finalFin = newFinStr ?? currentFinStr;

    if (finalInicio && finalFin && finalFin < finalInicio) {
      throw errors.badRequest(
        "La fecha de fin debe ser igual o posterior a la fecha de inicio",
      );
    }

    const data = normalizePayload(body);

    // Si se enviaron ambas fechas (o ya existían) y NO se envió
    // diasSolicitados, recalcular automáticamente.
    if (
      finalInicio &&
      finalFin &&
      body.diasSolicitados === undefined &&
      // solo si NO estamos en update o el update no trajo días
      (newInicioStr !== undefined || newFinStr !== undefined || current !== undefined)
    ) {
      data.diasSolicitados = diffDias(finalInicio, finalFin);
    }

    return data;
  }

  // -----------------------------------------------------------------
  // Crear
  // -----------------------------------------------------------------
  app.post("/vacaciones", async (request, reply) => {
    try {
      const body = createSchema.parse(request.body);
      const data = await validarEmpleadoYNormalizar(body);
      const created = await prisma.vacacion.create({
        data,
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
    "/vacaciones/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const body = updateSchema.parse(request.body);
        const current = await prisma.vacacion.findUnique({ where: { id } });
        if (!current) throw errors.notFound("Vacación", id);

        const data = await validarEmpleadoYNormalizar(body, current);
        const updated = await prisma.vacacion.update({
          where: { id },
          data,
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
    "/vacaciones/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        await prisma.vacacion.update({
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
