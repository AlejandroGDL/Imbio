/**
 * Badge visual para el status de Correspondencia.
 * Colores:
 *  - PENDIENTE → amber (esperando)
 *  - ATENDIDO  → emerald (ya gestionado)
 *  - ARCHIVADO → slate (cerrado, sin acción)
 */

import {
  Clock,
  CheckCircle2,
  Archive,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { StatusCorrespondencia } from "@/types/api";

interface StatusBadgeProps {
  status: StatusCorrespondencia;
  className?: string;
}

const STYLES: Record<
  StatusCorrespondencia,
  { label: string; classes: string; Icon: LucideIcon }
> = {
  PENDIENTE: {
    label: "Pendiente",
    classes: "bg-amber-100 text-amber-800 border-amber-200",
    Icon: Clock,
  },
  ATENDIDO: {
    label: "Atendido",
    classes: "bg-emerald-100 text-emerald-800 border-emerald-200",
    Icon: CheckCircle2,
  },
  ARCHIVADO: {
    label: "Archivado",
    classes: "bg-slate-100 text-slate-700 border-slate-200",
    Icon: Archive,
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = STYLES[status];
  if (!cfg) return null;
  const Icon = cfg.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        cfg.classes,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}
