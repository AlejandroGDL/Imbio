import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGINS: z.string().default("*"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerido"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  // Secreto para firmar los JWT. En dev se usa uno por defecto;
  // en producción es OBLIGATORIO que esté definido.
  JWT_SECRET: z.string().min(16, "JWT_SECRET debe tener al menos 16 caracteres").optional(),
  // Tiempo de vida del access token (en segundos). Default: 8h.
  JWT_EXPIRES_IN: z.coerce.number().int().positive().default(8 * 60 * 60),
  // Auto-seed al primer arranque cuando la BD está vacía.
  // - true (default): si no hay trámites/admin/config, ejecuta el seed
  // - false: nunca auto-siembra (útil si quieres control total manual)
  AUTO_SEED: z
    .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
    .optional()
    .transform((v) => v === undefined ? true : v === "true" || v === "1"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variables de entorno inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// En producción, JWT_SECRET es obligatorio.
if (parsed.data.NODE_ENV === "production" && !parsed.data.JWT_SECRET) {
  console.error("❌ En producción, JWT_SECRET es obligatorio.");
  process.exit(1);
}

export const env = {
  ...parsed.data,
  // Parsea los orígenes CORS en un array (o null para "*")
  corsOrigins: parsed.data.CORS_ORIGINS === "*"
    ? true  // true = todos los orígenes
    : parsed.data.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
  isDev: parsed.data.NODE_ENV === "development",
  isProd: parsed.data.NODE_ENV === "production",
  // Secreto efectivo: el de env, o uno por defecto (solo dev).
  jwtSecret: parsed.data.JWT_SECRET || "imbio-dev-secret-DO-NOT-USE-IN-PROD",
  jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,
};
