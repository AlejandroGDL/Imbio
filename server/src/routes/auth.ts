/**
 * Rutas de autenticación.
 *
 * - POST /auth/login      → valida credenciales, setea cookie HttpOnly, devuelve usuario
 * - POST /auth/logout     → limpia la cookie
 * - GET  /auth/me         → devuelve el usuario actual (o 401 si no hay sesión)
 * - POST /auth/change-password → cambia la contraseña del usuario actual
 *
 * Las rutas /auth/* NO requieren autenticación previa (excepto /me y
 * /change-password, que sí). El resto de rutas del sistema están
 * protegidas por el plugin `authPlugin` registrado en server.ts.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";

import { prisma } from "../prisma";
import {
  hashPassword,
  setSessionCookie,
  clearSessionCookie,
  signJwt,
  verifyJwt,
  verifyPassword,
  SESSION_COOKIE,
} from "../lib/auth";
import { errors, handleError } from "../lib/errors";

// =================================================================
// Schemas
// =================================================================

const loginSchema = z.object({
  username: z.string().trim().min(1, "Usuario requerido").max(50),
  password: z.string().min(1, "Contraseña requerida").max(200),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Contraseña actual requerida"),
    newPassword: z
      .string()
      .min(8, "La nueva contraseña debe tener al menos 8 caracteres")
      .max(200, "Máximo 200 caracteres"),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "La nueva contraseña debe ser distinta de la actual",
    path: ["newPassword"],
  });

// =================================================================
// Helpers
// =================================================================

/** Devuelve el payload del usuario a partir de la cookie o null. */
async function getUserFromRequest(request: FastifyRequest) {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload) return null;
  const user = await prisma.usuario.findUnique({
    where: { id: payload.uid },
    select: {
      id: true,
      username: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      ultimoAcceso: true,
    },
  });
  if (!user || !user.activo) return null;
  return user;
}

// =================================================================
// Rutas
// =================================================================

export async function authRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // POST /auth/login
  // Rate limit estricto: 10 intentos cada 5 minutos por IP.
  // -----------------------------------------------------------------
  app.post(
    "/auth/login",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "5 minutes",
        },
      },
    },
    async (request, reply) => {
      try {
        const body = loginSchema.parse(request.body);

        // Buscar usuario por username
        const user = await prisma.usuario.findUnique({
          where: { username: body.username },
        });

        // Mensaje genérico para no filtrar si el usuario existe
        const invalidMsg = "Usuario o contraseña incorrectos";

        if (!user || !user.activo) {
          // Pequeño delay para mitigar timing attacks
          await new Promise((r) => setTimeout(r, 250));
          throw errors.unauthorized(invalidMsg);
        }

        const ok = await verifyPassword(body.password, user.passwordHash);
        if (!ok) {
          await new Promise((r) => setTimeout(r, 250));
          throw errors.unauthorized(invalidMsg);
        }

        // Firmar JWT y setear cookie
        const token = signJwt({
          uid: user.id,
          username: user.username,
          rol: user.rol,
        });
        setSessionCookie(reply, token);

        // Actualizar ultimoAcceso (fire-and-forget; no bloquea el login)
        prisma.usuario
          .update({
            where: { id: user.id },
            data: { ultimoAcceso: new Date() },
          })
          .catch((err) => request.log.warn({ err }, "No se pudo actualizar ultimoAcceso"));

        return {
          ok: true,
          data: {
            id: user.id,
            username: user.username,
            nombre: user.nombre,
            email: user.email,
            rol: user.rol,
            ultimoAcceso: user.ultimoAcceso,
          },
        };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // -----------------------------------------------------------------
  // POST /auth/logout
  // -----------------------------------------------------------------
  app.post("/auth/logout", async (_request: FastifyRequest, reply: FastifyReply) => {
    clearSessionCookie(reply);
    return reply.send({ ok: true, data: { loggedOut: true } });
  });

  // -----------------------------------------------------------------
  // GET /auth/me
  // -----------------------------------------------------------------
  app.get("/auth/me", async (request) => {
    const user = await getUserFromRequest(request);
    if (!user) throw errors.unauthorized("Sesión inválida o expirada");
    return { ok: true, data: user };
  });

  // -----------------------------------------------------------------
  // POST /auth/change-password
  // -----------------------------------------------------------------
  app.post("/auth/change-password", async (request, reply) => {
    try {
      const user = await getUserFromRequest(request);
      if (!user) throw errors.unauthorized("Sesión inválida o expirada");

      const body = changePasswordSchema.parse(request.body);

      // Traemos el hash actual
      const current = await prisma.usuario.findUnique({
        where: { id: user.id },
        select: { passwordHash: true },
      });
      if (!current) throw errors.notFound("Usuario", user.id);

      const ok = await verifyPassword(body.currentPassword, current.passwordHash);
      if (!ok) throw errors.badRequest("La contraseña actual no es correcta");

      const newHash = await hashPassword(body.newPassword);
      await prisma.usuario.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });

      return { ok: true, data: { changed: true } };
    } catch (err) {
      return handleError(reply, err);
    }
  });
}
