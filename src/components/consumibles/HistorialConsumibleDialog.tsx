/**
 * Dialog con el historial de movimientos de un Consumible.
 * Muestra las últimas entradas y salidas, con su origen
 * (requisición o empleado).
 */

import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  User,
  FileText,
  Loader2,
  History,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api";
import type { Consumible, ConsumibleMovimiento, Unidad } from "@/types/api";
import { UNIDADES_LABEL } from "@/types/api";

interface HistorialConsumibleDialogProps {
  consumible: Consumible;
}

function formatFecha(ymd: string): string {
  if (!ymd || ymd.length < 10) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function formatCantidad(cantidad: string, unidad: Unidad): string {
  const n = parseFloat(cantidad);
  if (!Number.isFinite(n)) return "—";
  return `${Number.isInteger(n) ? n.toString() : n.toFixed(2)} ${UNIDADES_LABEL[unidad]}`;
}

export function HistorialConsumibleDialog({
  consumible,
}: HistorialConsumibleDialogProps) {
  const [movimientos, setMovimientos] = useState<ConsumibleMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .obtenerConsumible(consumible.id)
      .then((c) => {
        setMovimientos(c.movimientos ?? []);
      })
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.message : "Error al cargar historial",
        );
      })
      .finally(() => setLoading(false));
  }, [consumible.id]);

  const stock = parseFloat(consumible.cantidadActual);

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50/50 p-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 text-white">
          <Package className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            {consumible.concepto}
          </h3>
          <p className="text-xs text-muted-foreground">
            {consumible.observaciones || "Sin observaciones"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Stock actual
          </p>
          <p className="text-lg font-bold text-rose-700">
            {Number.isFinite(stock)
              ? Number.isInteger(stock)
                ? stock
                : stock.toFixed(2)
              : "—"}{" "}
            <span className="text-xs font-medium text-rose-600">
              {UNIDADES_LABEL[consumible.unidad]}
            </span>
          </p>
        </div>
      </div>

      {/* Lista de movimientos */}
      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <History className="h-4 w-4" />
          Historial ({movimientos.length})
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

        {!loading && !error && movimientos.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Sin movimientos registrados.
          </div>
        )}

        {!loading && !error && movimientos.length > 0 && (
          <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
            {movimientos.map((m) => (
              <MovimientoRow key={m.id} mov={m} unidad={consumible.unidad} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MovimientoRow({
  mov,
  unidad,
}: {
  mov: ConsumibleMovimiento;
  unidad: Unidad;
}) {
  const isEntrada = mov.tipo === "ENTRADA";
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-2.5 text-sm ${
        isEntrada
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-orange-200 bg-orange-50/50"
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          isEntrada
            ? "bg-emerald-100 text-emerald-700"
            : "bg-orange-100 text-orange-700"
        }`}
      >
        {isEntrada ? (
          <ArrowDownToLine className="h-4 w-4" />
        ) : (
          <ArrowUpFromLine className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge
            className={
              isEntrada
                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                : "bg-orange-100 text-orange-800 hover:bg-orange-100"
            }
          >
            {isEntrada ? "Entrada" : "Salida"}
          </Badge>
          <span
            className={`font-bold ${isEntrada ? "text-emerald-700" : "text-orange-700"}`}
          >
            {isEntrada ? "+" : "−"}
            {formatCantidad(mov.cantidad, unidad)}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatFecha(mov.fecha)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {isEntrada && mov.requisicion && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Req:{" "}
              <span className="font-mono text-foreground">
                #{mov.requisicion.numero}
              </span>
            </span>
          )}
          {!isEntrada && mov.personal && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="font-medium text-foreground">
                {mov.personal.nombre} {mov.personal.apellidos}
              </span>
              <span>— {mov.personal.puesto}</span>
            </span>
          )}
        </div>
        {mov.observaciones && (
          <p className="mt-1 text-xs italic text-muted-foreground">
            {mov.observaciones}
          </p>
        )}
      </div>
    </div>
  );
}
