/**
 * Dropdown clickeable para cambiar el status de una Correspondencia
 * directamente desde la lista, sin abrir el formulario de edición.
 *
 * Usa el endpoint dedicado PATCH /correspondencias/:id/status que solo
 * actualiza ese campo (más rápido que el PATCH general).
 */

import { useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Clock,
  CheckCircle2,
  Archive,
  Loader2,
  type LucideIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import type {
  Correspondencia,
  StatusCorrespondencia,
} from "@/types/api";

const STATUS_OPTIONS: {
  value: StatusCorrespondencia;
  label: string;
  classes: string;
  Icon: LucideIcon;
}[] = [
  {
    value: "PENDIENTE",
    label: "Pendiente",
    classes: "bg-amber-100 text-amber-800 border-amber-200",
    Icon: Clock,
  },
  {
    value: "ATENDIDO",
    label: "Atendido",
    classes: "bg-emerald-100 text-emerald-800 border-emerald-200",
    Icon: CheckCircle2,
  },
  {
    value: "ARCHIVADO",
    label: "Archivado",
    classes: "bg-slate-100 text-slate-700 border-slate-200",
    Icon: Archive,
  },
];

interface StatusDropdownProps {
  item: Correspondencia;
  onUpdated: (item: Correspondencia) => void;
  disabled?: boolean;
}

export function StatusDropdown({
  item,
  onUpdated,
  disabled = false,
}: StatusDropdownProps) {
  const [loading, setLoading] = useState(false);
  const current = STATUS_OPTIONS.find((s) => s.value === item.status);
  if (!current) return null;
  const Icon = current.Icon;

  const handleSelect = async (newStatus: StatusCorrespondencia) => {
    if (newStatus === item.status || loading) return;
    setLoading(true);
    try {
      const updated = await api.cambiarStatusCorrespondencia(item.id, newStatus);
      const label = STATUS_OPTIONS.find((s) => s.value === newStatus)?.label;
      toast.success("Status actualizado", {
        description: `${item.tipoDocumento} #${item.numero} → ${label}`,
      });
      onUpdated(updated);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "No se pudo cambiar el status";
      toast.error("Error al cambiar status", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled || loading}
          className={cn(
            "group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            current.classes,
            !disabled &&
              !loading &&
              "cursor-pointer hover:shadow-sm hover:brightness-95",
            (disabled || loading) && "cursor-default opacity-80",
          )}
          title="Click para cambiar status"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Icon className="h-3 w-3" />
          )}
          {current.label}
          {!loading && (
            <ChevronDown className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Cambiar status
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {STATUS_OPTIONS.map((opt) => {
          const OptIcon = opt.Icon;
          const isCurrent = opt.value === item.status;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              disabled={isCurrent || loading}
              className="flex items-center gap-2"
            >
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                  opt.classes,
                )}
              >
                <OptIcon className="h-2.5 w-2.5" />
                {opt.label}
              </span>
              {isCurrent && (
                <Check className="ml-auto h-3.5 w-3.5 text-sky-600" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
