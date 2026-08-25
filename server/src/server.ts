import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import { resolve } from "node:path";

import { env } from "./env";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { authPlugin } from "./plugins/auth";
import { ciudadanosRoutes } from "./routes/ciudadanos";
import { tramitesRoutes } from "./routes/tramites";
import { solicitudesRoutes } from "./routes/solicitudes";
import { configuracionRoutes } from "./routes/configuracion";
import { autorizacionesRoutes } from "./routes/autorizaciones";
import { areasVerdesRoutes } from "./routes/areas-verdes";
import { correspondenciasRoutes } from "./routes/correspondencias";
import { personalRoutes } from "./routes/personal";
import { incidenciasRoutes } from "./routes/incidencias";
import { vacacionesRoutes } from "./routes/vacaciones";
import { diasEconomicosRoutes } from "./routes/dias-economicos";
import { injustificantesRoutes } from "./routes/injustificantes";
import { requisicionesRoutes } from "./routes/requisiciones";
import { consumiblesRoutes } from "./routes/consumibles";
import { resguardosRoutes } from "./routes/resguardos";
import { dashboardRoutes } from "./routes/dashboard";
import { uploadsRoutes } from "./routes/uploads";
import { usuariosRoutes } from "./routes/usuarios";
import { assetsRoutes } from "./routes/assets";
import { UPLOADS_ROOT } from "./lib/uploads";

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(env.isDev
        ? {
            transport: {
              target: "pino-pretty",
              options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
            },
          }
        : {}),
    },
    // Trust proxy si lo corres detrás de nginx
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024, // 10MB (por si guardan PDFs)
  });

  // Plugins
  await app.register(sensible);
  await app.register(fastifyCookie, {
    secret: env.jwtSecret, // Para signed cookies (no usamos de momento)
  });
  await app.register(cors, {
    origin: env.corsOrigins, // true en LAN = todos
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true, // Importante: permite enviar/recibir cookies
    // Permitir cualquier header (Authorization, X-Requested-With, custom, etc.)
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
    // Exponer headers útiles al cliente
    exposedHeaders: ["Content-Length", "Content-Type"],
    // Cache del preflight: 1 hora
    maxAge: 3600,
  });

  // Header crítico para LAN: permite que el navegador haga fetch a una IP
  // privada (192.168.x.x) desde otro origen. Sin este header, Chrome/Edge
  // recientes bloquean la petición en silencio. Se manda también en preflight.
  app.addHook("onSend", async (_request, reply) => {
    reply.header("Access-Control-Allow-Private-Network", "true");
  });
  // Soporte para multipart/form-data (subida de archivos)
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  });
  // Rate limit global. El endpoint /auth/login tiene su propio
  // rate-limit más estricto (ver routes/auth.ts).
  await app.register(fastifyRateLimit, {
    max: 300,
    timeWindow: "1 minute",
    // No aplicar a health/info/uploads de assets (archivos estáticos)
    allowList: (request) =>
      request.url.startsWith("/health") ||
      request.url.startsWith("/info") ||
      request.url.startsWith("/network") ||
      request.url.startsWith("/uploads/"),
  });
  // Servir archivos subidos (imágenes de consumibles, etc.) en /uploads/*
  await app.register(fastifyStatic, {
    root: resolve(UPLOADS_ROOT),
    prefix: "/uploads/",
    decorateReply: false,
  });

  // Hook: loguear cada request
  app.addHook("onRequest", async (request) => {
    request.log.info(
      { method: request.method, url: request.url, ip: request.ip },
      "→ request",
    );
  });

  // ================================================================
  // Auto-seed en el primer arranque (solo si la BD está vacía)
  // ================================================================
  // Si la PC es nueva y la BD no tiene datos, sembramos el catálogo
  // de trámites, técnico de ejemplo y usuario admin por defecto.
  // Controlado por AUTO_SEED env var (default: true).
  // ================================================================
  if (env.AUTO_SEED) {
    try {
      // Import dinámico para no cargar bcrypt/seed en cada request
      const { autoSeedIfEmpty } = await import("../prisma/seed");
      const result = await autoSeedIfEmpty();
      if (result === "seeded") {
        app.log.info("🌱 Auto-seed ejecutado: la BD estaba vacía y se inicializó.");
      } else if (result === "skipped") {
        app.log.info("✓ Auto-seed omitido: la BD ya tiene datos.");
      } else {
        app.log.warn("⚠️  Auto-seed falló, pero el servidor continúa.");
      }
    } catch (err) {
      app.log.error({ err }, "Error en auto-seed (continuando sin él)");
    }
  } else {
    app.log.info("AUTO_SEED=false, no se ejecuta seed automático.");
  }

  // Rutas PÚBLICAS (antes del plugin de auth, que intercepta todo lo demás)
  await app.register(healthRoutes);
  await app.register(authRoutes);

  // Plugin de auth: protege todas las rutas que NO estén en PUBLIC_PREFIXES
  // (definidos en plugins/auth.ts).
  await app.register(authPlugin);

  // Rutas PROTEGIDAS (requieren JWT en cookie)
  await app.register(ciudadanosRoutes);
  await app.register(tramitesRoutes);
  await app.register(solicitudesRoutes);
  await app.register(configuracionRoutes);
  await app.register(autorizacionesRoutes);
  await app.register(areasVerdesRoutes);
  await app.register(correspondenciasRoutes);
  await app.register(personalRoutes);
  await app.register(incidenciasRoutes);
  await app.register(vacacionesRoutes);
  await app.register(diasEconomicosRoutes);
  await app.register(injustificantesRoutes);
  await app.register(requisicionesRoutes);
  await app.register(consumiblesRoutes);
  await app.register(resguardosRoutes);
  await app.register(dashboardRoutes);
  await app.register(uploadsRoutes);
  await app.register(usuariosRoutes);
  await app.register(assetsRoutes);

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: `Ruta no encontrada: ${request.method} ${request.url}`,
      },
    });
  });

  return app;
}
