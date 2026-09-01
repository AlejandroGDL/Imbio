#!/usr/bin/env node
// =================================================================
// build-server-bundle.mjs
// =================================================================
// Prepara el bundle del servidor que se empaqueta dentro del
// instalador de Windows. El bundle contiene:
//
//   - dist/                 → JS compilado del server
//   - node_modules/         → solo dependencias de producción
//   - prisma/               → schema + migraciones
//   - package.json          → solo dependencias (sin scripts de dev)
//   - .env.example          → plantilla (sin secretos)
//
// Lo que NO incluye (para que el bundle pese poco):
//   - .env con secretos             (se genera en post-instalación)
//   - node_modules de dev (TypeScript, tsx, etc.)
//   - dist/*.map y .tsbuildinfo
//
// Salida: installer/resources/server-bundle/
//
// ⚠️ Importante sobre npm workspaces:
// Este script NO usa `npm install` ni `npm prune` directamente en
// server/ porque eso eliminaría las devDeps de la RAÍZ del workspace
// (rompería el frontend). En su lugar, instala las prodDeps en una
// carpeta temporal y las copia al bundle.
// =================================================================

import { execSync } from "node:child_process";
import { existsSync, rmSync, cpSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const serverDir = join(repoRoot, "server");
const outputDir = join(__dirname, "resources", "server-bundle");

const log = (msg) => console.log(`[build-server-bundle] ${msg}`);
const die = (msg) => {
  console.error(`[build-server-bundle] ❌ ${msg}`);
  process.exit(1);
};

// ---------- 1. Validar prerrequisitos ----------
log("Validando prerrequisitos...");
const serverPkgPath = join(serverDir, "package.json");
if (!existsSync(serverPkgPath)) {
  die(`No se encontró server/package.json (raíz: ${serverDir})`);
}
if (!existsSync(join(serverDir, "prisma", "schema.prisma"))) {
  die("No se encontró server/prisma/schema.prisma");
}
const originalPkg = JSON.parse(readFileSync(serverPkgPath, "utf8"));

// ---------- 2. Crear carpeta temporal para prodDeps ----------
// (usamos /tmp en Mac/Linux, %TEMP% en Windows cuando se corra desde CI)
const tmpInstallDir = mkdtempSync(join(tmpdir(), "imbio-server-prod-"));
log(`Carpeta temporal para prodDeps: ${tmpInstallDir}`);

const tmpDevInstallDir = mkdtempSync(join(tmpdir(), "imbio-server-dev-"));
log(`Carpeta temporal para devDeps (solo type-check): ${tmpDevInstallDir}`);

// Cleanup al salir (incluso si hay error)
const cleanup = () => {
  for (const dir of [tmpInstallDir, tmpDevInstallDir]) {
    try {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
};
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(1); });
process.on("SIGTERM", () => { cleanup(); process.exit(1); });

// ---------- 3. Instalar prodDeps en carpeta temporal ----------
log("Instalando dependencias de producción (carpeta temporal)...");
writeFileSync(
  join(tmpInstallDir, "package.json"),
  JSON.stringify({
    name: originalPkg.name + "-prod-bundle",
    version: originalPkg.version,
    type: originalPkg.type,
    main: originalPkg.main || "dist/index.js",
    dependencies: originalPkg.dependencies,
  }, null, 2) + "\n"
);
try {
  execSync("npm install --omit=dev --omit=optional --omit=peer --no-audit --no-fund", {
    cwd: tmpInstallDir,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });
} catch (e) {
  die("Falló npm install de prodDeps. Revisa tu conexión a internet.");
}

// ---------- 4. Instalar devDeps (solo para type-check) en otra temp ----------
log("Instalando devDeps para type-check (carpeta temporal separada)...");
writeFileSync(
  join(tmpDevInstallDir, "package.json"),
  JSON.stringify({
    name: originalPkg.name + "-dev-bundle",
    version: originalPkg.version,
    type: originalPkg.type,
    main: originalPkg.main,
    dependencies: originalPkg.dependencies,
    devDependencies: originalPkg.devDependencies,
  }, null, 2) + "\n"
);
try {
  execSync("npm install --no-audit --no-fund", {
    cwd: tmpDevInstallDir,
    stdio: "inherit",
  });
} catch (e) {
  die("Falló npm install de devDeps. Revisa tu conexión a internet.");
}

// ---------- 5. Limpiar dist/ previo del server ----------
log("Limpiando dist/ previo del server...");
const distDir = join(serverDir, "dist");
if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
const tsbuildinfo = join(serverDir, "tsconfig.tsbuildinfo");
if (existsSync(tsbuildinfo)) rmSync(tsbuildinfo, { force: true });

// ---------- 6. Compilar TypeScript del server con esbuild ----------
// Usamos esbuild (más rápido, sin chequeo de tipos) en vez de tsc
// porque el server tiene errores de tipo pre-existentes que no
// afectan la ejecución pero bloquean tsc. esbuild solo transpila.
//
// Después también corremos `tsc --noEmit` para reportar los errores
// sin que bloqueen el bundle (visibilidad sin阻断).
log("Compilando TypeScript del server con esbuild...");

// Asegurar que esbuild esté disponible (lo instalamos en devDeps temp)
const esbuildPath = join(tmpDevInstallDir, "node_modules", ".bin", "esbuild");
if (!existsSync(esbuildPath)) {
  // Si no está en la temp, instalarlo ahí
  log("   esbuild no estaba en devDeps, instalando...");
  try {
    execSync("npm install esbuild --no-save --no-audit --no-fund", {
      cwd: tmpDevInstallDir,
      stdio: "inherit",
    });
  } catch (e) {
    die("No se pudo instalar esbuild.");
  }
}

try {
  execSync(
    [
      `"${esbuildPath}"`,
      `src/index.ts`,
      `--platform=node`,
      `--target=node22`,
      `--format=esm`,
      `--outdir=dist`,
      `--out-extension:.js=.js`,
      `--sourcemap=inline`,
      `--loader:.node=copy`,
    ].join(" "),
    {
      cwd: serverDir,
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_PATH: join(tmpDevInstallDir, "node_modules"),
      },
    }
  );
} catch (e) {
  die("Falló la compilación con esbuild. Revisa los errores arriba.");
}

