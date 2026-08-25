import { useEffect, useState, useCallback, useRef } from "react";

import { api, ApiError } from "@/lib/api";
import { getServerUrl } from "@/lib/config";

export type ServerStatus = "checking" | "online" | "offline" | "error";

export interface ServerStatusState {
  status: ServerStatus;
  message?: string;
  database?: "up" | "down";
  lastChecked?: Date;
  serverUrl: string;
}

const POLL_INTERVAL = 30_000; // 30s

/**
 * Hook que verifica periódicamente si el servidor responde.
 * Hace health check + health/db en cada tick.
 */
export function useServerStatus(): ServerStatusState & {
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<ServerStatusState>({
    status: "checking",
    serverUrl: "",
  });
  const mounted = useRef(true);

  const check = useCallback(async () => {
    // Lee la URL actual (puede haber cambiado)
    const serverUrl = getServerUrl();

    if (!mounted.current) return;

    setState((s) => ({ ...s, status: "checking", serverUrl }));

    try {
      const health = await api.health();
      let dbStatus: "up" | "down" | undefined;
      let finalMessage = health.service;

      // Intenta el health con DB; si falla, marca DB como down pero el server está online
      try {
        const dbHealth = await api.healthDb();
        dbStatus = dbHealth.database;
      } catch {
        dbStatus = "down";
      }

      if (!mounted.current) return;
      setState({
        status: "online",
        message: finalMessage,
        database: dbStatus,
        lastChecked: new Date(),
        serverUrl,
      });
    } catch (err) {
      if (!mounted.current) return;
      const message =
        err instanceof ApiError ? err.message : "Sin conexión con el servidor";
      setState({
        status: "offline",
        message,
        lastChecked: new Date(),
        serverUrl,
      });
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    check();
    const id = window.setInterval(check, POLL_INTERVAL);

    // Re-checka cuando cambia la URL
    const onConfigChange = () => check();
    window.addEventListener("imbio:config-changed", onConfigChange);

    return () => {
      mounted.current = false;
      window.clearInterval(id);
      window.removeEventListener("imbio:config-changed", onConfigChange);
    };
  }, [check]);

  return { ...state, refresh: check };
}
