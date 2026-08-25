/**
 * CRUD de Áreas Verdes.
 *
 * Modelo: server/prisma/schema.prisma → AreaVerde
 *
 * La lista predefinida de áreas verdes válidas está acá. Se usa
 * en el endpoint GET /areas-verdes/opciones (para alimentar el
 * select del formulario) y en la validación del POST/PATCH.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../prisma";
import { errors, handleError } from "../lib/errors";

// =================================================================
// Catálogo de Áreas Verdes
// =================================================================
export const AREAS_VERDES_OPCIONES = [
  "Parque Infantil Morelos",
  "Parque Francisco Villa",
  "Jardín Juárez",
  "Parque Chaneques",
  "Parque Fracc. Popular",
  "Parque Cosmos 3",
  "Parque Cosmos 2",
  "Parque Progreso Sur",
  "Parque de la Plutarco",
  "Parque de Béisbol",
  "Unidad Deportiva",
  "Jardín Principal",
  "Otro",
] as const;

// =================================================================
// Catálogo de Tipos de Evento
// =================================================================
export const TIPOS_EVENTO_OPCIONES = [
  "Social",
  "Cultural",
  "Deportivo",
  "Educativo",
  "Religioso",
  "Otro",
] as const;

// =================================================================
// Schemas de validación
// =================================================================

// Acepta "HH:MM" en formato 24h
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const telRegex = /^\d{10}$/;

const createSchema = z.object({
  areaVerde: z
    .string()
    .trim()
    .min(1, "Selecciona un área verde")
    .refine(
      (v) => (AREAS_VERDES_OPCIONES as readonly string[]).includes(v),
      "Área verde no válida",
    ),
  // Ubicación específica dentro del área (esquina, sector, etc.).
  ubicacion: z
    .string()
    .trim()
    .min(1, "Ubicación requerida")
    .max(200, "Máximo 200 caracteres"),
  usuario: z
    .string()
    .trim()
    .min(1, "Usuario / institución requerido")
    .max(160, "Máximo 160 caracteres"),
  tipoEvento: z
    .string()
    .trim()
    .min(1, "Selecciona un tipo de evento")
    .refine(
      (v) => (TIPOS_EVENTO_OPCIONES as readonly string[]).includes(v),
      "Tipo de evento no válido",
    ),
  fecha: z
    .string()
    .regex(dateRegex, "Fecha inválida (formato YYYY-MM-DD)"),
  horaInicio: z
    .string()
    .regex(timeRegex, "Hora de inicio inválida (formato HH:MM 24h)"),
  horaFin: z
    .string()
    .regex(timeRegex, "Hora de fin inválida (formato HH:MM 24h)"),
  // Hora de montaje (cuando llegan a armar). Requerido.
  horaMontaje: z
    .string()
    .regex(timeRegex, "Hora de montaje inválida (formato HH:MM 24h)"),
  // Hora de desmontaje (cuando retiran todo). Requerido.
  horaDesmontaje: z
    .string()
    .regex(timeRegex, "Hora de desmontaje inválida (formato HH:MM 24h)"),
  responsable: z
    .string()
    .trim()
    .min(1, "Responsable requerido")
    .max(160, "Máximo 160 caracteres"),
  telefono: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || telRegex.test(v),
      "Teléfono inválido (10 dígitos)",
    ),
  observaciones: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

const updateSchema = createSchema.partial();

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  areaVerde: z.string().trim().optional(),
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
  if (body.areaVerde !== undefined) data.areaVerde = body.areaVerde;
  if (body.ubicacion !== undefined) {
    data.ubicacion =
      body.ubicacion && body.ubicacion !== "" ? body.ubicacion : null;
  }
  if (body.usuario !== undefined) data.usuario = body.usuario;
  if (body.tipoEvento !== undefined) data.tipoEvento = body.tipoEvento;
  if (body.fecha !== undefined) data.fecha = new Date(body.fecha);
  if (body.horaInicio !== undefined) data.horaInicio = body.horaInicio;
  if (body.horaFin !== undefined) data.horaFin = body.horaFin;
  if (body.horaMontaje !== undefined) {
    data.horaMontaje =
      body.horaMontaje && body.horaMontaje !== "" ? body.horaMontaje : null;
  }
  if (body.horaDesmontaje !== undefined) {
    data.horaDesmontaje =
      body.horaDesmontaje && body.horaDesmontaje !== ""
        ? body.horaDesmontaje
        : null;
  }
  if (body.responsable !== undefined) data.responsable = body.responsable;
  if (body.telefono !== undefined) {
    data.telefono = body.telefono && body.telefono !== "" ? body.telefono : null;
  }
  if (body.observaciones !== undefined) {
    data.observaciones =
      body.observaciones && body.observaciones !== "" ? body.observaciones : null;
  }
  return data;
}

// =================================================================
// Rutas
// =================================================================
export async function areasVerdesRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // Catálogo de áreas verdes (para alimentar el select)
  // -----------------------------------------------------------------
  app.get("/areas-verdes/opciones", async () => {
    return { ok: true, data: AREAS_VERDES_OPCIONES };
  });

  // -----------------------------------------------------------------
  // Listar
  // -----------------------------------------------------------------
  app.get("/areas-verdes", async (request, reply) => {
    try {
      const { q, areaVerde, desde, hasta, page, limit, activo } =
        listQuerySchema.parse(request.query);

      const where = {
        // Por default solo muestra activos. Pasar activo=false para ver inactivos.
        ...(activo === undefined ? { activo: true } : { activo }),
        ...(areaVerde ? { areaVerde } : {}),
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
                { usuario: { contains: q, mode: "insensitive" as const } },
                { responsable: { contains: q, mode: "insensitive" as const } },
                { tipoEvento: { contains: q, mode: "insensitive" as const } },
                { areaVerde: { contains: q, mode: "insensitive" as const } },
                { telefono: { contains: q } },
                { observaciones: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        prisma.areaVerde.findMany({
          where,
          orderBy: [{ fecha: "desc" }, { horaInicio: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.areaVerde.count({ where }),
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
    "/areas-verdes/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const item = await prisma.areaVerde.findUnique({ where: { id } });
        if (!item) throw errors.notFound("Área verde", id);
        return { ok: true, data: item };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // Crear
  // -----------------------------------------------------------------
  app.post("/areas-verdes", async (request, reply) => {
    try {
      const body = createSchema.parse(request.body);

      // Validación cruzada: horaFin debe ser > horaInicio
      if (body.horaFin <= body.horaInicio) {
        throw errors.badRequest("La hora de fin debe ser posterior a la hora de inicio");
      }
      // Validación cruzada: horaDesmontaje debe ser > horaMontaje
      if (body.horaDesmontaje <= body.horaMontaje) {
        throw errors.badRequest(
          "La hora de desmontaje debe ser posterior a la hora de montaje",
        );
      }

      const created = await prisma.areaVerde.create({
        data: normalizePayload(body) as any,
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
    "/areas-verdes/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const body = updateSchema.parse(request.body);
        const current = await prisma.areaVerde.findUnique({ where: { id } });
        if (!current) throw errors.notFound("Área verde", id);

        // Validación cruzada: horaFin > horaInicio (combinando actual + nuevo)
        const nextInicio = body.horaInicio ?? current.horaInicio;
        const nextFin = body.horaFin ?? current.horaFin;
        if (nextFin <= nextInicio) {
          throw errors.badRequest(
            "La hora de fin debe ser posterior a la hora de inicio",
          );
        }
        // Validación cruzada: horaDesmontaje > horaMontaje
        const nextMontaje = body.horaMontaje ?? current.horaMontaje;
        const nextDesmontaje =
          body.horaDesmontaje ?? current.horaDesmontaje;
        if (nextMontaje && nextDesmontaje && nextDesmontaje <= nextMontaje) {
          throw errors.badRequest(
            "La hora de desmontaje debe ser posterior a la hora de montaje",
          );
        }

        const updated = await prisma.areaVerde.update({
          where: { id },
          data: normalizePayload(body) as any,
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
    "/areas-verdes/:id",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        await prisma.areaVerde.update({
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
  // Generar PDF del permiso (lazy gen + caché en BD)
  // -----------------------------------------------------------------
  // - La primera vez que se pide, genera un folio "CC-AV-####" y lo
  //   guarda en `AreaVerde.folioPermiso` (único).
  // - Las siguientes peticiones devuelven el mismo PDF (mismo folio,
  //   misma fecha de emisión).
  app.get<{ Params: { id: string } }>(
    "/areas-verdes/:id/permiso/pdf",
    async (request, reply) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");

        const av = await prisma.areaVerde.findUnique({ where: { id } });
        if (!av) throw errors.notFound("Área verde", id);

        // Si no tiene folio, lo generamos ahora.
        let folio = av.folioPermiso;
        if (!folio) {
          const { generarFolioPermisoAreaVerde } = await import(
            "../lib/folios"
          );
          folio = await generarFolioPermisoAreaVerde();
          await prisma.areaVerde.update({
            where: { id },
            data: { folioPermiso: folio },
          });
        }

        // Cargar la configuración (director del IMBIO para la firma)
        const config = await prisma.configuracion.findUnique({
          where: { id: 1 },
        });
        const directorNombre =
          (config?.nombreInstitucion &&
            (await prisma.personal.findFirst({
              where: { puesto: { contains: "Director", mode: "insensitive" } },
              orderBy: { id: "asc" },
            }))) ||
          null;
        // Si no encontramos un Director en Personal, usamos un
        // nombre hardcodeado (el del PDF de referencia).
        const directorFinal = directorNombre
          ? directorNombre.nombre
          : "LUIS FELIPE LOZANO ROMÁN";

        // Generar QR con la cadena de seguridad
        const { default: QRCode } = await import("qrcode");
        const cadena = `IMBIO-PERM-AV-${folio}-${id}-${Date.now().toString(36)}`;
        const qrBuffer = await QRCode.toBuffer(cadena, {
          type: "png",
          width: 200,
          margin: 1,
        });

        // Cargar el PDF builder
        const { buildPermisoAreaVerde } = await import(
          "../lib/pdf/pdf-permiso-area-verde"
        );
        const { default: PDFDocument } = await import("pdfkit");

        const doc = new PDFDocument({
          size: "LETTER",
          margins: {
            top: 24,
            bottom: 18,
            left: 50,
            right: 50,
          },
          info: {
            Title: `Permiso Área Verde ${folio}`,
            Author: "Sistema IMBIO",
            Subject: folio,
          },
        });

        // Usar el mismo formato de respuesta que el PDF de
        // autorizaciones: enviar el buffer con Content-Type pdf.
        // Cache-Control: no-store para que el navegador no sirva
        // un PDF cacheado.
        const buffer = await buildPermisoAreaVerde(doc as any, {
          folio,
          fechaEmision: new Date(), // primera vez = ahora; subsecuentes = misma fecha
          cadena,
          areaVerde: av.areaVerde,
          ubicacion: av.ubicacion || "",
          usuario: av.usuario,
          tipoEvento: av.tipoEvento,
          fecha: av.fecha,
          horaInicio: av.horaInicio,
          horaFin: av.horaFin,
          horaMontaje: av.horaMontaje || av.horaInicio,
          horaDesmontaje: av.horaDesmontaje || av.horaFin,
          telefono: av.telefono,
          responsable: av.responsable,
          observaciones: av.observaciones,
          emitidoPor: { nombre: "Administrador del Sistema" },
          directorNombre: directorFinal,
          qrBuffer,
        });

        reply
          .header("Content-Type", "application/pdf")
          .header(
            "Content-Disposition",
            `inline; filename="permiso-${folio.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf"`,
          )
          .header("Content-Length", buffer.length.toString())
          .header("Cache-Control", "no-store, no-cache, must-revalidate, private")
          .header("Pragma", "no-cache")
          .header("Expires", "0")
          .send(buffer);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
