/**
 * Lista de eventos de correspondencia para el dashboard.
 * Cada item: número, asunto, próximo día, lista de asistentes
 * (chips con avatar y nombre), y badge de días restantes.
 */

import {
  CalendarDays,
  Mail,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  User,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

import type { DashboardEventoCorrespondencia } from "@/types/api";

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

function formatFechasCorto(fechas: string[]): string {
  if (fechas.length === 0) return "";
  if (fechas.length === 1) return formatFecha(fechas[0]);
  if (fechas.length === 2)
    return `${formatFecha(fechas[0])} y ${formatFecha(fechas[1])}`;
  return `${fechas.length} días: ${fechas.map(formatFecha).join(", ")}`;
}

function diasRelativo(dias: number | null): {
  texto: string;
  classes: string;
} {
  if (dias === null)
    return { texto: "sin fecha", classes: "bg-slate-100 text-slate-700" };
  if (dias < 0)
    return {
      texto: `hace ${Math.abs(dias)} d`,
      classes: "bg-red-100 text-red-800",
    };
  if (dias === 0)
    return { texto: "hoy", classes: "bg-rose-100 text-rose-800" };
  if (dias <= 2)
    return { texto: `en ${dias} d`, classes: "bg-amber-100 text-amber-800" };
  if (dias <= 7)
    return { texto: `en ${dias} d`, classes: "bg-yellow-50 text-yellow-800" };
  return { texto: `en ${dias} d`, classes: "bg-violet-50 text-violet-700" };
}

export function EventosCorrespondenciaList({
  items,
}: {
  items: DashboardEventoCorrespondencia[];
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
        <Mail className="h-8 w-8 text-slate-300" />
        <p>No hay eventos de correspondencia próximos.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((e) => {
        const rel = diasRelativo(e.diasRestantes);
        const TipoIcon = e.tipo === "ENTRADA" ? ArrowDownToLine : ArrowUpFromLine;
        return (
          <li
            key={e.id}
            className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0"
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                  e.tipo === "ENTRADA"
                    ? "bg-sky-100 text-sky-700"
                    : "bg-orange-100 text-orange-700",
                )}
              >
                <TipoIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  to="/correspondencia"
                  className="block truncate text-sm font-semibold text-foreground hover:underline"
                  title={e.asunto}
                >
                  {e.asunto}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-mono">{e.numero}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {formatFechasCorto(e.fechasEvento)}
                  </span>
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  rel.classes,
                )}
              >
                {rel.texto}
              </span>
            </div>

            {/* Asistentes */}
            {e.asistentes.length > 0 && (
              <div className="ml-12 flex items-start gap-2">
                <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex flex-wrap gap-1.5">
                  {e.asistentes.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-900"
                      title={a.puesto}
                    >
                      <User className="h-3 w-3" />
                      {a.nombre} {a.apellidos}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {e.asistentes.length === 0 && (
              <div className="ml-12 text-[11px] italic text-muted-foreground">
                Sin asistentes asignados
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
