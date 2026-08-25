/**
 * CRUD de Consumibles.
 *
 * Catálogo de productos con stock (cantidadActual). El stock se
 * modifica con movimientos:
 *   - ENTRADA: cuando se surte una requisición marcada como consumible
 *     (lo hace automáticamente la ruta de requisiciones)
 *   - SALIDA: cuando se entrega a un empleado del IMBIO
 *     (endpoint POST /consumibles/:id/entregar)
 *
 * Historial de movimientos se consulta por consumible o por empleado.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../prisma";
import { errors, handleError } from "../lib/errors";
import { UNIDADES } from "./requisiciones";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// =================================================================
// Schemas
// =================================================================
const createConsumibleSchema = z.object({
  concepto: z
    .string()
    .trim()
    .min(1, "Concepto requerido")
    .max(200, "Máximo 200 caracteres"),
  unidad: z.enum(UNIDADES, { message: "Unidad inválida" }),
  cantidadActual: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
    .refine((n) => Number.isFinite(n) && n >= 0, "Cantidad debe ser ≥ 0")
    .optional()
    .default(0),
  imagen: z.string().trim().max(2000).optional().or(z.literal("")),
  observaciones: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

const updateConsumibleSchema = createConsumibleSchema.partial();

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  unidad: z.enum(UNIDADES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  activo: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

const entregarSchema = z.object({
  personalId: z.number().int().positive("Empleado requerido"),
  cantidad: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
    .refine((n) => Number.isFinite(n) && n > 0, "Cantidad debe ser mayor a 0"),
  fecha: z
    .string()
    .regex(dateRegex, "Fecha inválida (YYYY-MM-DD)")
    .optional()
    .or(z.literal("")),
  observaciones: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
});

const reponerSchema = z.object({
  cantidad: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
    .refine((n) => Number.isFinite(n) && n > 0, "Cantidad debe ser mayor a 0"),
  fecha: z
    .string()
    .regex(dateRegex, "Fecha inválida (YYYY-MM-DD)")
    .optional()
    .or(z.literal("")),
  observaciones: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
});

const movimientosQuerySchema = z.object({
  q: z.string().trim().optional(),
  personalId: z.coerce.number().int().positive().optional(),
  tipo: z.enum(["ENTRADA", "SALIDA"]).optional(),
  desde: z.string().regex(dateRegex).optional(),
  hasta: z.string().regex(dateRegex).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// =================================================================
// Rutas
// =================================================================
export async function consumiblesRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // Listar catálogo
  // -----------------------------------------------------------------
  app.get("/consumibles", async (request, reply) => {
    try {
      const { q, unidad, page, limit, activo } = listQuerySchema.parse(
        request.query,
      );

      const where = {
        ...(activo === undefined ? { activo: true } : { activo }),
        ...(unidad ? { unidad } : {}),
        ...(q
          ? {
              OR: [
                { concepto: { contains: q, mode: "insensitive" as const } },
                {
                  observaciones: { contains: q, mode: "insensitive" as const },
                },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        prisma.consumible.findMany({
          where,
          orderBy: [{ concepto: "asc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.consumible.count({ where }),
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
  // Obtener uno (incluye últimos N movimientos)
  // -----------------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    "/consumibles/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const item = await prisma.consumible.findUnique({
          where: { id },
          include: {
            movimientos: {
              orderBy: [{ fecha: "desc" }, { id: "desc" }],
              take: 50,
              include: {
                personal: {
                  select: { id: true, nombre: true, apellidos: true, puesto: true },
                },
                requisicion: { select: { id: true, numero: true } },
              },
            },
          },
        });
        if (!item) throw errors.notFound("Consumible", id);
        return { ok: true, data: item };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Crear (manual)
  // -----------------------------------------------------------------
  app.post("/consumibles", async (request, reply) => {
    try {
      const body = createConsumibleSchema.parse(request.body);

      // Verificar duplicado por (concepto, unidad)
      const dup = await prisma.consumible.findFirst({
        where: {
          concepto: { equals: body.concepto, mode: "insensitive" },
          unidad: body.unidad,
        },
      });
      if (dup) {
        throw errors.badRequest(
          `Ya existe el consumible "${dup.concepto}" (${dup.unidad})`,
        );
      }

      const created = await prisma.consumible.create({
        data: {
          concepto: body.concepto,
          unidad: body.unidad,
          cantidadActual: body.cantidadActual ?? 0,
          imagen: body.imagen && body.imagen !== "" ? body.imagen : null,
          observaciones:
            body.observaciones && body.observaciones !== ""
              ? body.observaciones
              : null,
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
    "/consumibles/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const body = updateConsumibleSchema.parse(request.body);

        const current = await prisma.consumible.findUnique({ where: { id } });
        if (!current) throw errors.notFound("Consumible", id);

        const data: Record<string, unknown> = {};
        if (body.concepto !== undefined) data.concepto = body.concepto;
        if (body.unidad !== undefined) data.unidad = body.unidad;
        if (body.cantidadActual !== undefined) {
          data.cantidadActual = body.cantidadActual;
        }
        if (body.imagen !== undefined) {
          data.imagen = body.imagen && body.imagen !== "" ? body.imagen : null;
        }
        if (body.observaciones !== undefined) {
          data.observaciones =
            body.observaciones && body.observaciones !== ""
              ? body.observaciones
              : null;
        }

        const updated = await prisma.consumible.update({ where: { id }, data });
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
    "/consumibles/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        await prisma.consumible.update({
          where: { id },
          data: { activo: false },
        });
        return { ok: true, data: { id, activo: false } };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Entregar a un empleado (registra movimiento SALIDA)
  // -----------------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    "/consumibles/:id/entregar",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const body = entregarSchema.parse(request.body);

        const consumible = await prisma.consumible.findUnique({ where: { id } });
        if (!consumible) throw errors.notFound("Consumible", id);

        if (consumible.cantidadActual.toString() === "0") {
          throw errors.badRequest("No hay stock disponible para entregar");
        }
        if (body.cantidad > Number(consumible.cantidadActual)) {
          throw errors.badRequest(
            `Stock insuficiente. Disponible: ${consumible.cantidadActual} ${consumible.unidad}`,
          );
        }

        // Verificar que el personal existe y está activo
        const personal = await prisma.personal.findUnique({
          where: { id: body.personalId },
        });
        if (!personal) throw errors.notFound("Personal", body.personalId);
        if (!personal.activo) {
          throw errors.badRequest("El empleado está inactivo");
        }

        const fecha = body.fecha && body.fecha !== "" ? new Date(body.fecha) : new Date();

        // Transacción: crear movimiento + restar del stock
        const result = await prisma.$transaction(async (tx) => {
          const mov = await tx.consumibleMovimiento.create({
            data: {
              consumibleId: id,
              tipo: "SALIDA",
              cantidad: body.cantidad,
              personalId: body.personalId,
              fecha,
              observaciones:
                body.observaciones && body.observaciones !== ""
                  ? body.observaciones
                  : null,
            },
          });
          await tx.consumible.update({
            where: { id },
            data: { cantidadActual: { decrement: body.cantidad } },
          });
          return mov;
        });

        const refreshed = await prisma.consumible.findUnique({
          where: { id },
        });
        return reply.status(201).send({ ok: true, data: { movimiento: result, consumible: refreshed } });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Reponer stock (entrada manual sin requisición)
  // -----------------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    "/consumibles/:id/reponer",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const body = reponerSchema.parse(request.body);

        const consumible = await prisma.consumible.findUnique({ where: { id } });
        if (!consumible) throw errors.notFound("Consumible", id);

        const fecha =
          body.fecha && body.fecha !== "" ? new Date(body.fecha) : new Date();

        // Transacción: crear movimiento + sumar al stock
        const result = await prisma.$transaction(async (tx) => {
          const mov = await tx.consumibleMovimiento.create({
            data: {
              consumibleId: id,
              tipo: "ENTRADA",
              cantidad: body.cantidad,
              fecha,
              observaciones:
                body.observaciones && body.observaciones !== ""
                  ? body.observaciones
                  : "Reposición manual de stock",
            },
          });
          await tx.consumible.update({
            where: { id },
            data: { cantidadActual: { increment: body.cantidad } },
          });
          return mov;
        });

        const refreshed = await prisma.consumible.findUnique({ where: { id } });
        return reply.status(201).send({
          ok: true,
          data: { movimiento: result, consumible: refreshed },
        });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Historial de movimientos (con filtros)
  // -----------------------------------------------------------------
  app.get("/consumibles/movimientos", async (request, reply) => {
    try {
      const { q, personalId, tipo, desde, hasta, page, limit } =
        movimientosQuerySchema.parse(request.query);

      const where = {
        activo: true,
        ...(tipo ? { tipo } : {}),
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
                { observaciones: { contains: q, mode: "insensitive" as const } },
                {
                  consumible: {
                    concepto: { contains: q, mode: "insensitive" as const },
                  },
                },
                {
                  personal: {
                    OR: [
                      { nombre: { contains: q, mode: "insensitive" as const } },
                      { apellidos: { contains: q, mode: "insensitive" as const } },
                      { puesto: { contains: q, mode: "insensitive" as const } },
                    ],
                  },
                },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        prisma.consumibleMovimiento.findMany({
          where,
          orderBy: [{ fecha: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
          include: {
            consumible: { select: { id: true, concepto: true, unidad: true } },
            personal: {
              select: { id: true, nombre: true, apellidos: true, puesto: true },
            },
            requisicion: { select: { id: true, numero: true } },
          },
        }),
        prisma.consumibleMovimiento.count({ where }),
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
}
