/**
 * Rutas de gestión de usuarios (solo ADMIN).
 *
 * - GET    /usuarios           → lista
 * - POST   /usuarios           → crear (con password)
 * - PATCH  /usuarios/:id       → actualizar datos / resetear password
 * - DELETE /usuarios/:id       → desactivar (borrado lógico)
 *
 * Seguridad:
 * - Todas las rutas requieren sesión (protegidas por authPlugin).
 * - Además, se valida que `request.user.rol === "ADMIN"`.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";

import { prisma } from "../prisma";
import { hashPassword } from "../lib/auth";
import { errors, handleError } from "../lib/errors";

const rolEnum = z.enum(["ADMIN", "OPERADOR", "TECNICO"]);

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(50, "Máximo 50 caracteres")
    .regex(/^[a-zA-Z0-9._-]+$/, "Solo letras, números, . _ -"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(200, "Máximo 200 caracteres"),
  nombre: z.string().trim().min(1, "Nombre requerido").max(120),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(120)
    .optional()
    .or(z.literal("")),
  rol: rolEnum,
  activo: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  nombre: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  rol: rolEnum.optional(),
  activo: z.boolean().optional(),
  // Solo ADMIN puede cambiar passwords ajenos
  password: z.string().min(8).max(200).optional(),
});

const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  rol: rolEnum.optional(),
  activo: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

function requireAdmin(request: FastifyRequest) {
  if (!request.user) throw errors.unauthorized("No autenticado");
  if (request.user.rol !== "ADMIN") {
    throw errors.forbidden("Solo administradores pueden gestionar usuarios");
  }
}

export async function usuariosRoutes(app: FastifyInstance) {
  // Todas las rutas requieren ADMIN
  app.addHook("preHandler", async (request: FastifyRequest, _reply: FastifyReply) => {
    requireAdmin(request);
  });

  // -----------------------------------------------------------------
  // Listar
  // -----------------------------------------------------------------
  app.get("/usuarios", async (request, reply) => {
    try {
      const { q, rol, activo, page, limit } = listQuerySchema.parse(request.query);
      const where = {
        ...(rol ? { rol } : {}),
        ...(activo === undefined ? {} : { activo }),
        ...(q
          ? {
              OR: [
                { username: { contains: q, mode: "insensitive" as const } },
                { nombre: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        prisma.usuario.findMany({
          where,
          orderBy: [{ activo: "desc" }, { nombre: "asc" }],
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            username: true,
            nombre: true,
            email: true,
            rol: true,
            activo: true,
            ultimoAcceso: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.usuario.count({ where }),
      ]);
      return {
        ok: true,
        data: items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // -----------------------------------------------------------------
  // Obtener uno
  // -----------------------------------------------------------------
  app.get<{ Params: { id: string } }>("/usuarios/:id", async (request, reply) => {
    try {
      const id = Number(request.params.id);
      if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
      const user = await prisma.usuario.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          nombre: true,
          email: true,
          rol: true,
          activo: true,
          ultimoAcceso: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!user) throw errors.notFound("Usuario", id);
      return { ok: true, data: user };
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // -----------------------------------------------------------------
  // Crear
  // -----------------------------------------------------------------
  app.post("/usuarios", async (request, reply) => {
    try {
      const body = createSchema.parse(request.body);
      const passwordHash = await hashPassword(body.password);
      const user = await prisma.usuario.create({
        data: {
          username: body.username,
          passwordHash,
          nombre: body.nombre,
          email: body.email && body.email !== "" ? body.email : null,
          rol: body.rol,
          activo: body.activo ?? true,
        },
        select: {
          id: true,
          username: true,
          nombre: true,
          email: true,
          rol: true,
          activo: true,
          ultimoAcceso: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return reply.status(201).send({ ok: true, data: user });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // -----------------------------------------------------------------
  // Actualizar
  // -----------------------------------------------------------------
  app.patch<{ Params: { id: string } }>("/usuarios/:id", async (request, reply) => {
    try {
      const id = Number(request.params.id);
      if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
      const body = updateSchema.parse(request.body);
      const current = await prisma.usuario.findUnique({ where: { id } });
      if (!current) throw errors.notFound("Usuario", id);

      // No permitir que el admin se desactive a sí mismo
      if (request.user && request.user.id === id && body.activo === false) {
        throw errors.badRequest("No puedes desactivarte a ti mismo");
      }
      if (request.user && request.user.id === id && body.rol && body.rol !== "ADMIN") {
        throw errors.badRequest("No puedes cambiar tu propio rol");
      }

      const data: Record<string, unknown> = {};
      if (body.nombre !== undefined) data.nombre = body.nombre;
      if (body.email !== undefined) data.email = body.email && body.email !== "" ? body.email : null;
      if (body.rol !== undefined) data.rol = body.rol;
      if (body.activo !== undefined) data.activo = body.activo;
      if (body.password) data.passwordHash = await hashPassword(body.password);

      const updated = await prisma.usuario.update({
        where: { id },
        data,
        select: {
          id: true,
          username: true,
          nombre: true,
          email: true,
          rol: true,
          activo: true,
          ultimoAcceso: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return { ok: true, data: updated };
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // -----------------------------------------------------------------
  // Desactivar
  // -----------------------------------------------------------------
  app.delete<{ Params: { id: string } }>("/usuarios/:id", async (request, reply) => {
    try {
      const id = Number(request.params.id);
      if (!Number.isFinite(id)) throw errors.badRequest("ID inválido");
      if (request.user && request.user.id === id) {
        throw errors.badRequest("No puedes desactivarte a ti mismo");
      }
      await prisma.usuario.update({
        where: { id },
        data: { activo: false },
      });
      return { ok: true, data: { id, activo: false } };
    } catch (err) {
      return handleError(reply, err);
    }
  });
}
