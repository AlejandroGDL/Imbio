import type { FastifyInstance } from "fastify";
import { networkInterfaces } from "node:os";
import { prisma } from "../prisma";
import { env } from "../env";

export async function healthRoutes(app: FastifyInstance) {
  /**
   * GET /health
   * Health check simple.
   */
  app.get("/health", async () => {
    return {
      ok: true,
      service: "imbio-server",
      timestamp: new Date().toISOString(),
    };
  });

  /**
   * GET /health/db
   * Verifica que la conexión a la base de datos funciona.
   */
  app.get("/health/db", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        ok: true,
        service: "imbio-server",
        database: "up",
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      reply.log.error({ err }, "DB health check failed");
      return reply.status(503).send({
        ok: false,
        service: "imbio-server",
        database: "down",
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /info
   * Información del servidor (versión, config básica).
   */
  app.get("/info", async () => {
    const [config, tramitesCount, ciudadanosCount] = await Promise.all([
      prisma.configuracion.findUnique({ where: { id: 1 } }),
      prisma.tramite.count({ where: { activo: true } }),
      prisma.ciudadano.count({ where: { activo: true } }),
    ]);

    return {
      ok: true,
      version: "0.1.0",
      institucion: config?.nombreInstitucion ?? "IMBIO",
      tramitesActivos: tramitesCount,
      ciudadanosRegistrados: ciudadanosCount,
    };
  });

  /**
   * GET /network
   * Devuelve las IPs locales (no-loopback) de la PC servidor
   * y las URLs que las PCs clientes pueden usar para conectarse.
   * Útil para configurar el acceso LAN desde la página de Configuración.
   */
  app.get("/network", async () => {
    const ifaces = networkInterfaces();
    const ips: Array<{ name: string; address: string; family: "IPv4" | "IPv6"; internal: boolean }> = [];

    for (const [name, addrs] of Object.entries(ifaces)) {
      if (!addrs) continue;
      for (const a of addrs) {
        ips.push({
          name,
          address: a.address,
          family: a.family === "IPv4" ? "IPv4" : "IPv6",
          internal: a.internal,
        });
      }
    }

    // Solo IPv4 no-loopback ni link-local
    const lanIps = ips
      .filter((i) => i.family === "IPv4" && !i.internal)
      .map((i) => i.address)
      .filter((ip) => {
        // Excluir link-local 169.254.x.x
        if (ip.startsWith("169.254.")) return false;
        return true;
      })
      .sort();

    return {
      ok: true,
      host: env.HOST,
      port: env.PORT,
      interfaces: ips,
      lanIps,
      urls: lanIps.map((ip) => `http://${ip}:${env.PORT}`),
      hint:
        lanIps.length > 0
          ? "Las PCs clientes deben apuntar a una de las URLs en 'urls'."
          : "No se detectaron IPs de LAN. Verifica la conexión de red.",
    };
  });
}
