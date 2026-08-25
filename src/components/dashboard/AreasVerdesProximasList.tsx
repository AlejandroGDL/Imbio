/**
 * Lista de áreas verdes próximas a ser utilizadas (próximos 30 días).
 * Muestra área, tipo de evento, fecha + horario, responsable, y días
 * restantes con formato relativo.
 */

import { Leaf, Clock, User } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

import type { DashboardAreaVerde } from "@/types/api";

function formatFecha(ymd: string): string {
  if (!ymd || ymd.length < 10) return "—";
  const [, m, d] = ymd.slice(0, 10).split("-");
  const meses = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  return `${d} ${meses[Number(m) - 1]}`;
}

function diasRelativo(dias: number): string {
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  return `en ${dias} días`;
}

export function AreasVerdesProximasList({
  items,
}: {
  items: DashboardAreaVerde[];
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
        <Leaf className="h-8 w-8 text-slate-300" />
        <p>No hay áreas verdes reservadas en los próximos 30 días.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((a) => {
        const isToday = a.diasRestantes === 0;
        const isSoon = a.diasRestantes <= 2;
        return (
          <li
            key={a.id}
            className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                isToday
                  ? "bg-rose-100 text-rose-700"
                  : isSoon
                    ? "bg-amber-100 text-amber-700"
                    : "bg-lime-100 text-lime-700",
              )}
            >
              <Leaf className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <Link
                to="/areas-verdes"
                className="block truncate text-sm font-semibold text-foreground hover:underline"
                title={a.areaVerde}
              >
                {a.areaVerde}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {a.tipoEvento}
                {a.usuario && <> · {a.usuario}</>}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">
                  {formatFecha(a.fecha)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {a.horaInicio}–{a.horaFin}
                </span>
                {a.responsable && (
                  <span className="flex items-center gap-1 truncate">
                    <User className="h-3 w-3" />
                    <span className="truncate">{a.responsable}</span>
                  </span>
                )}
              </div>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                isToday
                  ? "bg-rose-100 text-rose-800"
                  : isSoon
                    ? "bg-amber-100 text-amber-800"
                    : "bg-lime-50 text-lime-800",
              )}
            >
              {diasRelativo(a.diasRestantes)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
