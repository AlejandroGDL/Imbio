/**
 * Helper para guardar archivos subidos (uploads locales).
 *
 * Los archivos se guardan en server/uploads/<subdir>/ con un nombre
 * único basado en timestamp + random, y se sirven estáticamente en
 * /uploads/<subdir>/<nombre>.
 *
 * Uso típico:
 *   const result = await saveUpload(request, "consumibles");
 *   // result = { url: "/uploads/consumibles/abc123.jpg", filename, size }
 */

import { randomBytes } from "node:crypto";
import { extname, join, resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { FastifyRequest } from "fastify";

// =================================================================
// Constantes
// =================================================================
export const UPLOADS_ROOT = resolve(process.cwd(), "uploads");
export const PUBLIC_PREFIX = "/uploads";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/** Subcarpetas válidas (para evitar path traversal) */
const ALLOWED_SUBDIRS = ["consumibles", "resguardos", "personal"] as const;
export type UploadSubdir = (typeof ALLOWED_SUBDIRS)[number];

// =================================================================
// Errores específicos de upload
// =================================================================
export class UploadError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

// =================================================================
// API principal
// =================================================================
export interface SaveUploadOptions {
  /** Campo del form-data. Default: "file" */
  field?: string;
  /** Subcarpeta bajo uploads/ */
  subdir: UploadSubdir;
}

export interface SaveUploadResult {
  /** URL pública para guardar en BD y usar en <img src=...> */
  url: string;
  /** Nombre del archivo en disco */
  filename: string;
  /** Tamaño en bytes */
  size: number;
  /** MIME original */
  mime: string;
}

/**
 * Lee el archivo enviado en `request` y lo guarda en disco.
 * Lanza UploadError si hay problemas de validación.
 */
export async function saveUpload(
  request: FastifyRequest,
  options: SaveUploadOptions,
): Promise<SaveUploadResult> {
  const { field = "file", subdir } = options;

  if (!ALLOWED_SUBDIRS.includes(subdir)) {
    throw new UploadError(`Subcarpeta inválida: ${subdir}`, 400);
  }

  // Fastify parsea multipart en request.file (si el content-type es multipart)
  const file = await request.file().catch(() => null);
  if (!file) {
    throw new UploadError("No se envió ningún archivo", 400);
  }

  // Validar nombre del campo (algunos clientes envían 'file' con mayúsculas)
  if (file.fieldname !== field) {
    // No es error fatal, solo informativo
  }

  // Validar MIME
  const ext = ALLOWED_MIME[file.mimetype];
  if (!ext) {
    throw new UploadError(
      `Tipo de archivo no permitido: ${file.mimetype}. Solo imágenes (jpg, png, webp, gif).`,
      400,
    );
  }

  // Validar tamaño (leer a buffer para conocer el tamaño)
  const buffer = await file.toBuffer();
  if (buffer.length === 0) {
    throw new UploadError("El archivo está vacío", 400);
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    const mb = (MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0);
    throw new UploadError(
      `El archivo excede el máximo de ${mb} MB`,
      413,
    );
  }

  // Generar nombre único
  const timestamp = Date.now();
  const random = randomBytes(6).toString("hex");
  const filename = `${timestamp}-${random}${ext}`;

  // Crear carpeta si no existe
  const dir = join(UPLOADS_ROOT, subdir);
  await mkdir(dir, { recursive: true });

  // Guardar en disco
  const filepath = join(dir, filename);
  await writeFile(filepath, buffer);

  return {
    url: `${PUBLIC_PREFIX}/${subdir}/${filename}`,
    filename,
    size: buffer.length,
    mime: file.mimetype,
  };
}
