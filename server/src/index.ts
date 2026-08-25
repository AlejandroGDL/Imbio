import { buildServer } from "./server";
import { env } from "./env";
import { networkInterfaces } from "node:os";

function getLanUrls(port: number): string[] {
  const ifaces = networkInterfaces();
  const ips: string[] = [];
  for (const addrs of Object.values(ifaces)) {
    if (!addrs) continue;
    for (const a of addrs) {
      if (a.family === "IPv4" && !a.internal && !a.address.startsWith("169.254.")) {
        ips.push(a.address);
      }
    }
  }
  return [...new Set(ips)].sort().map((ip) => `http://${ip}:${port}`);
}

async function main() {
  const app = await buildServer();

  try {
    const address = await app.listen({
      host: env.HOST,
      port: env.PORT,
    });

    const lanUrls = getLanUrls(env.PORT);

    app.log.info("");
    app.log.info("╔══════════════════════════════════════════════════════════╗");
    app.log.info("║                                                          ║");
    app.log.info("║   🌿  IMBIO Server iniciado correctamente                ║");
    app.log.info("║                                                          ║");
    app.log.info("╚══════════════════════════════════════════════════════════╝");
    app.log.info("");
    app.log.info(`   URL local:   http://localhost:${env.PORT}`);
    if (lanUrls.length > 0) {
      app.log.info("   URLs en LAN:");
      for (const u of lanUrls) app.log.info(`     · ${u}`);
    } else {
      app.log.info(`   URL en LAN:  http://0.0.0.0:${env.PORT} (sin IP detectada)`);
    }
    app.log.info(`   Health:      ${address}/health`);
    app.log.info(`   Health (DB): ${address}/health/db`);
    app.log.info(`   Info:        ${address}/info`);
    app.log.info(`   Network:     ${address}/network`);
    app.log.info("");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Cierre limpio
const shutdown = async (signal: string) => {
  console.log(`\n${signal} recibido, cerrando servidor...`);
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main();
