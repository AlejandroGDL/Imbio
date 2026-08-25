/**
 * CRUD de Requisiciones.
 *
 * Cada requisición es un pedido al área de compras.
 * Si se marca como "Surtido" Y como "Es Consumible", al guardar
 * (crear o actualizar) se crea automáticamente un movimiento de
 * ENTRADA en el catálogo de Consumibles (creando el consumible si
 * no existía). La referencia al movimiento creado se guarda en
 * `consumibleMovimientoId` para evitar duplicar si el usuario
 * edita varias veces.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../prisma";
import { errors, handleError } from "../lib/errors";
import type { Unidad } from "@prisma/client";

// =================================================================
// Catálogos
// =================================================================
export const UNIDADES = [
  "PIEZA",
  "LITRO",
  "GALON",
  "KILO",
  "CAJA",
  "ROLLO",
  "PAQUETE",
] as const;

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// =================================================================
// Schemas
// =================================================================
const baseFieldsSchema = z.object({
  numero: z
    .string()
    .trim()
    .min(1, "N° de Requisición requerido")
    .max(40, "Máximo 40 caracteres"),
  concepto: z
    .string()
    .trim()
    .min(1, "Concepto requerido")
    .max(200, "Máximo 200 caracteres"),
  cantidad: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
    .refine((n) => Number.isFinite(n) && n > 0, "Cantidad debe ser mayor a 0"),
  unidad: z.enum(UNIDADES, { message: "Unidad inválida" }),
  partida: z
    .string()
    .trim()
    .min(1, "Partida requerida")
    .max(100, "Máximo 100 caracteres"),
  fechaSolicitud: z
    .string()
    .regex(dateRegex, "Fecha inválida (YYYY-MM-DD)"),
  observaciones: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
  surtido: z.boolean().optional(),
  fechaEntrega: z
    .string()
    .regex(dateRegex, "Fecha de entrega inválida (YYYY-MM-DD)")
    .optional()
    .or(z.literal("")),
  esConsumible: z.boolean().optional(),
});

function crossValidation(
  data: {
    surtido?: boolean;
    fechaEntrega?: string;
  },
  ctx: z.RefinementCtx,
): void {
  if (data.surtido === true) {
    if (!data.fechaEntrega || data.fechaEntrega === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fechaEntrega"],
        message: "Requerida cuando 'Surtido' está marcado",
      });
    }
  }
}

const createSchema = baseFieldsSchema.superRefine(crossValidation);
const updateSchema = baseFieldsSchema.partial().superRefine(crossValidation);

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  surtido: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  esConsumible: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  unidad: z.enum(UNIDADES).optional(),
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
  body: Partial<z.infer<typeof baseFieldsSchema>>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (body.numero !== undefined) data.numero = body.numero;
  if (body.concepto !== undefined) data.concepto = body.concepto;
  if (body.cantidad !== undefined) data.cantidad = body.cantidad;
  if (body.unidad !== undefined) data.unidad = body.unidad;
  if (body.partida !== undefined) data.partida = body.partida;
  if (body.fechaSolicitud !== undefined) {
    data.fechaSolicitud = new Date(body.fechaSolicitud);
  }
  if (body.observaciones !== undefined) {
    data.observaciones =
      body.observaciones && body.observaciones !== "" ? body.observaciones : null;
  }
  if (body.surtido !== undefined) data.surtido = body.surtido;
  if (body.fechaEntrega !== undefined) {
    data.fechaEntrega =
      body.fechaEntrega && body.fechaEntrega !== ""
        ? new Date(body.fechaEntrega)
        : null;
  }
  if (body.esConsumible !== undefined) data.esConsumible = body.esConsumible;
  return data;
}

// =================================================================
// Lógica de surtido → consumible
// =================================================================
/**
 * Si la requisición surtida y es consumible, crea (si no existe) el
 * Consumible y registra un movimiento de ENTRADA. Si ya se había
 * creado un movimiento (consumibleMovimientoId), no duplica.
 */
async function syncConsumibleMovimiento(
  req: {
    id: number;
    concepto: string;
    cantidad: number;
    unidad: Unidad;
    esConsumible: boolean;
    surtido: boolean;
    consumibleMovimientoId: number | null;
  },
): Promise<{ consumibleMovimientoId: number | null }> {
  // No aplica: no es consumible o no está surtido
  if (!req.esConsumible || !req.surtido) {
    return { consumibleMovimientoId: null };
  }
  // Ya existe: no duplicar
  if (req.consumibleMovimientoId) {
    return { consumibleMovimientoId: req.consumibleMovimientoId };
  }

  // Buscar o crear el consumible (case-insensitive en concepto)
  const conceptoNorm = req.concepto.trim();
  let consumible = await prisma.consumible.findFirst({
    where: {
      concepto: { equals: conceptoNorm, mode: "insensitive" },
      unidad: req.unidad,
    },
  });
  if (!consumible) {
    consumible = await prisma.consumible.create({
      data: {
        concepto: conceptoNorm,
        unidad: req.unidad,
        cantidadActual: 0,
      },
    });
  }

  // Crear movimiento de ENTRADA
  const mov = await prisma.consumibleMovimiento.create({
    data: {
      consumibleId: consumible.id,
      tipo: "ENTRADA",
      cantidad: req.cantidad,
      requisicionId: req.id,
      observaciones: `Entrada automática desde requisición #${req.id}`,
    },
  });

  // Sumar al stock
  await prisma.consumible.update({
    where: { id: consumible.id },
    data: { cantidadActual: { increment: req.cantidad } },
  });

  // Vincular la requisición con el movimiento
  await prisma.requisicion.update({
    where: { id: req.id },
    data: { consumibleMovimientoId: mov.id },
  });

  return { consumibleMovimientoId: mov.id };
}

