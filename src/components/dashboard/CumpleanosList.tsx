/**
 * Lista de próximos cumpleaños del personal.
 * Cada item muestra: nombre, puesto, fecha del próximo cumple + cuántos
 * días faltan (con formato relativo "hoy", "mañana", "en 3 días", etc.).
 */

import { Cake, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

import type { DashboardCumpleanos } from "@/types/api";

function formatFecha(ymd: string): string {
  if (!ymd || ymd.length < 10) return "—";
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

/** Texto relativo en español: "hoy", "mañana", "en 3 días", "era hace 2 días" */
function diasRelativo(dias: number): string {
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias < 0) return `hace ${Math.abs(dias)} días`;
  return `en ${dias} días`;
}

export function CumpleanosList({
  items,
}: {
  items: DashboardCumpleanos[];
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
        <Cake className="h-8 w-8 text-slate-300" />
        <p>No hay cumpleaños en los próximos 30 días.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((c) => {
        const isToday = c.diasRestantes === 0;
        const isSoon = c.diasRestantes <= 3;
        const isPast = c.diasRestantes < 0;
        return (
          <li
            key={c.id}
            className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white",
                isToday
                  ? "bg-gradient-to-br from-pink-500 to-rose-600"
                  : isSoon
                    ? "bg-gradient-to-br from-amber-400 to-orange-500"
                    : "bg-gradient-to-br from-fuchsia-400 to-purple-500",
              )}
            >
              {isToday ? (
                <Gift className="h-4 w-4" />
              ) : (
                <Cake className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                to="/personal"
                className="block truncate text-sm font-semibold text-foreground hover:underline"
              >
                {c.nombre} {c.apellidos}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {c.puesto}
              </p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "text-xs font-semibold",
                  isToday
                    ? "text-rose-700"
                    : isSoon
                      ? "text-amber-700"
                      : isPast
                        ? "text-slate-500"
                        : "text-foreground",
                )}
              >
                {diasRelativo(c.diasRestantes)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formatFecha(c.proximo)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
