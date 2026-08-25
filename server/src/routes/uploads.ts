/**
 * Endpoint de upload de archivos.
 *
 * POST /uploads
 *   - multipart/form-data con campo "file"
 *   - query param `?subdir=consumibles` (default: "consumibles")
 *   - Devuelve { url, filename, size, mime }
 *
 * Los archivos se guardan en server/uploads/<subdir>/ y se sirven
 * estáticamente en /uploads/<subdir>/<filename>.
 */

import type { FastifyInstance } from "fastify";

import { handleError } from "../lib/errors";
import { saveUpload, type UploadSubdir } from "../lib/uploads";

export async function uploadsRoutes(app: FastifyInstance) {
  app.post<{ Querystring: { subdir?: string } }>("/uploads", async (request, reply) => {
    try {
      // Si no viene subdir, usamos "consumibles" por compatibilidad
      const subdir = (request.query.subdir ?? "consumibles") as UploadSubdir;
      const result = await saveUpload(request, { subdir });
      return reply.status(201).send({ ok: true, data: result });
    } catch (err) {
      return handleError(reply, err);
    }
  });
}