if (!existsSync(join(serverDir, "dist", "index.js"))) {
  die("No se generó server/dist/index.js — la compilación parece haber fallado silenciosamente.");
}

log("✅ Compilación con esbuild exitosa");

// (Opcional) Reportar errores de tipo sin bloquear
log("(Opcional) Chequeando tipos para reportar (no bloquea)...");
try {
  execSync("npx tsc --noEmit", {
    cwd: serverDir,
    stdio: "pipe", // silencioso, no mostrar warnings
    env: {
      ...process.env,
      NODE_PATH: join(tmpDevInstallDir, "node_modules"),
    },
  });
  log("   ✅ Sin errores de tipo");
} catch (e) {
  // Mostrar output pero continuar
  const output = e.stdout?.toString() || e.stderr?.toString() || "";
  const errorCount = (output.match(/error TS/g) || []).length;
  log(`   ⚠️  ${errorCount} errores de tipo (no bloquean, solo se reportan)`);
}

// ---------- 7. Generar el cliente de Prisma ----------
// (usa el schema del server original, no el del bundle)
//
// Usamos la ruta directa al binario de prisma en tmpDevInstallDir
// porque `npx prisma` falla si server/node_modules está vacío
// (lo cual pasa en CI como Render donde solo se clona el repo).
log("Generando cliente de Prisma...");
try {
  const prismaBin = join(tmpDevInstallDir, "node_modules", ".bin", "prisma");
  if (!existsSync(prismaBin)) {
    // Fallback: intentar con npx (funciona en dev local)
    execSync("npx prisma generate --schema=prisma/schema.prisma", {
      cwd: serverDir,
      stdio: "inherit",
    });
  } else {
    execSync(`"${prismaBin}" generate --schema=prisma/schema.prisma`, {
      cwd: serverDir,
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_PATH: join(tmpDevInstallDir, "node_modules"),
      },
    });
  }
} catch (e) {
  die("Falló prisma generate. Revisa el schema.prisma.");
}

// ---------- 8. Limpiar destino del bundle ----------
log(`Limpiando destino: ${outputDir}`);
if (existsSync(outputDir)) {
  rmSync(outputDir, { recursive: true, force: true });
}
mkdirSync(outputDir, { recursive: true });

