/**
 * Card de acceso rápido en el dashboard.
 * Click navega al módulo correspondiente.
 */

import { type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AccesoRapidoCardProps {
  to: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  /** Clases de Tailwind para el gradient del icono */
  gradient: string;
}

export function AccesoRapidoCard({
  to,
  label,
  description,
  icon: Icon,
  gradient,
}: AccesoRapidoCardProps) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all",
        "hover:border-slate-300 hover:shadow-md",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm transition-transform group-hover:scale-105",
          gradient,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {description && (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <span className="text-xs text-muted-foreground transition-transform group-hover:translate-x-0.5">
        Ir →
      </span>
    </Link>
  );
}
