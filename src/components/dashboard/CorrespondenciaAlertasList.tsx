/**
 * Lista de correspondencia pendiente (con fecha de respuesta próxima
 * o vencida). Cada item muestra número, asunto, días restantes con
 * formato relativo y badge de prioridad.
 */

import {
  Mail,
  AlertCircle,
  AlertTriangle,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

import type { DashboardCorrespondencia } from "@/types/api";

function formatFecha(ymd: string | null): string {
  if (!ymd || ymd.length < 10) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Texto relativo + color según urgencia */
function urgenciaInfo(dias: number | null): {
  texto: string;
  classes: string;
  Icon: typeof AlertCircle;
} {
  if (dias === null) {
    return {
      texto: "Sin fecha",
      classes: "bg-slate-100 text-slate-700 border-slate-200",
      Icon: Clock,
    };
  }
  if (dias < 0) {
    return {
      texto: `Vencida hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? "" : "s"}`,
      classes: "bg-red-100 text-red-800 border-red-300",
      Icon: AlertCircle,
    };
  }
  if (dias === 0) {
    return {
      texto: "Vence hoy",
      classes: "bg-amber-100 text-amber-900 border-amber-300",
      Icon: AlertTriangle,
    };
  }
  if (dias <= 3) {
    return {
      texto: `Vence en ${dias} día${dias === 1 ? "" : "s"}`,
      classes: "bg-amber-100 text-amber-900 border-amber-300",
      Icon: AlertTriangle,
    };
  }
  if (dias <= 7) {
    return {
      texto: `Vence en ${dias} días`,
      classes: "bg-yellow-50 text-yellow-800 border-yellow-200",
      Icon: Clock,
    };
  }
  return {
    texto: `En ${dias} días`,
    classes: "bg-sky-50 text-sky-800 border-sky-200",
    Icon: Clock,
  };
}

export function CorrespondenciaAlertasList({
  items,
}: {
  items: DashboardCorrespondencia[];
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
        <Mail className="h-8 w-8 text-slate-300" />
        <p>No hay correspondencia con respuesta pendiente.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((c) => {
        const urg = urgenciaInfo(c.diasRestantes);
        const UrgIcon = urg.Icon;
        return (
          <li
            key={c.id}
            className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-2.5 transition-colors hover:bg-slate-50"
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                c.tipo === "ENTRADA"
                  ? "bg-sky-100 text-sky-700"
                  : "bg-orange-100 text-orange-700",
              )}
            >
              {c.tipo === "ENTRADA" ? (
                <ArrowDownToLine className="h-4 w-4" />
              ) : (
                <ArrowUpFromLine className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                to="/correspondencia"
                className="block truncate text-sm font-semibold text-foreground hover:underline"
                title={c.asunto}
              >
                {c.asunto}
              </Link>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{c.numero}</span>
                <span>·</span>
                <span className="truncate">{c.remitente}</span>
                <span>·</span>
                <span>{formatFecha(c.fechaMaximaRespuesta)}</span>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
                urg.classes,
              )}
            >
              <UrgIcon className="h-3 w-3" />
              {urg.texto}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
