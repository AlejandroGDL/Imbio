/**
 * Sirve los assets estáticos del backend (logos, firmas, etc.).
 *
 * Por ahora expone los archivos de server/src/lib/pdf/assets/* que ya
 * usan los builders de PDF de las autorizaciones. Esto permite que el
 * frontend (en particular el Memorandum HTML) pueda mostrar los mismos
 * logotipos que las autorizaciones.
 *
 * Whitelist explícita para no exponer archivos sensibles por accidente.
 * Los assets reales viven en server/src/lib/pdf/assets/ (gitignored los
 * originales; los PNGs son los institucionales del IMBIO).
 */

import type { FastifyInstance } from "fastify";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { errors, handleError } from "../lib/errors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta al directorio de assets: server/src/lib/pdf/assets/
// Como este archivo está en server/src/routes/, hay que subir 2 niveles.
const ASSETS_DIR = resolve(__dirname, "..", "lib", "pdf", "assets");

// Whitelist de archivos que se pueden servir. Agregar aquí cualquier
// nuevo logo o firma que deba ser accesible desde el frontend.
const ALLOWED_FILES: Record<string, { file: string; mime: string }> = {
  "logo_ayuntamiento.png": {
    file: "logo_ayuntamiento.png",
    mime: "image/png",
  },
  "firma_director_imbio.png": {
    file: "firma_director_imbio.png",
    mime: "image/png",
  },
};

export async function assetsRoutes(app: FastifyInstance) {
  app.get<{ Params: { filename: string } }>(
    "/assets/:filename",
    async (request, reply) => {
      try {
        const { filename } = request.params;

        // Seguridad: solo caracteres alfanuméricos, guion bajo, guion y punto
        if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
          throw errors.badRequest("Nombre de archivo inválido");
        }

        // Whitelist: solo los archivos permitidos
        const allowed = ALLOWED_FILES[filename];
        if (!allowed) {
          throw errors.notFound("Asset", filename);
        }

        const fullPath = resolve(ASSETS_DIR, allowed.file);

        // Por si las dudas, validar que sigue dentro de ASSETS_DIR
        if (!fullPath.startsWith(ASSETS_DIR)) {
          throw errors.badRequest("Ruta inválida");
        }

        // Verificar que el archivo existe
        await stat(fullPath);

        // Leer y devolver
        const buffer = await readFile(fullPath);
        reply
          .header("Content-Type", allowed.mime)
          .header("Content-Length", String(buffer.length))
          .header("Cache-Control", "public, max-age=86400") // 24h
          .send(buffer);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
