/**
 * CRUD de Días Económicos.
 *
 * Modelo: server/prisma/schema.prisma → DiaEconomico
 * Cada solicitud de días económicos pertenece a un empleado (Personal)
 * vía FK. RESTRICCIÓN: el empleado DEBE ser tipo SINDICALIZADO.
 * En el backend se rechaza cualquier intento de crear/actualizar
 * un registro para un empleado CONFIANZA.
 *
 * Campos:
 *   - personalId: FK a Personal (debe ser SINDICALIZADO)
 *   - anio: año de 4 dígitos
 *   - diasSolicitados: entero positivo
 *   - observaciones: opcional
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../prisma";
import { errors, handleError } from "../lib/errors";

// =================================================================
// Helpers
// =================================================================
const ANIO_MIN = 2000;
const ANIO_MAX = 2100;

const anioSchema = z
  .number()
  .int()
  .min(ANIO_MIN, `El año debe ser ≥ ${ANIO_MIN}`)
  .max(ANIO_MAX, `El año debe ser ≤ ${ANIO_MAX}`);

// =================================================================
// Schemas de validación
// =================================================================
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Días de la semana permitidos para tomar un día económico.
 * Domingo=0, Lunes=1, Martes=2, Miércoles=3, Jueves=4, Viernes=5, Sábado=6
 * Solo se permiten martes (2), miércoles (3) y jueves (4).
 */
const DIAS_PERMITIDOS = new Set([2, 3, 4]);
const NOMBRES_DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
function nombreDia(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  return NOMBRES_DIAS[d.getUTCDay()];
}

const createSchema = z
  .object({
    personalId: z.number().int().positive("Empleado requerido"),
    anio: anioSchema,
    diasSolicitados: z
      .number()
      .int()
      .positive("Días solicitados debe ser un entero positivo")
      .max(50, "Máximo 50 días por solicitud"),
    // Fechas específicas (opcional). Si se manda, debe coincidir con
    // diasSolicitados y todas deben estar dentro del año `anio`.
    fechas: z
      .array(z.string().regex(dateRegex, "Fecha inválida (YYYY-MM-DD)"))
      .max(50, "Máximo 50 fechas por registro")
      .optional(),
    observaciones: z
      .string()
      .trim()
      .max(500, "Máximo 500 caracteres")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.fechas && data.fechas.length > 0) {
      if (data.fechas.length !== data.diasSolicitados) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["diasSolicitados"],
          message: `Si mandás fechas, diasSolicitados debe ser ${data.fechas.length} (la cantidad de fechas).`,
        });
      }
      // Todas las fechas deben ser del año `anio`
      for (const f of data.fechas) {
        const yyyy = f.slice(0, 4);
        if (Number(yyyy) !== data.anio) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["fechas"],
            message: `La fecha ${f} no pertenece al año ${data.anio}`,
          });
          break;
        }
        // Solo se permiten martes, miércoles y jueves
        const dow = new Date(`${f}T00:00:00.000Z`).getUTCDay();
        if (!DIAS_PERMITIDOS.has(dow)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["fechas"],
            message: `La fecha ${f} cae ${nombreDia(f)}. Solo se permiten martes, miércoles y jueves.`,
          });
          break;
        }
      }
      // Sin duplicados
      const unique = new Set(data.fechas);
      if (unique.size !== data.fechas.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fechas"],
          message: "Hay fechas duplicadas",
        });
      }
    }
  });

