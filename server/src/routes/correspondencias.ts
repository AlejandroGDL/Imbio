/**
 * CRUD de Correspondencia.
 *
 * Documentos que entran o salen del IMBIO. Cada registro tiene:
 * - tipo: ENTRADA | SALIDA
 * - tipoDocumento: MEMORANDUM | OFICIO
 * - numero, fecha, remitente, destinatario, asunto, observaciones
 * - status: PENDIENTE | ATENDIDO | ARCHIVADO (modificable después
 *   de creado, vía PATCH o endpoint dedicado PATCH /:id/status)
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../prisma";
import { errors, handleError } from "../lib/errors";

// =================================================================
// Catálogos (también expuestos vía /correspondencias/opciones)
// =================================================================
export const TIPOS_CORRESPONDENCIA = ["ENTRADA", "SALIDA"] as const;
export const TIPOS_DOCUMENTO = ["MEMORANDUM", "OFICIO"] as const;
export const STATUS_CORRESPONDENCIA = [
  "PENDIENTE",
  "ATENDIDO",
  "ARCHIVADO",
] as const;

// =================================================================
// Schemas de validación
// =================================================================
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const baseFieldsSchema = z.object({
  tipo: z.enum(TIPOS_CORRESPONDENCIA, {
    message: "Tipo inválido (Entrada/Salida)",
  }),
  tipoDocumento: z.enum(TIPOS_DOCUMENTO, {
    message: "Tipo de documento inválido",
  }),
  numero: z
    .string()
    .trim()
    .min(1, "Número requerido")
    .max(80, "Máximo 80 caracteres"),
  fecha: z
    .string()
    .regex(dateRegex, "Fecha inválida (formato YYYY-MM-DD)"),
  remitente: z
    .string()
    .trim()
    .min(1, "Remitente requerido")
    .max(200, "Máximo 200 caracteres"),
  destinatario: z
    .string()
    .trim()
    .min(1, "Destinatario requerido")
    .max(200, "Máximo 200 caracteres"),
  asunto: z
    .string()
    .trim()
    .min(1, "Asunto requerido")
    .max(300, "Máximo 300 caracteres"),
  observaciones: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
  // ===== Notificación =====
  ocupaRespuesta: z.boolean().optional(),
  fechaMaximaRespuesta: z
    .string()
    .regex(dateRegex, "Fecha máxima de respuesta inválida (YYYY-MM-DD)")
    .optional()
    .or(z.literal("")),
  asisteAEvento: z.boolean().optional(),
  // Lista de días específicos del evento (no rango, pueden ser no consecutivos)
  fechasEvento: z
    .array(
      z
        .string()
        .regex(dateRegex, "Fecha de evento inválida (YYYY-MM-DD)"),
    )
    .optional()
    .default([]),
  // IDs del personal que debe asistir al evento
  asistentesIds: z
    .array(z.number().int().positive())
    .optional()
    .default([]),
});

// Reglas de validación cruzada (se aplican tanto en create como en update)
function notificationCrossValidation(
  data: {
    ocupaRespuesta?: boolean;
    fechaMaximaRespuesta?: string;
    asisteAEvento?: boolean;
    fechasEvento?: string[];
    asistentesIds?: number[];
  },
  ctx: z.RefinementCtx,
): void {
  // Si marca ocupaRespuesta, fechaMaximaRespuesta es obligatoria
  if (data.ocupaRespuesta === true) {
    if (!data.fechaMaximaRespuesta || data.fechaMaximaRespuesta === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fechaMaximaRespuesta"],
        message: "Requerida cuando 'Ocupa respuesta' está marcado",
      });
    }
  }
  // Si marca asisteAEvento, fechasEvento debe tener al menos 1 día
  if (data.asisteAEvento === true) {
    if (!data.fechasEvento || data.fechasEvento.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fechasEvento"],
        message: "Agrega al menos un día de evento",
      });
    }
  }
  // Deduplicar fechas (mismo día agregado 2 veces)
  if (data.fechasEvento && data.fechasEvento.length > 1) {
    const unique = Array.from(new Set(data.fechasEvento));
    if (unique.length !== data.fechasEvento.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fechasEvento"],
        message: "Hay fechas duplicadas",
      });
    }
  }
}

const createSchema = baseFieldsSchema.superRefine(notificationCrossValidation);
const updateSchema = baseFieldsSchema
  .partial()
  .superRefine(notificationCrossValidation);

const statusSchema = z.object({
  status: z.enum(STATUS_CORRESPONDENCIA, {
    message: "Status inválido",
  }),
});

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  tipo: z.enum(TIPOS_CORRESPONDENCIA).optional(),
  tipoDocumento: z.enum(TIPOS_DOCUMENTO).optional(),
  status: z.enum(STATUS_CORRESPONDENCIA).optional(),
  // Notificación — filtros exactos (true/false) o undefined
  ocupaRespuesta: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  asisteAEvento: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
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
// Helper de normalización de payload
// =================================================================
function normalizePayload(
  body: Partial<z.infer<typeof createSchema>>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (body.tipo !== undefined) data.tipo = body.tipo;
  if (body.tipoDocumento !== undefined) data.tipoDocumento = body.tipoDocumento;
  if (body.numero !== undefined) data.numero = body.numero;
  if (body.fecha !== undefined) data.fecha = new Date(body.fecha);
  if (body.remitente !== undefined) data.remitente = body.remitente;
  if (body.destinatario !== undefined) data.destinatario = body.destinatario;
  if (body.asunto !== undefined) data.asunto = body.asunto;
  if (body.observaciones !== undefined) {
    data.observaciones =
      body.observaciones && body.observaciones !== "" ? body.observaciones : null;
  }
  // ===== Notificación =====
  if (body.ocupaRespuesta !== undefined) data.ocupaRespuesta = body.ocupaRespuesta;
  if (body.fechaMaximaRespuesta !== undefined) {
    data.fechaMaximaRespuesta =
      body.fechaMaximaRespuesta && body.fechaMaximaRespuesta !== ""
        ? new Date(body.fechaMaximaRespuesta)
        : null;
  }
  if (body.asisteAEvento !== undefined) data.asisteAEvento = body.asisteAEvento;
  if (body.fechasEvento !== undefined) {
    // Mapear a Date y deduplicar (preservando orden de inserción)
    const seen = new Set<string>();
    const fechas: Date[] = [];
    for (const f of body.fechasEvento) {
      if (!seen.has(f)) {
        seen.add(f);
        fechas.push(new Date(f));
      }
    }
    // Ordenar ascendente para que la lectura sea natural
    fechas.sort((a, b) => a.getTime() - b.getTime());
    data.fechasEvento = fechas;
  }
  if (body.asistentesIds !== undefined) {
    // Deduplicar IDs de asistentes
    data.asistentesIds = Array.from(new Set(body.asistentesIds));
  }
  return data;
}

// =================================================================
// Rutas
// =================================================================
export async function correspondenciasRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // Catálogos (para alimentar selects)
  // -----------------------------------------------------------------
  app.get("/correspondencias/opciones", async () => {
    return {
      ok: true,
      data: {
        tipos: TIPOS_CORRESPONDENCIA,
        tiposDocumento: TIPOS_DOCUMENTO,
        status: STATUS_CORRESPONDENCIA,
      },
    };
  });

  // -----------------------------------------------------------------
  // Listar
  // -----------------------------------------------------------------
  app.get("/correspondencias", async (request, reply) => {
    try {
      const { q, tipo, tipoDocumento, status, desde, hasta, page, limit, activo, ocupaRespuesta, asisteAEvento } =
        listQuerySchema.parse(request.query);

      const where = {
        // Por default solo muestra activos.
        ...(activo === undefined ? { activo: true } : { activo }),
        ...(tipo ? { tipo } : {}),
        ...(tipoDocumento ? { tipoDocumento } : {}),
        ...(status ? { status } : {}),
        ...(ocupaRespuesta !== undefined ? { ocupaRespuesta } : {}),
        ...(asisteAEvento !== undefined ? { asisteAEvento } : {}),
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
                { numero: { contains: q, mode: "insensitive" as const } },
                { remitente: { contains: q, mode: "insensitive" as const } },
                { destinatario: { contains: q, mode: "insensitive" as const } },
                { asunto: { contains: q, mode: "insensitive" as const } },
                {
                  observaciones: { contains: q, mode: "insensitive" as const },
                },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        prisma.correspondencia.findMany({
          where,
          orderBy: [{ fecha: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.correspondencia.count({ where }),
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
    "/correspondencias/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const item = await prisma.correspondencia.findUnique({ where: { id } });
        if (!item) throw errors.notFound("Correspondencia", id);
        return { ok: true, data: item };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Crear (status siempre inicia en PENDIENTE)
  // -----------------------------------------------------------------
  app.post("/correspondencias", async (request, reply) => {
    try {
      const body = createSchema.parse(request.body);

      const created = await prisma.correspondencia.create({
        data: {
          ...normalizePayload(body),
          // status siempre PENDIENTE al crear (ignorar si viene)
          status: "PENDIENTE",
        },
      });
      return reply.status(201).send({ ok: true, data: created });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // -----------------------------------------------------------------
  // Actualizar (todos los campos, EXCEPTO status — ese va por su endpoint)
  // -----------------------------------------------------------------
  app.patch<{ Params: { id: string } }>(
    "/correspondencias/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const body = updateSchema.parse(request.body);
        const current = await prisma.correspondencia.findUnique({ where: { id } });
        if (!current) throw errors.notFound("Correspondencia", id);

        const updated = await prisma.correspondencia.update({
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
  // Cambiar status (endpoint dedicado, rápido de llamar)
  // -----------------------------------------------------------------
  app.patch<{ Params: { id: string } }>(
    "/correspondencias/:id/status",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const body = statusSchema.parse(request.body);
        const current = await prisma.correspondencia.findUnique({ where: { id } });
        if (!current) throw errors.notFound("Correspondencia", id);

        const updated = await prisma.correspondencia.update({
          where: { id },
          data: { status: body.status },
        });
        return { ok: true, data: updated };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Borrado lógico (desactivar)
  // -----------------------------------------------------------------
  app.delete<{ Params: { id: string } }>(
    "/correspondencias/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        await prisma.correspondencia.update({
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
