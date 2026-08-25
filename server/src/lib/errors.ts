/**
 * Helpers para respuestas de error consistentes en toda la API.
 */
import type { FastifyReply } from "fastify";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const errors = {
  notFound: (entity: string, id?: number | string) =>
    new ApiError(404, id ? `${entity} #${id} no encontrado` : `${entity} no encontrado`, "NOT_FOUND"),
  badRequest: (message: string, details?: unknown) =>
    new ApiError(400, message, "BAD_REQUEST", details),
  conflict: (message: string) => new ApiError(409, message, "CONFLICT"),
  unauthorized: (message = "No autenticado") =>
    new ApiError(401, message, "UNAUTHORIZED"),
  forbidden: (message = "Sin permisos para esta acción") =>
    new ApiError(403, message, "FORBIDDEN"),
  internal: (message = "Error interno del servidor") =>
    new ApiError(500, message, "INTERNAL"),
};

/**
 * Handler central de errores para Fastify.
 */
export function handleError(reply: FastifyReply, error: unknown) {
  if (error instanceof ApiError) {
    return reply.status(error.statusCode).send({
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  // Error de Prisma: clave única duplicada
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  ) {
    return reply.status(409).send({
      ok: false,
      error: {
        code: "DUPLICATE",
        message: "Ya existe un registro con esos datos únicos",
        details: (error as { meta?: unknown }).meta,
      },
    });
  }

  // Error de Prisma: registro no encontrado
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: string }).code === "P2025"
  ) {
    return reply.status(404).send({
      ok: false,
      error: { code: "NOT_FOUND", message: "Registro no encontrado" },
    });
  }

  // Cualquier otro error → 500
  reply.log.error(error);
  return reply.status(500).send({
    ok: false,
    error: {
      code: "INTERNAL",
      message: error instanceof Error ? error.message : "Error interno",
    },
  });
}
