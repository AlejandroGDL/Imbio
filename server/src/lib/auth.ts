/**
 * Utilidades de autenticación.
 *
 * - Hash de contraseñas con bcrypt (12 rounds).
 * - Firma/verificación de JWT firmado con HS256.
 * - Helpers para crear/limpiar cookies HttpOnly+Secure+SameSite.
 *
 * El token JWT se envía al cliente en una cookie HttpOnly llamada
 * `imbio_token` que el navegador incluye automáticamente en
 * cada request. El frontend NO manipula el token directamente.
 */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { FastifyReply } from "fastify";

import { env } from "../env";

export const BCRYPT_ROUNDS = 12;

/** Nombre de la cookie de sesión. */
export const SESSION_COOKIE = "imbio_token";

/** Payload firmado dentro del JWT. */
export interface JwtPayload {
  /** ID del usuario (PK en tabla Usuario). */
  uid: number;
  /** Username (útil para logs). */
  username: string;
  /** Rol del usuario (ADMIN, OPERADOR, TECNICO). */
  rol: "ADMIN" | "OPERADOR" | "TECNICO";
}

// =================================================================
// Password hashing
// =================================================================

/** Genera un hash bcrypt de la contraseña. */
export async function hashPassword(plain: string): Promise<string> {
  if (typeof plain !== "string" || plain.length === 0) {
    throw new Error("La contraseña no puede estar vacía");
  }
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Compara una contraseña en texto plano contra un hash bcrypt. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

// =================================================================
// JWT
// =================================================================

/** Firma un payload y devuelve el JWT. */
export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: env.jwtExpiresIn,
  });
}

/** Verifica un JWT y devuelve el payload o null. */
export function verifyJwt(token: string): JwtPayload | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
    }) as JwtPayload;
    if (typeof decoded !== "object" || !decoded.uid || !decoded.rol) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

// =================================================================
// Cookies
// =================================================================

/**
 * Setea la cookie de sesión. HttpOnly + SameSite=Lax para
 * que el browser no la exponga al JS. Secure solo en producción
 * (porque en LAN local no hay HTTPS).
 */
export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    // expiresIn viene en segundos (jsonwebtoken). Lo pasamos a ms.
    maxAge: env.jwtExpiresIn,
  });
}

/** Limpia la cookie de sesión. */
export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, {
    path: "/",
  });
}
