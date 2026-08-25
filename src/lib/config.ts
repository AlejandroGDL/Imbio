/**
 * Configuración persistida en localStorage.
 * - serverUrl: URL del backend IMBIO
 * - mode: "server" (esta PC corre el backend) o "client" (conecta a
 *   un backend remoto). En modo cliente, no se muestra la detección
 *   de LAN en el login (no tiene sentido buscar el server en esta PC).
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
  // Vite expone las vars de .env como import.meta.env.VITE_*
  try {
    const v = (import.meta as { env?: { VITE_IMBIO_MODE?: string } }).env?.VITE_IMBIO_MODE;
    if (v === "client" || v === "server") return v;
  } catch {
    // ignore
  }
  return "server";
})();

function loadConfig(): AppConfig {
  if (typeof window === "undefined") {
    return { serverUrl: DEFAULT_SERVER_URL, mode: DEFAULT_MODE };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { serverUrl: DEFAULT_SERVER_URL, mode: DEFAULT_MODE };
    }
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      serverUrl: parsed.serverUrl || DEFAULT_SERVER_URL,
      mode: parsed.mode === "client" ? "client" : "server",
    };
  } catch {
    return { serverUrl: DEFAULT_SERVER_URL, mode: DEFAULT_MODE };
  }
}

function saveConfig(cfg: AppConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  // Notifica a los listeners (otros componentes)
  window.dispatchEvent(new CustomEvent("imbio:config-changed", { detail: cfg }));
}

export function getServerUrl(): string {
  return loadConfig().serverUrl;
}

export function setServerUrl(url: string): void {
  const normalized = normalizeUrl(url);
  saveConfig({ ...loadConfig(), serverUrl: normalized });
}

/** Devuelve el modo de operación actual ("server" | "client"). */
export function getMode(): AppMode {
  return loadConfig().mode;
}

/** Cambia el modo de operación. */
export function setMode(mode: AppMode): void {
  saveConfig({ ...loadConfig(), mode });
}

export function getConfig(): AppConfig {
  return loadConfig();
}

function normalizeUrl(url: string): string {
  let trimmed = url.trim();
  if (!trimmed) return DEFAULT_SERVER_URL;
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = "http://" + trimmed;
  }
  // Quita slash final
  return trimmed.replace(/\/+$/, "");
}