// =================================================================
// Rutas
// =================================================================
export async function requisicionesRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // Catálogo
  // -----------------------------------------------------------------
  app.get("/requisiciones/opciones", async () => {
    return {
      ok: true,
      data: { unidades: UNIDADES },
    };
  });

  // -----------------------------------------------------------------
  // Listar
  // -----------------------------------------------------------------
  app.get("/requisiciones", async (request, reply) => {
    try {
      const { q, surtido, esConsumible, unidad, desde, hasta, page, limit, activo } =
        listQuerySchema.parse(request.query);

      const where = {
        ...(activo === undefined ? { activo: true } : { activo }),
        ...(surtido !== undefined ? { surtido } : {}),
        ...(esConsumible !== undefined ? { esConsumible } : {}),
        ...(unidad ? { unidad } : {}),
        ...(desde || hasta
          ? {
              fechaSolicitud: {
                ...(desde ? { gte: new Date(desde) } : {}),
                ...(hasta ? { lte: new Date(hasta) } : {}),
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { numero: { contains: q, mode: "insensitive" as const } },
                { concepto: { contains: q, mode: "insensitive" as const } },
                { partida: { contains: q, mode: "insensitive" as const } },
                {
                  observaciones: { contains: q, mode: "insensitive" as const },
                },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        prisma.requisicion.findMany({
          where,
          orderBy: [{ fechaSolicitud: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.requisicion.count({ where }),
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
  // Obtener una
  // -----------------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    "/requisiciones/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const item = await prisma.requisicion.findUnique({ where: { id } });
        if (!item) throw errors.notFound("Requisición", id);
        return { ok: true, data: item };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Crear
  // -----------------------------------------------------------------
  app.post("/requisiciones", async (request, reply) => {
    try {
      const body = createSchema.parse(request.body);

      // Verificar que el número no exista (el unique del modelo ya lo
      // atrapa, pero el mensaje de error queda más claro así)
      const dup = await prisma.requisicion.findUnique({
        where: { numero: body.numero },
      });
      if (dup) throw errors.badRequest(`Ya existe la requisición #${body.numero}`);

      const created = await prisma.requisicion.create({
        data: normalizePayload(body),
      });

      // Sincronizar consumible si aplica
      await syncConsumibleMovimiento({
        id: created.id,
        concepto: created.concepto,
        cantidad: Number(created.cantidad),
        unidad: created.unidad,
        esConsumible: created.esConsumible,
        surtido: created.surtido,
        consumibleMovimientoId: created.consumibleMovimientoId,
      });

      const refreshed = await prisma.requisicion.findUnique({
        where: { id: created.id },
      });
      return reply.status(201).send({ ok: true, data: refreshed });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // -----------------------------------------------------------------
  // Actualizar
  // -----------------------------------------------------------------
  app.patch<{ Params: { id: string } }>(
    "/requisiciones/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const body = updateSchema.parse(request.body);

        const current = await prisma.requisicion.findUnique({ where: { id } });
        if (!current) throw errors.notFound("Requisición", id);

        // Si se cambia el número, validar duplicado
        if (body.numero && body.numero !== current.numero) {
          const dup = await prisma.requisicion.findUnique({
            where: { numero: body.numero },
          });
          if (dup) {
            throw errors.badRequest(`Ya existe la requisición #${body.numero}`);
          }
        }

        const updated = await prisma.requisicion.update({
          where: { id },
          data: normalizePayload(body),
        });

        // Sincronizar consumible (idempotente — no duplica)
        await syncConsumibleMovimiento({
          id: updated.id,
          concepto: updated.concepto,
          cantidad: Number(updated.cantidad),
          unidad: updated.unidad,
          esConsumible: updated.esConsumible,
          surtido: updated.surtido,
          consumibleMovimientoId: updated.consumibleMovimientoId,
        });

        const refreshed = await prisma.requisicion.findUnique({
          where: { id: updated.id },
        });
        return { ok: true, data: refreshed };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Borrado lógico
  // -----------------------------------------------------------------
  app.delete<{ Params: { id: string } }>(
    "/requisiciones/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        await prisma.requisicion.update({
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