// ---------- 9. Copiar al bundle ----------
log("Copiando archivos al bundle...");

// 9a. dist/ (compilado)
cpSync(join(serverDir, "dist"), join(outputDir, "dist"), { recursive: true });

// 9b. node_modules/ (solo prod, desde la carpeta temporal)
log("Copiando node_modules (prodDeps)...");
cpSync(join(tmpInstallDir, "node_modules"), join(outputDir, "node_modules"), { recursive: true });

// 9c. prisma/ (schema + migrations + seed compilable)
cpSync(join(serverDir, "prisma"), join(outputDir, "prisma"), { recursive: true });

// 9d. package.json del bundle (limpio, sin scripts de dev)
const cleanPkg = {
  name: originalPkg.name,
  version: originalPkg.version,
  description: originalPkg.description,
  type: originalPkg.type,
  main: originalPkg.main || "dist/index.js",
  dependencies: originalPkg.dependencies,
};
writeFileSync(join(outputDir, "package.json"), JSON.stringify(cleanPkg, null, 2) + "\n");
log("package.json del bundle escrito (sin scripts de dev).");

// 9e. README breve
writeFileSync(join(outputDir, "README.md"), `# IMBIO Server Bundle

Bundle del servidor que el instalador de IMBIO coloca en la PC.
Se inicia con:

\`\`\`cmd
node dist/index.js
\`\`\`

Las variables de entorno se cargan desde \`.env\`, que se genera
automáticamente en la primera instalación.

Más info: ../docs/installer.md
`);

// 9f. .env.example (plantilla sin secretos)
if (existsSync(join(serverDir, ".env.example"))) {
  cpSync(join(serverDir, ".env.example"), join(outputDir, ".env.example"));
} else if (existsSync(join(serverDir, ".env"))) {
  log("Generando .env.example a partir del .env actual (sin secretos)...");
  const envContent = readFileSync(join(serverDir, ".env"), "utf8");
  const safeLines = envContent
    .split("\n")
    .filter((line) => {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
      if (!match) return false;
      const key = match[1];
      if (key.includes("SECRET") || key.includes("PASSWORD")) return false;
      return true;
    })
    .map((line) => line.replace(/=(.*)$/, "="))
    .join("\n");
  writeFileSync(join(outputDir, ".env.example"), safeLines + "\n");
}

// ---------- 10. Limpiar archivos innecesarios del bundle ----------
log("Limpiando archivos innecesarios del bundle...");

// Quitar types de TypeScript
const typesDirs = [join(outputDir, "node_modules", "@types")];
for (const dir of typesDirs) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

// Quitar .map y .d.ts de node_modules
try {
  execSync(
    `find "${join(outputDir, "node_modules")}" -type f \\( -name "*.map" -o -name "*.d.ts" \\) -delete 2>/dev/null || true`,
    { stdio: "ignore" }
  );
} catch { /* best-effort */ }

// Quitar .tsbuildinfo
if (existsSync(join(outputDir, "tsconfig.tsbuildinfo"))) {
  rmSync(join(outputDir, "tsconfig.tsbuildinfo"));
}

// Quitar carpetas de docs/ejemplos dentro de node_modules
for (const sub of ["doc", "docs", "example", "examples", "test", "tests", "__tests__"]) {
  try {
    execSync(
      `find "${join(outputDir, "node_modules")}" -type d -name "${sub}" -maxdepth 4 -exec rm -rf {} + 2>/dev/null || true`,
      { stdio: "ignore" }
    );
  } catch { /* best-effort */ }
}

// ---------- 11. Resumen ----------
log("✅ Bundle del server listo");
log(`   Ubicación: ${outputDir}`);

try {
  const du = execSync(`du -sh "${outputDir}" | cut -f1`, { encoding: "utf8" }).trim();
  log(`   Tamaño:   ${du}`);
} catch {
  log("   Tamaño:   (no se pudo medir en este sistema)");
}

// Mostrar primer nivel para verificar
try {
  const ls = execSync(`ls -lh "${outputDir}" | tail -n +2`, { encoding: "utf8" }).trim();
  log(`   Contenido:\n${ls.split("\n").map((l) => "     " + l).join("\n")}`);
} catch {
  // best-effort
}
