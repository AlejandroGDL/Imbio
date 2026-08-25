#!/usr/bin/env node
// =================================================================
// fetch-binaries.mjs
// =================================================================
// Descarga los binarios externos que el instalador necesita:
//
//   - Node.js portable (Windows x64, .zip)        ~30 MB
//   - PostgreSQL 16 binaries (Windows x64, .zip)   ~80 MB
//   - nssm (Windows x64, .zip)                     ~1 MB
//
// Salida: installer/resources/
//   - node/      ← Node.js extraído
//   - pgsql/     ← PostgreSQL extraído
//   - nssm.exe   ← Single executable (no necesita extracción)
//
// Idempotente: si los archivos ya existen y son válidos, no descarga.
// =================================================================

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, createWriteStream, statSync, chmodSync, readdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import https from "node:https";
import http from "node:http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const resourcesDir = join(__dirname, "resources");

// ---------- Configuración de versiones ----------
const NODE_VERSION = "v22.11.0";  // LTS, mismo que en package.json raíz
const PG_VERSION   = "16.4";       // LTS
const PG_BUILD     = "1";          // build number del installer
const NSSM_VERSION = "2.24";

const NODE_URL = `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-win-x64.zip`;
// EnterpriseDB — binarios pre-compilados de PostgreSQL
const PG_URL   = `https://get.enterprisedb.com/postgresql/postgresql-${PG_VERSION}-${PG_BUILD}-windows-x64-binaries.zip`;
const NSSM_URL = `https://nssm.cc/release/nssm-${NSSM_VERSION}.zip`;

const log = (m) => console.log(`[fetch-binaries] ${m}`);
const die = (m) => { console.error(`[fetch-binaries] ❌ ${m}`); process.exit(1); };

// ---------- Helpers ----------
function download(url, dest) {
  return new Promise((resolveP, rejectP) => {
    log(`Descargando ${url}`);
    log(`         → ${dest}`);

    const follow = (urlStr, depth = 0) => {
      if (depth > 5) return rejectP(new Error("Demasiados redirects"));

      const proto = urlStr.startsWith("https") ? https : http;
      proto.get(urlStr, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          const loc = res.headers.location;
          if (!loc) return rejectP(new Error("Redirect sin Location"));
          return follow(loc, depth + 1);
        }
        if (res.statusCode !== 200) {
          return rejectP(new Error(`HTTP ${res.statusCode} para ${urlStr}`));
        }
        const total = parseInt(res.headers["content-length"] || "0", 10);
        let downloaded = 0;
        let lastLog = 0;
        res.on("data", (chunk) => {
          downloaded += chunk.length;
          const now = Date.now();
          if (now - lastLog > 2000) {
            const pct = total > 0 ? Math.round((downloaded / total) * 100) : "?";
            process.stdout.write(`\r[fetch-binaries]    ${downloaded}/${total} bytes (${pct}%)    `);
            lastLog = now;
          }
        });
        res.on("end", () => {
          process.stdout.write("\n");
          resolveP();
        });
        pipeline(res, createWriteStream(dest)).catch(rejectP);
      }).on("error", rejectP);
    };
    follow(url);
  });
}

