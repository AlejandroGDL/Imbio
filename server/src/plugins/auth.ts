/**
 * Plugin de autenticación.
 *
 * Verifica la cookie de sesión en cada request y, si es válida,
 * expone `request.user` con la información del usuario. Si no es
 * válida, responde 401.
 *
 * Se aplica a todas las rutas excepto las públicas (auth, health,
 * info, network, uploads públicos, assets).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

import { prisma } from "../prisma";
import { SESSION_COOKIE, verifyJwt } from "../lib/auth";

/** Rutas que NO requieren autenticación. */
const PUBLIC_PREFIXES = [
  "/auth",
  "/health",
  "/info",
  "/network",
];

function isPublic(url: string): boolean {
  return PUBLIC_PREFIXES.some((p) => url === p || url.startsWith(p + "/") || url.startsWith(p + "?"));
}

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: number;
      username: string;
      nombre: string;
      email: string | null;
      rol: "ADMIN" | "OPERADOR" | "TECNICO";
    };
  }
}

export const authPlugin = fp(async function authPlugin(app: FastifyInstance) {
  app.decorateRequest("user", null as any);

  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (isPublic(request.url)) return;

    const token = request.cookies[SESSION_COOKIE];
    if (!token) {
      return reply.status(401).send({
        ok: false,
        error: { code: "UNAUTHORIZED", message: "No autenticado" },
      });
    }

    const payload = verifyJwt(token);
    if (!payload) {
      return reply.status(401).send({
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Sesión inválida o expirada" },
      });
    }

    // Verificamos que el usuario siga existiendo y activo
    const user = await prisma.usuario.findUnique({
      where: { id: payload.uid },
      select: {
        id: true,
        username: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
      },
    });

    if (!user || !user.activo) {
      return reply.status(401).send({
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Usuario inactivo o eliminado" },
      });
    }

    request.user = {
      id: user.id,
      username: user.username,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
    };
  });
});