const updateSchema = z
  .object({
    personalId: z.number().int().positive().optional(),
    anio: anioSchema.optional(),
    diasSolicitados: z
      .number()
      .int()
      .positive()
      .max(50)
      .optional(),
    fechas: z
      .array(z.string().regex(dateRegex, "Fecha inválida (YYYY-MM-DD)"))
      .max(50)
      .optional(),
    observaciones: z
      .string()
      .trim()
      .max(500)
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.fechas && data.fechas.length > 0) {
      if (
        data.diasSolicitados !== undefined &&
        data.fechas.length !== data.diasSolicitados
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["diasSolicitados"],
          message: `Si mandás fechas, diasSolicitados debe ser ${data.fechas.length}`,
        });
      }
      // El año: si viene `anio` lo usamos, si no, no validamos (el cliente
      // puede actualizar solo fechas sin tocar el año)
      if (data.anio !== undefined) {
        for (const f of data.fechas) {
          const yyyy = f.slice(0, 4);
          if (Number(yyyy) !== data.anio) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["fechas"],
              message: `La fecha ${f} no pertenece al año ${data.anio}`,
            });
            break;
          }
          // Solo se permiten martes, miércoles y jueves
          const dow = new Date(`${f}T00:00:00.000Z`).getUTCDay();
          if (!DIAS_PERMITIDOS.has(dow)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["fechas"],
              message: `La fecha ${f} cae ${nombreDia(f)}. Solo se permiten martes, miércoles y jueves.`,
            });
            break;
          }
        }
      }
      const unique = new Set(data.fechas);
      if (unique.size !== data.fechas.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fechas"],
          message: "Hay fechas duplicadas",
        });
      }
    }
  });

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  personalId: z.coerce.number().int().positive().optional(),
  anio: z.coerce.number().int().optional(),
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
  if (body.anio !== undefined) data.anio = body.anio;
  if (body.diasSolicitados !== undefined) data.diasSolicitados = body.diasSolicitados;
  // Si el cliente manda fechas, las convertimos a Date[] para Prisma.
  // Si vienen vacías [], no las tocamos (mantenemos las anteriores).
  if (body.fechas !== undefined) {
    data.fechas = body.fechas.map((f) => new Date(`${f}T00:00:00.000Z`));
  }
  if (body.observaciones !== undefined) {
    data.observaciones =
      body.observaciones && body.observaciones !== "" ? body.observaciones : null;
  }
  return data;
}

// =================================================================
// Helper: validar que el empleado sea SINDICALIZADO y esté activo
// =================================================================
async function validarEmpleadoSindicalizado(
  personalId: number,
): Promise<void> {
  const personal = await prisma.personal.findUnique({
    where: { id: personalId },
    select: { id: true, activo: true, tipo: true, nombre: true, apellidos: true },
  });
  if (!personal) {
    throw errors.badRequest(`Empleado #${personalId} no existe`);
  }
  if (!personal.activo) {
    throw errors.badRequest(
      `Empleado #${personalId} (${personal.nombre} ${personal.apellidos}) está inactivo`,
    );
  }
  if (personal.tipo !== "SINDICALIZADO") {
    throw errors.badRequest(
      `Los días económicos son exclusivos para empleados SINDICALIZADOS. ` +
        `El empleado #${personalId} es de tipo CONFIANZA.`,
    );
  }
}

// =================================================================
// Rutas
// =================================================================
export async function diasEconomicosRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // Listar (incluye datos del empleado)
  // -----------------------------------------------------------------
  app.get("/dias-economicos", async (request, reply) => {
    try {
      const { q, personalId, anio, page, limit, activo } =
        listQuerySchema.parse(request.query);

      const where: Record<string, unknown> = {
        ...(activo === undefined ? { activo: true } : { activo }),
        ...(personalId ? { personalId } : {}),
        ...(anio ? { anio } : {}),
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
        prisma.diaEconomico.findMany({
          where,
          orderBy: [{ anio: "desc" }, { id: "desc" }],
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
        prisma.diaEconomico.count({ where }),
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
    "/dias-economicos/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const item = await prisma.diaEconomico.findUnique({
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
        if (!item) throw errors.notFound("Día económico", id);
        return { ok: true, data: item };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Crear
  // -----------------------------------------------------------------
  app.post("/dias-economicos", async (request, reply) => {
    try {
      const body = createSchema.parse(request.body);
      await validarEmpleadoSindicalizado(body.personalId);

      const created = await prisma.diaEconomico.create({
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
    "/dias-economicos/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

      const body = updateSchema.parse(request.body);
        const current = await prisma.diaEconomico.findUnique({ where: { id } });
        if (!current) throw errors.notFound("Día económico", id);

        // Si se cambia el empleado, validar el nuevo
        if (body.personalId !== undefined && body.personalId !== current.personalId) {
          await validarEmpleadoSindicalizado(body.personalId);
        }

        const updated = await prisma.diaEconomico.update({
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
    "/dias-economicos/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        await prisma.diaEconomico.update({
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
