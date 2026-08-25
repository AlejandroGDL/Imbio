/**
 * StatCard — una tarjeta con icono, número grande y label.
 * Soporta un valor "extra" opcional abajo del número (ej. "+3 surtidas").
 */

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  /** Etiqueta pequeña bajo el número, ej. "3 pendientes" */
  extra?: string;
  icon: LucideIcon;
  /** Clases de Tailwind para el gradient del icono */
  gradient: string;
  /** Si está definido, muestra un punto/badge de alerta en la esquina */
  alert?: { count: number; label: string };
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  extra,
  icon: Icon,
  gradient,
  alert,
  onClick,
}: StatCardProps) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all",
        onClick && "cursor-pointer hover:border-slate-300 hover:shadow-md",
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
          gradient,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-2xl font-bold leading-tight text-foreground">
          {value}
        </p>
        {extra && (
          <p className="text-xs text-muted-foreground">{extra}</p>
        )}
      </div>
      {alert && alert.count > 0 && (
        <div className="absolute right-2 top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
          {alert.count}
        </div>
      )}
    </Wrapper>
  );
}
