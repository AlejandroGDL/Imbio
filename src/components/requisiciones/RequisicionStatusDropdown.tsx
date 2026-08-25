/**
 * Dropdown clickeable para cambiar el status (surtido/pendiente) de
 * una Requisición directamente desde la lista.
 *
 * Cuando se marca como Surtido se solicita la fecha de entrega en un
 * dialog. Cuando se marca como Pendiente se aplica de inmediato.
 *
 * Internamente usa el endpoint PATCH /requisiciones/:id (no hay
 * endpoint dedicado de status como en Correspondencia).
 */

import { useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  CheckCircle2,
  Clock,
  Loader2,
  Calendar,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import type { Requisicion } from "@/types/api";

const STATUS_OPTIONS: {
  value: "PENDIENTE" | "SURTIDO";
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
    value: "SURTIDO",
    label: "Surtido",
    classes: "bg-emerald-100 text-emerald-800 border-emerald-200",
    Icon: CheckCircle2,
  },
];

interface RequisicionStatusDropdownProps {
  item: Requisicion;
  onUpdated: (item: Requisicion) => void;
  disabled?: boolean;
}

export function RequisicionStatusDropdown({
  item,
  onUpdated,
  disabled = false,
}: RequisicionStatusDropdownProps) {
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fechaEntrega, setFechaEntrega] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [errorFecha, setErrorFecha] = useState<string | null>(null);

  const currentValue = item.surtido ? "SURTIDO" : "PENDIENTE";
  const current = STATUS_OPTIONS.find((s) => s.value === currentValue);
  if (!current) return null;
  const Icon = current.Icon;

  const handleSelect = (value: "PENDIENTE" | "SURTIDO") => {
    if (value === currentValue || loading) return;
    if (value === "SURTIDO") {
      // Pre-rellenar con la fecha actual o con la ya existente
      setFechaEntrega(
        item.fechaEntrega && item.fechaEntrega.length >= 10
          ? item.fechaEntrega.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      );
      setErrorFecha(null);
      setDialogOpen(true);
      return;
    }
    // Pendiente: aplicar directo
    void applyChange(false, null);
  };

  const applyChange = async (
    surtido: boolean,
    fecha: string | null,
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const updated = await api.actualizarRequisicion(item.id, {
        surtido,
        fechaEntrega: fecha ?? undefined,
      });
      const label = surtido ? "Surtido" : "Pendiente";
      toast.success("Status actualizado", {
        description: `#${item.numero} → ${label}`,
      });
      onUpdated(updated);
      return true;
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "No se pudo cambiar el status";
      toast.error("Error al cambiar status", { description: msg });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSurtido = async () => {
    if (!fechaEntrega) {
      setErrorFecha("La fecha de entrega es obligatoria");
      return;
    }
    setErrorFecha(null);
    const ok = await applyChange(true, fechaEntrega);
    if (ok) setDialogOpen(false);
  };

  return (
    <>
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
            const isCurrent = opt.value === currentValue;
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
                  <Check className="ml-auto h-3.5 w-3.5 text-cyan-600" />
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog: pedir fecha de entrega al marcar como Surtido */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Marcar como surtido
            </DialogTitle>
            <DialogDescription>
              Indica la fecha de entrega para la requisición{" "}
              <span className="font-mono font-semibold">#{item.numero}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="fechaEntregaInline" className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-emerald-700" />
              Fecha de entrega<span className="ml-1 text-red-500">*</span>
            </Label>
            <Input
              id="fechaEntregaInline"
              type="date"
              value={fechaEntrega}
              onChange={(e) => {
                setFechaEntrega(e.target.value);
                if (errorFecha) setErrorFecha(null);
              }}
              className={cn(errorFecha && "border-red-500 focus-visible:ring-red-500")}
            />
            {errorFecha && (
              <p className="text-xs text-red-600">{errorFecha}</p>
            )}
            {item.esConsumible && (
              <p className="text-xs text-muted-foreground">
                💡 Esta requisición está marcada como consumible. Al confirmar,
                se creará una entrada en el catálogo de Consumibles.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSurtido}
              disabled={loading || !fechaEntrega}
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar surtido
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
