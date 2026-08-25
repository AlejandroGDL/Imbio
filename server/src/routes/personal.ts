/**
 * CRUD de Personal (empleados del IMBIO).
 *
 * Modelo: server/prisma/schema.prisma → Personal
 *
 * El frontend organiza el formulario en tabs:
 *   - Datos personales
 *   - Licencia de manejo
 *   - Puesto
 *
 * El backend recibe un solo payload y lo guarda como una unidad.
 * Si tieneLicencia es false, las fechas de la licencia se ignoran.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../prisma";
import { errors, handleError } from "../lib/errors";

// =================================================================
// Catálogo
// =================================================================
export const TIPOS_PERSONAL = ["CONFIANZA", "SINDICALIZADO"] as const;

// =================================================================
// Schemas de validación
// =================================================================
const curpRegex = /^[A-Z]{4}\d{6}[A-Z]{6}[A-Z0-9]{2}$/;
const telRegex = /^\d{10}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, "Nombre requerido")
      .max(80, "Máximo 80 caracteres"),
    apellidos: z
      .string()
      .trim()
      .min(1, "Apellidos requeridos")
      .max(160, "Máximo 160 caracteres"),
    curp: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || curpRegex.test(v),
        "CURP inválida (formato: 4 letras, 6 dígitos, 6 letras, 2 alfanuméricos)",
      ),
    fechaNacimiento: z
      .string()
      .regex(dateRegex, "Fecha de nacimiento inválida (YYYY-MM-DD)")
      .optional()
      .or(z.literal("")),
    telefono: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || telRegex.test(v),
        "Teléfono inválido (10 dígitos)",
      ),
    domicilio: z
      .string()
      .trim()
      .max(500, "Máximo 500 caracteres")
      .optional()
      .or(z.literal("")),
    sabeManejar: z.boolean().default(false),
    tieneLicencia: z.boolean().default(false),
    fechaExpedicionLicencia: z
      .string()
      .regex(dateRegex, "Fecha de expedición inválida (YYYY-MM-DD)")
      .optional()
      .or(z.literal("")),
    fechaExpiracionLicencia: z
      .string()
      .regex(dateRegex, "Fecha de expiración inválida (YYYY-MM-DD)")
      .optional()
      .or(z.literal("")),
    puesto: z
      .string()
      .trim()
      .min(1, "Puesto requerido")
      .max(120, "Máximo 120 caracteres"),
    fechaIngreso: z
      .string()
      .regex(dateRegex, "Fecha de ingreso inválida (YYYY-MM-DD)"),
    tipo: z.enum(TIPOS_PERSONAL, {
      message: "Tipo inválido (Confianza/Sindicalizado)",
    }),
    // Foto: ruta absoluta devuelta por el upload (ej. "/uploads/personal/abc.jpg")
    foto: z
      .string()
      .max(300, "Máximo 300 caracteres")
      .nullable()
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      // Si tiene licencia, exigir fechas de expedición/expiración y
      // que expiración sea posterior a expedición.
      if (!data.tieneLicencia) return true;
      if (!data.fechaExpedicionLicencia || !data.fechaExpiracionLicencia) {
        return false;
      }
      return data.fechaExpiracionLicencia > data.fechaExpedicionLicencia;
    },
    {
      message:
        "Si tiene licencia, debe capturar fecha de expedición y expiración (expiración posterior a expedición)",
      path: ["fechaExpiracionLicencia"],
    },
  );

// Schema parcial reutilizando solo el shape del objeto (sin refine),
// porque .partial() no funciona después de un .refine().
const updateSchema = z.object({
  nombre: z.string().trim().min(1).max(80).optional(),
  apellidos: z.string().trim().min(1).max(160).optional(),
  curp: z.string().trim().toUpperCase().optional().or(z.literal("")),
  fechaNacimiento: z.string().regex(dateRegex).optional().or(z.literal("")),
  telefono: z.string().trim().optional().or(z.literal("")),
  domicilio: z.string().trim().max(500).optional().or(z.literal("")),
  sabeManejar: z.boolean().optional(),
  tieneLicencia: z.boolean().optional(),
  fechaExpedicionLicencia: z.string().regex(dateRegex).optional().or(z.literal("")),
  fechaExpiracionLicencia: z.string().regex(dateRegex).optional().or(z.literal("")),
  puesto: z.string().trim().min(1).max(120).optional(),
  fechaIngreso: z.string().regex(dateRegex).optional(),
  tipo: z.enum(TIPOS_PERSONAL).optional(),
  // Foto: ruta absoluta devuelta por el upload (ej. "/uploads/personal/abc.jpg")
  // o null para borrarla explícitamente.
  foto: z
    .string()
    .max(300, "Máximo 300 caracteres")
    .nullable()
    .optional()
    .or(z.literal("")),
});

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  tipo: z.enum(TIPOS_PERSONAL).optional(),
  puesto: z.string().trim().optional(),
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

  if (body.nombre !== undefined) data.nombre = body.nombre;
  if (body.apellidos !== undefined) data.apellidos = body.apellidos;
  if (body.curp !== undefined) {
    data.curp = body.curp && body.curp !== "" ? body.curp.toUpperCase() : null;
  }
  if (body.fechaNacimiento !== undefined) {
    data.fechaNacimiento =
      body.fechaNacimiento && body.fechaNacimiento !== ""
        ? new Date(body.fechaNacimiento)
        : null;
  }
  if (body.telefono !== undefined) {
    data.telefono = body.telefono && body.telefono !== "" ? body.telefono : null;
  }
  if (body.domicilio !== undefined) {
    data.domicilio = body.domicilio && body.domicilio !== "" ? body.domicilio : null;
  }
  if (body.sabeManejar !== undefined) data.sabeManejar = body.sabeManejar;
  if (body.tieneLicencia !== undefined) data.tieneLicencia = body.tieneLicencia;
  if (body.puesto !== undefined) data.puesto = body.puesto;
  if (body.fechaIngreso !== undefined) data.fechaIngreso = new Date(body.fechaIngreso);
  if (body.tipo !== undefined) data.tipo = body.tipo;
  if (body.foto !== undefined) {
    // "" o null ⇒ borrar la foto; cualquier string ⇒ persistir
    data.foto =
      body.foto && body.foto !== "" ? body.foto : null;
  }

  // Si el body NO envía fechas pero la licencia efectiva (nuevo
  // valor o valor actual) es true, mantenemos las fechas existentes
  // (no las tocamos). Si tieneLicencia efectivo es false, limpiamos
  // ambas fechas. Si envía fechas, las respetamos tal cual.
  const licenciaEfectiva =
    body.tieneLicencia !== undefined ? body.tieneLicencia : undefined;
  if (licenciaEfectiva === false) {
    data.fechaExpedicionLicencia = null;
    data.fechaExpiracionLicencia = null;
  } else {
    if (body.fechaExpedicionLicencia !== undefined) {
      data.fechaExpedicionLicencia =
        body.fechaExpedicionLicencia && body.fechaExpedicionLicencia !== ""
          ? new Date(body.fechaExpedicionLicencia)
          : null;
    }
    if (body.fechaExpiracionLicencia !== undefined) {
      data.fechaExpiracionLicencia =
        body.fechaExpiracionLicencia && body.fechaExpiracionLicencia !== ""
          ? new Date(body.fechaExpiracionLicencia)
          : null;
    }
  }

  return data;
}

// =================================================================
// Rutas
// =================================================================
export async function personalRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // Catálogo de tipos
  // -----------------------------------------------------------------
  app.get("/personal/opciones", async () => {
    return { ok: true, data: { tipos: TIPOS_PERSONAL } };
  });

  // -----------------------------------------------------------------
  // Listar
  // -----------------------------------------------------------------
  app.get("/personal", async (request, reply) => {
    try {
      const { q, tipo, puesto, page, limit, activo } =
        listQuerySchema.parse(request.query);

      const where = {
        // Por default solo muestra activos.
        ...(activo === undefined ? { activo: true } : { activo }),
        ...(tipo ? { tipo } : {}),
        ...(puesto ? { puesto: { contains: puesto, mode: "insensitive" as const } } : {}),
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: "insensitive" as const } },
                { apellidos: { contains: q, mode: "insensitive" as const } },
                { curp: { contains: q.toUpperCase() } },
                { puesto: { contains: q, mode: "insensitive" as const } },
                { telefono: { contains: q } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        prisma.personal.findMany({
          where,
          orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.personal.count({ where }),
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
    "/personal/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const item = await prisma.personal.findUnique({ where: { id } });
        if (!item) throw errors.notFound("Personal", id);
        return { ok: true, data: item };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Crear
  // -----------------------------------------------------------------
  app.post("/personal", async (request, reply) => {
    try {
      const body = createSchema.parse(request.body);

      const created = await prisma.personal.create({
        data: normalizePayload(body) as never,
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
    "/personal/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const body = updateSchema.parse(request.body);
        const current = await prisma.personal.findUnique({ where: { id } });
        if (!current) throw errors.notFound("Personal", id);

        // Re-validar licencia con la combinación actual + nuevo payload
        const nextTieneLicencia = body.tieneLicencia ?? current.tieneLicencia;
        const nextFechaExp =
          body.fechaExpedicionLicencia !== undefined
            ? body.fechaExpedicionLicencia
            : current.fechaExpedicionLicencia
              ? current.fechaExpedicionLicencia.toISOString().slice(0, 10)
              : "";
        const nextFechaVenc =
          body.fechaExpiracionLicencia !== undefined
            ? body.fechaExpiracionLicencia
            : current.fechaExpiracionLicencia
              ? current.fechaExpiracionLicencia.toISOString().slice(0, 10)
              : "";
        if (nextTieneLicencia) {
          if (!nextFechaExp || !nextFechaVenc) {
            throw errors.badRequest(
              "Si tiene licencia, debe capturar fecha de expedición y expiración",
            );
          }
          if (nextFechaVenc <= nextFechaExp) {
            throw errors.badRequest(
              "La fecha de expiración debe ser posterior a la de expedición",
            );
          }
        }

        const updated = await prisma.personal.update({
          where: { id },
          data: normalizePayload(body) as never,
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
    "/personal/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        await prisma.personal.update({
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
