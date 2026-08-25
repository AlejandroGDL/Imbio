/**
 * Configuración persistida en localStorage.
 * - serverUrl: URL del backend IMBIO
 * - mode: "server" (esta PC corre el backend) o "client" (conecta a
 *   un backend remoto). En modo cliente, no se muestra la detección
 *   de LAN en el login (no tiene sentido buscar el server en esta PC).
 *
 * Prioridad al cargar:
 *   1. config.json dejado por el instalador en disco (vía Tauri)
 *   2. localStorage (configuración del usuario en la app)
 *   3. Defaults (VITE_IMBIO_MODE + http://localhost:3000)
 */

const STORAGE_KEY = "imbio:config";
const DEFAULT_SERVER_URL = "http://localhost:3000";

export type AppMode = "server" | "client";

export interface AppConfig {
  serverUrl: string;
  mode: AppMode;
}

/**
 * Default del modo de operación.
 *
 * - Si se compila con VITE_IMBIO_MODE=client → arranca como cliente
 * - Si se compila con VITE_IMBIO_MODE=server → arranca como servidor
 * - Si no se especifica → "server" (comportamiento por defecto)
 *
 * El usuario puede cambiarlo en Configuración → Modo de operación.
 */
const DEFAULT_MODE: AppMode = (() => {
  try {
    const v = (import.meta as { env?: { VITE_IMBIO_MODE?: string } }).env?.VITE_IMBIO_MODE;
    if (v === "client" || v === "server") return v;
  } catch {
    // ignore
  }
  return "server";
})();

/**
 * Cache de la config del instalador (Tauri command).
 * Se carga una sola vez al inicio y se considera prioritaria.
 */
let installConfigCache: AppConfig | null = null;
let installConfigChecked = false;

async function loadInstallConfig(): Promise<AppConfig | null> {
  if (installConfigChecked) return installConfigCache;
  installConfigChecked = true;

  // Solo intentar si estamos dentro de Tauri (no en navegador normal)
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
  if (!w.__TAURI_INTERNALS__) return null;

  try {
    // Import dinámico para no romper el build web
    const mod = await import("@tauri-apps/api/core");
    const result = await mod.invoke<{ serverUrl: string; mode: string } | null>(
      "get_install_config"
    );
    if (result && (result.mode === "server" || result.mode === "client")) {
      installConfigCache = {
        serverUrl: result.serverUrl || DEFAULT_SERVER_URL,
        mode: result.mode,
      };
      return installConfigCache;
    }
  } catch {
    // El comando puede fallar si no estamos en Windows
    // o si el archivo no existe — ambos casos son OK
  }
  return null;
}

async function loadConfig(): Promise<AppConfig> {
  if (typeof window === "undefined") {
    return { serverUrl: DEFAULT_SERVER_URL, mode: DEFAULT_MODE };
  }
  // 1. Intentar config del instalador (prioridad)
  const installCfg = await loadInstallConfig();
  if (installCfg) {
    // También la guardamos en localStorage para próximas cargas
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(installCfg));
    } catch {
      // ignore
    }
    return installCfg;
  }
  // 2. localStorage
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppConfig>;
      return {
        serverUrl: parsed.serverUrl || DEFAULT_SERVER_URL,
        mode: parsed.mode === "client" ? "client" : "server",
      };
    }
  } catch {
    // ignore
  }
  // 3. Default
  return { serverUrl: DEFAULT_SERVER_URL, mode: DEFAULT_MODE };
}

function saveConfig(cfg: AppConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  // Notifica a los listeners (otros componentes)
  window.dispatchEvent(new CustomEvent("imbio:config-changed", { detail: cfg }));
}

/** Versión síncrona (usa cache). Úsala solo después de que se haya cargado. */
export function getServerUrl(): string {
  // Si no hay cache, devolver default (se actualizará al cargar la config async)
  if (installConfigCache) return installConfigCache.serverUrl;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppConfig>;
      return parsed.serverUrl || DEFAULT_SERVER_URL;
    }
  } catch {
    // ignore
  }
  return DEFAULT_SERVER_URL;
}

export function setServerUrl(url: string): void {
  const normalized = normalizeUrl(url);
  const current = installConfigCache
    ?? (() => {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) return JSON.parse(raw) as AppConfig;
        } catch { /* ignore */ }
        return { serverUrl: DEFAULT_SERVER_URL, mode: DEFAULT_MODE };
      })();
  installConfigCache = { ...current, serverUrl: normalized };
  saveConfig({ ...current, serverUrl: normalized });
}

/** Devuelve el modo de operación actual ("server" | "client"). */
export function getMode(): AppMode {
  if (installConfigCache) return installConfigCache.mode;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppConfig>;
      return parsed.mode === "client" ? "client" : "server";
    }
  } catch {
    // ignore
  }
  return DEFAULT_MODE;
}

/** Cambia el modo de operación. */
export function setMode(mode: AppMode): void {
  const current = installConfigCache
    ?? (() => {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) return JSON.parse(raw) as AppConfig;
        } catch { /* ignore */ }
        return { serverUrl: DEFAULT_SERVER_URL, mode: DEFAULT_MODE };
      })();
  installConfigCache = { ...current, mode };
  saveConfig({ ...current, mode });
}

/** Versión async — útil cuando necesitas la config real (no el default). */
export async function getConfigAsync(): Promise<AppConfig> {
  return await loadConfig();
}

export function getConfig(): AppConfig {
  // Síncrono — devuelve cache o default. Usar getConfigAsync para
  // esperar a que se cargue la config del instalador.
  if (installConfigCache) return installConfigCache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppConfig>;
      return {
        serverUrl: parsed.serverUrl || DEFAULT_SERVER_URL,
        mode: parsed.mode === "client" ? "client" : "server",
      };
    }
  } catch {
    // ignore
  }
  return { serverUrl: DEFAULT_SERVER_URL, mode: DEFAULT_MODE };
}

/** Llamar al inicio de la app para pre-cargar la config del instalador. */
export async function initConfig(): Promise<void> {
  await loadConfig();
}

function normalizeUrl(url: string): string {
  let trimmed = url.trim();
  if (!trimmed) return DEFAULT_SERVER_URL;
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = "http://" + trimmed;
  }
  return trimmed.replace(/\/+$/, "");
}