async function downloadIfMissing(url, dest, minSize = 1024) {
  if (existsSync(dest)) {
    const size = statSync(dest).size;
    if (size >= minSize) {
      log(`✓ Ya existe: ${dest} (${(size / 1024 / 1024).toFixed(1)} MB)`);
      return;
    }
    log(`⚠ ${dest} existe pero es muy pequeño (${size} bytes), re-descargando...`);
    rmSync(dest, { force: true });
  }
  await download(url, dest);
  const size = statSync(dest).size;
  log(`✓ Descargado: ${dest} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  if (size < minSize) {
    die(`El archivo descargado es demasiado pequeño (${size} bytes). ¿Falló la descarga?`);
  }
}

function unzip(zipPath, destDir) {
  log(`Descomprimiendo ${zipPath} → ${destDir}`);
  if (existsSync(destDir)) rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });
  // `unzip` está disponible en Mac y Linux. En Windows lo instalamos
  // con `npm i -g node-unzip` o usamos 7zip si está disponible.
  // Para CI usaremos 7zip (instalado en GitHub Actions runners).
  if (process.platform === "win32") {
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: "inherit" });
  } else {
    execSync(`unzip -q "${zipPath}" -d "${destDir}"`, { stdio: "inherit" });
  }
}

function findFirstSubdir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) return join(dir, e.name);
  }
  return null;
}

// ---------- 0. Validar prerrequisitos ----------
log("Validando prerrequisitos...");
mkdirSync(resourcesDir, { recursive: true });

// `unzip` o `powershell Expand-Archive` debe estar disponible
if (process.platform !== "win32") {
  try {
    execSync("which unzip", { stdio: "ignore" });
  } catch {
    die("Se necesita el comando 'unzip' (instalar con: brew install unzip)");
  }
}

// ---------- 1. Node.js portable ----------
log("");
log("═══ Node.js portable ═══");
const nodeZip = join(resourcesDir, `node-${NODE_VERSION}-win-x64.zip`);
const nodeDir = join(resourcesDir, "node");
await downloadIfMissing(NODE_URL, nodeZip, 25 * 1024 * 1024); // ~30 MB mínimo

if (!existsSync(nodeDir) || !existsSync(join(nodeDir, "node.exe"))) {
  unzip(nodeZip, join(resourcesDir, "_node_extract"));
  // El zip tiene un subdirectorio "node-v22.x.x-win-x64/" — renombrarlo
  const extracted = findFirstSubdir(join(resourcesDir, "_node_extract"));
  if (!extracted) die("No se encontró el subdirectorio de Node.js");
  // Mover contenido a node/
  mkdirSync(nodeDir, { recursive: true });
  execSync(`mv "${extracted}"/* "${nodeDir}/"`, { stdio: "inherit" });
  rmSync(join(resourcesDir, "_node_extract"), { recursive: true, force: true });
}
log(`✓ Node.js portable listo en: ${nodeDir}`);

// ---------- 2. PostgreSQL binaries ----------
log("");
log("═══ PostgreSQL binaries ═══");
const pgZip = join(resourcesDir, `postgresql-${PG_VERSION}-windows-x64-binaries.zip`);
const pgDir = join(resourcesDir, "pgsql");
await downloadIfMissing(PG_URL, pgZip, 70 * 1024 * 1024); // ~80 MB mínimo

if (!existsSync(pgDir) || !existsSync(join(pgDir, "bin", "pg_ctl.exe"))) {
  unzip(pgZip, join(resourcesDir, "_pg_extract"));
  // El zip tiene un subdirectorio "pgsql/" — renombrarlo si es necesario
  const extracted = join(resourcesDir, "_pg_extract", "pgsql");
  if (existsSync(extracted)) {
    if (existsSync(pgDir)) rmSync(pgDir, { recursive: true, force: true });
    execSync(`mv "${extracted}" "${pgDir}"`, { stdio: "inherit" });
  } else {
    // A veces la estructura varía
    const first = findFirstSubdir(join(resourcesDir, "_pg_extract"));
    if (!first) die("No se encontró la estructura esperada en el zip de PostgreSQL");
    if (existsSync(pgDir)) rmSync(pgDir, { recursive: true, force: true });
    execSync(`mv "${first}" "${pgDir}"`, { stdio: "inherit" });
  }
  rmSync(join(resourcesDir, "_pg_extract"), { recursive: true, force: true });
}
log(`✓ PostgreSQL listo en: ${pgDir}`);

// ---------- 3. nssm ----------
log("");
log("═══ nssm (Service Manager) ═══");
const nssmZip = join(resourcesDir, `nssm-${NSSM_VERSION}.zip`);
const nssmDir = join(resourcesDir, "nssm");
const nssmExe  = join(nssmDir, "win64", "nssm.exe");
const nssmFinal = join(resourcesDir, "nssm.exe");

await downloadIfMissing(NSSM_URL, nssmZip, 500 * 1024); // ~1 MB mínimo

if (!existsSync(nssmFinal)) {
  unzip(nssmZip, join(resourcesDir, "_nssm_extract"));
  // nssm-2.24/win64/nssm.exe → lo copiamos a resources/nssm.exe
  const found = join(resourcesDir, "_nssm_extract", `nssm-${NSSM_VERSION}`, "win64", "nssm.exe");
  if (!existsSync(found)) {
    die(`No se encontró nssm.exe en ${found}`);
  }
  execSync(`cp "${found}" "${nssmFinal}"`, { stdio: "inherit" });
  rmSync(join(resourcesDir, "_nssm_extract"), { recursive: true, force: true });
}
log(`✓ nssm listo en: ${nssmFinal}`);

// ---------- 4. Resumen ----------
log("");
log("═══════════════════════════════════════════════════════════════");
log("  ✅ Todos los binarios descargados");
log("═══════════════════════════════════════════════════════════════");
log(`  Node.js:    ${nodeDir}`);
log(`  PostgreSQL: ${pgDir}`);
log(`  nssm:       ${nssmFinal}`);

// Tamaños
for (const d of [nodeDir, pgDir, nssmFinal]) {
  try {
    const du = execSync(
      process.platform === "win32"
        ? `powershell -Command "(Get-Item '${d}').Length / 1MB"`
        : `du -sm "${d}" | cut -f1`,
      { encoding: "utf8" }
    ).trim();
    log(`  Tamaño ${d}: ${du} MB`);
  } catch { /* ignore */ }
}

log("");
log("Próximo paso:");
log("  Construir el bundle del server:  node installer/build-server-bundle.mjs");
log("  Compilar el instalador Tauri:    npm run tauri build");
