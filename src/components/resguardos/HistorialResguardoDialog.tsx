/**
 * Dialog con el historial de un Resguardo.
 * Muestra todas las asignaciones/devoluciones de ese equipo específico,
 * quién lo tuvo y cuándo lo regresó.
 */

import { useEffect, useState } from "react";
import {
  ArrowRightToLine,
  ArrowLeftToLine,
  History,
  User,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api";
import type { Resguardo, ResguardoHistorial } from "@/types/api";

interface HistorialResguardoDialogProps {
  resguardo: Resguardo;
}

function formatFecha(ymd: string | null): string {
  if (!ymd || ymd.length < 10) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function HistorialResguardoDialog({ resguardo }: HistorialResguardoDialogProps) {
  const [items, setItems] = useState<ResguardoHistorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .historialResguardo(resguardo.id, { limit: 100 })
      .then((res) => setItems(res.data))
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Error al cargar historial",
        ),
      )
      .finally(() => setLoading(false));
  }, [resguardo.id]);

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="flex items-center gap-3 rounded-lg border border-fuchsia-200 bg-fuchsia-50/50 p-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            {resguardo.tipo} {resguardo.marca}
            {resguardo.modelo && ` · ${resguardo.modelo}`}
          </h3>
          <p className="font-mono text-xs text-muted-foreground">
            S/N: {resguardo.numeroSerie}
          </p>
        </div>
        <Badge className="bg-fuchsia-100 text-fuchsia-800 hover:bg-fuchsia-100">
          {items.length} {items.length === 1 ? "movimiento" : "movimientos"}
        </Badge>
      </div>

      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <History className="h-4 w-4" />
          Historial de asignaciones
        </h4>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando movimientos...
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Este equipo aún no ha sido asignado a nadie.
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
            {items.map((h) => {
              const enUso = !h.fechaDevolucion;
              return (
                <div
                  key={h.id}
                  className={`flex items-start gap-3 rounded-lg border p-2.5 text-sm ${
                    enUso
                      ? "border-emerald-200 bg-emerald-50/50"
                      : "border-slate-200 bg-slate-50/30"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                      enUso
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {enUso ? (
                      <ArrowRightToLine className="h-4 w-4" />
                    ) : (
                      <ArrowLeftToLine className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {h.personal && (
                        <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {h.personal.nombre} {h.personal.apellidos}
                        </span>
                      )}
                      {enUso && (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          En uso
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        📅 {formatFecha(h.fechaAsignacion)}
                        {h.fechaDevolucion && (
                          <> → {formatFecha(h.fechaDevolucion)}</>
                        )}
                        {!h.fechaDevolucion && <span className="italic"> (en uso)</span>}
                      </span>
                    </div>
                    {h.motivo && (
                      <p className="mt-0.5 text-xs">
                        <span className="font-medium">Motivo:</span> {h.motivo}
                      </p>
                    )}
                    {h.observaciones && (
                      <p className="mt-0.5 text-xs italic text-muted-foreground">
                        {h.observaciones}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
