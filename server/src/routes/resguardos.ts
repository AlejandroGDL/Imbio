/**
 * CRUD de Resguardos.
 *
 * Un Resguardo es la "tarjeta de inventario" de un equipo (laptop,
 * mouse, monitor, etc.) con su imagen, marca, modelo y número de
 * serie. La asignación a un empleado se hace con POST /:id/asignar,
 * que crea un registro en el historial y actualiza el resguardo.
 * Devolver es POST /:id/devolver. Dar de baja es POST /:id/baja.
 *
 * El historial completo de un equipo se ve en GET /:id/historial.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../prisma";
import { errors, handleError } from "../lib/errors";
import type { EstadoResguardo } from "@prisma/client";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const ESTADOS_RESGUARDO: EstadoResguardo[] = [
  "EN_BODEGA",
  "ASIGNADO",
  "REPARACION",
  "BAJA",
];

// =================================================================
// Schemas
// =================================================================
const baseFieldsSchema = z.object({
  tipo: z
    .string()
    .trim()
    .min(1, "Tipo requerido (ej. LAPTOP, MOUSE, MONITOR)")
    .max(80, "Máximo 80 caracteres")
    .toUpperCase(),
  marca: z
    .string()
    .trim()
    .min(1, "Marca requerida")
    .max(80, "Máximo 80 caracteres"),
  modelo: z
    .string()
    .trim()
    .max(120, "Máximo 120 caracteres")
    .optional()
    .or(z.literal("")),
  numeroSerie: z
    .string()
    .trim()
    .min(1, "Número de serie requerido")
    .max(120, "Máximo 120 caracteres"),
  imagen: z.string().trim().max(2000).optional().or(z.literal("")),
  descripcion: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
  estado: z.enum(ESTADOS_RESGUARDO).optional(),
  observaciones: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

const createSchema = baseFieldsSchema;
const updateSchema = baseFieldsSchema.partial();

const asignarSchema = z.object({
  personalId: z.number().int().positive("Empleado requerido"),
  fechaAsignacion: z
    .string()
    .regex(dateRegex, "Fecha inválida (YYYY-MM-DD)")
    .optional()
    .or(z.literal("")),
  motivo: z
    .string()
    .trim()
    .max(200, "Máximo 200 caracteres")
    .optional()
    .or(z.literal("")),
  observaciones: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

const devolverSchema = z.object({
  fechaDevolucion: z
    .string()
    .regex(dateRegex, "Fecha inválida (YYYY-MM-DD)")
    .optional()
    .or(z.literal("")),
  motivo: z
    .string()
    .trim()
    .max(200, "Máximo 200 caracteres")
    .optional()
    .or(z.literal("")),
  observaciones: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

const bajaSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(1, "Motivo de baja requerido")
    .max(200, "Máximo 200 caracteres"),
  observaciones: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  tipo: z.string().trim().optional(),
  estado: z.enum(ESTADOS_RESGUARDO).optional(),
  personalId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  activo: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

const historialQuerySchema = z.object({
  personalId: z.coerce.number().int().positive().optional(),
  desde: z.string().regex(dateRegex).optional(),
  hasta: z.string().regex(dateRegex).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// =================================================================
// Normalize payload
// =================================================================
function normalizePayload(
  body: Partial<z.infer<typeof baseFieldsSchema>>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (body.tipo !== undefined) data.tipo = body.tipo;
  if (body.marca !== undefined) data.marca = body.marca;
  if (body.modelo !== undefined) {
    data.modelo = body.modelo && body.modelo !== "" ? body.modelo : null;
  }
  if (body.numeroSerie !== undefined) data.numeroSerie = body.numeroSerie;
  if (body.imagen !== undefined) {
    data.imagen = body.imagen && body.imagen !== "" ? body.imagen : null;
  }
  if (body.descripcion !== undefined) {
    data.descripcion =
      body.descripcion && body.descripcion !== "" ? body.descripcion : null;
  }
  if (body.estado !== undefined) data.estado = body.estado;
  if (body.observaciones !== undefined) {
    data.observaciones =
      body.observaciones && body.observaciones !== ""
        ? body.observaciones
        : null;
  }
  return data;
}

// =================================================================
// Rutas
// =================================================================
export async function resguardosRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // Catálogo
  // -----------------------------------------------------------------
  app.get("/resguardos/opciones", async () => {
    return {
      ok: true,
      data: { estados: ESTADOS_RESGUARDO },
    };
  });

  // -----------------------------------------------------------------
  // Listar (catálogo de equipos)
  // -----------------------------------------------------------------
  app.get("/resguardos", async (request, reply) => {
    try {
      const { q, tipo, estado, personalId, page, limit, activo } =
        listQuerySchema.parse(request.query);

      const where = {
        ...(activo === undefined ? { activo: true } : { activo }),
        ...(estado ? { estado } : {}),
        ...(tipo ? { tipo } : {}),
        ...(personalId ? { personalActualId: personalId } : {}),
        ...(q
          ? {
              OR: [
                { tipo: { contains: q, mode: "insensitive" as const } },
                { marca: { contains: q, mode: "insensitive" as const } },
                { modelo: { contains: q, mode: "insensitive" as const } },
                {
                  numeroSerie: { contains: q, mode: "insensitive" as const },
                },
                {
                  descripcion: { contains: q, mode: "insensitive" as const },
                },
                {
                  observaciones: { contains: q, mode: "insensitive" as const },
                },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        prisma.resguardo.findMany({
          where,
          orderBy: [{ estado: "asc" }, { createdAt: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
          include: {
            personalActual: {
              select: {
                id: true,
                nombre: true,
                apellidos: true,
                puesto: true,
              },
            },
          },
        }),
        prisma.resguardo.count({ where }),
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
    "/resguardos/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const item = await prisma.resguardo.findUnique({
          where: { id },
          include: {
            personalActual: {
              select: {
                id: true,
                nombre: true,
                apellidos: true,
                puesto: true,
              },
            },
          },
        });
        if (!item) throw errors.notFound("Resguardo", id);
        return { ok: true, data: item };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Crear
  // -----------------------------------------------------------------
  app.post("/resguardos", async (request, reply) => {
    try {
      const body = createSchema.parse(request.body);

      // Verificar número de serie único
      const dup = await prisma.resguardo.findUnique({
        where: { numeroSerie: body.numeroSerie },
      });
      if (dup) {
        throw errors.badRequest(
          `Ya existe un equipo con número de serie "${dup.numeroSerie}"`,
        );
      }

      const created = await prisma.resguardo.create({
        data: normalizePayload(body),
      });
      return reply.status(201).send({ ok: true, data: created });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // -----------------------------------------------------------------
  // Actualizar (solo info del equipo, no asignaciones)
  // -----------------------------------------------------------------
  app.patch<{ Params: { id: string } }>(
    "/resguardos/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const body = updateSchema.parse(request.body);

        const current = await prisma.resguardo.findUnique({ where: { id } });
        if (!current) throw errors.notFound("Resguardo", id);

        if (body.numeroSerie && body.numeroSerie !== current.numeroSerie) {
          const dup = await prisma.resguardo.findUnique({
            where: { numeroSerie: body.numeroSerie },
          });
          if (dup) {
            throw errors.badRequest(
              `Ya existe un equipo con número de serie "${dup.numeroSerie}"`,
            );
          }
        }

        const updated = await prisma.resguardo.update({
          where: { id },
          data: normalizePayload(body),
        });
        return { ok: true, data: updated };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Asignar a un empleado
  // -----------------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    "/resguardos/:id/asignar",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const body = asignarSchema.parse(request.body);

        const resguardo = await prisma.resguardo.findUnique({ where: { id } });
        if (!resguardo) throw errors.notFound("Resguardo", id);
        if (resguardo.estado === "BAJA") {
          throw errors.badRequest(
            "No se puede asignar un equipo dado de baja",
          );
        }
        if (resguardo.estado === "ASIGNADO") {
          throw errors.badRequest(
            "El equipo ya está asignado. Devuélvelo primero antes de reasignar.",
          );
        }

        const personal = await prisma.personal.findUnique({
          where: { id: body.personalId },
        });
        if (!personal) throw errors.notFound("Personal", body.personalId);
        if (!personal.activo) {
          throw errors.badRequest("El empleado está inactivo");
        }

        const fecha =
          body.fechaAsignacion && body.fechaAsignacion !== ""
            ? new Date(body.fechaAsignacion)
            : new Date();

        const result = await prisma.$transaction(async (tx) => {
          // Crear registro de historial
          const hist = await tx.resguardoHistorial.create({
            data: {
              resguardoId: id,
              personalId: body.personalId,
              fechaAsignacion: fecha,
              motivo:
                body.motivo && body.motivo !== "" ? body.motivo : null,
              observaciones:
                body.observaciones && body.observaciones !== ""
                  ? body.observaciones
                  : null,
            },
          });
          // Actualizar resguardo
          const upd = await tx.resguardo.update({
            where: { id },
            data: {
              estado: "ASIGNADO",
              personalActualId: body.personalId,
              fechaAsignacionActual: fecha,
            },
          });
          return { hist, upd };
        });

        return reply.status(201).send({ ok: true, data: result });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Devolver (deja el equipo en bodega)
  // -----------------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    "/resguardos/:id/devolver",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const body = devolverSchema.parse(request.body);

        const resguardo = await prisma.resguardo.findUnique({ where: { id } });
        if (!resguardo) throw errors.notFound("Resguardo", id);
        if (resguardo.estado !== "ASIGNADO") {
          throw errors.badRequest("El equipo no está asignado actualmente");
        }

        const fecha =
          body.fechaDevolucion && body.fechaDevolucion !== ""
            ? new Date(body.fechaDevolucion)
            : new Date();

        const result = await prisma.$transaction(async (tx) => {
          // Marcar fechaDevolucion en el último historial abierto
          const lastOpen = await tx.resguardoHistorial.findFirst({
            where: { resguardoId: id, fechaDevolucion: null, activo: true },
            orderBy: { fechaAsignacion: "desc" },
          });
          if (lastOpen) {
            await tx.resguardoHistorial.update({
              where: { id: lastOpen.id },
              data: {
                fechaDevolucion: fecha,
                motivo:
                  body.motivo && body.motivo !== "" ? body.motivo : null,
                observaciones:
                  body.observaciones && body.observaciones !== ""
                    ? body.observaciones
                    : null,
              },
            });
          }
          // Actualizar resguardo a EN_BODEGA
          const upd = await tx.resguardo.update({
            where: { id },
            data: {
              estado: "EN_BODEGA",
              personalActualId: null,
              fechaAsignacionActual: null,
            },
          });
          return upd;
        });

        return { ok: true, data: result };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Dar de baja
  // -----------------------------------------------------------------
  app.post<{ Params: { id: string } }>(
    "/resguardos/:id/baja",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const body = bajaSchema.parse(request.body);

        const resguardo = await prisma.resguardo.findUnique({ where: { id } });
        if (!resguardo) throw errors.notFound("Resguardo", id);
        if (resguardo.estado === "BAJA") {
          throw errors.badRequest("El equipo ya está dado de baja");
        }

        const result = await prisma.$transaction(async (tx) => {
          // Si estaba asignado, cerrar el historial
          if (resguardo.estado === "ASIGNADO") {
            const lastOpen = await tx.resguardoHistorial.findFirst({
              where: {
                resguardoId: id,
                fechaDevolucion: null,
                activo: true,
              },
              orderBy: { fechaAsignacion: "desc" },
            });
            if (lastOpen) {
              await tx.resguardoHistorial.update({
                where: { id: lastOpen.id },
                data: {
                  fechaDevolucion: new Date(),
                  motivo: `BAJA: ${body.motivo}`,
                  observaciones:
                    body.observaciones && body.observaciones !== ""
                      ? body.observaciones
                      : null,
                },
              });
            }
          }
          // Marcar como BAJA
          const upd = await tx.resguardo.update({
            where: { id },
            data: {
              estado: "BAJA",
              personalActualId: null,
              fechaAsignacionActual: null,
              observaciones: body.motivo
                ? `${resguardo.observaciones ? resguardo.observaciones + "\n" : ""}BAJA: ${body.motivo}${body.observaciones ? " — " + body.observaciones : ""}`
                : resguardo.observaciones,
            },
          });
          return upd;
        });

        return { ok: true, data: result };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Borrado lógico
  // -----------------------------------------------------------------
  app.delete<{ Params: { id: string } }>(
    "/resguardos/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        await prisma.resguardo.update({
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
  // Historial de un resguardo
  // -----------------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    "/resguardos/:id/historial",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
        const { page, limit } = historialQuerySchema.parse(request.query);

        const resguardo = await prisma.resguardo.findUnique({ where: { id } });
        if (!resguardo) throw errors.notFound("Resguardo", id);

        const [items, total] = await Promise.all([
          prisma.resguardoHistorial.findMany({
            where: { resguardoId: id, activo: true },
            orderBy: { fechaAsignacion: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            include: {
              personal: {
                select: {
                  id: true,
                  nombre: true,
                  apellidos: true,
                  puesto: true,
                },
              },
            },
          }),
          prisma.resguardoHistorial.count({
            where: { resguardoId: id, activo: true },
          }),
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
    },
  );

  // -----------------------------------------------------------------
  // Historial GLOBAL (de todos los resguardos, con filtros)
  // -----------------------------------------------------------------
  app.get("/resguardos-historial/movimientos", async (request, reply) => {
    try {
      const { personalId, desde, hasta, page, limit } =
        historialQuerySchema.parse(request.query);

      const where = {
        activo: true,
        ...(personalId ? { personalId } : {}),
        ...(desde || hasta
          ? {
              fechaAsignacion: {
                ...(desde ? { gte: new Date(desde) } : {}),
                ...(hasta ? { lte: new Date(hasta) } : {}),
              },
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        prisma.resguardoHistorial.findMany({
          where,
          orderBy: { fechaAsignacion: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            resguardo: {
              select: {
                id: true,
                tipo: true,
                marca: true,
                modelo: true,
                numeroSerie: true,
                imagen: true,
              },
            },
            personal: {
              select: {
                id: true,
                nombre: true,
                apellidos: true,
                puesto: true,
              },
            },
          },
        }),
        prisma.resguardoHistorial.count({ where }),
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
