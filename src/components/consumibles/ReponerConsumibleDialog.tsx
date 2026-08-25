/**
 * Dialog para reponer stock de un consumible (entrada manual sin
 * requisición). Crea un movimiento ENTRADA y suma al stock.
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ArrowDownToLine, Package, Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import type { Consumible } from "@/types/api";
import { UNIDADES_LABEL } from "@/types/api";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const schema = z.object({
  cantidad: z
    .number({ message: "Cantidad requerida" })
    .positive("Cantidad debe ser mayor a 0"),
  fecha: z
    .string()
    .regex(dateRegex, "Fecha inválida (YYYY-MM-DD)")
    .optional()
    .or(z.literal("")),
  observaciones: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
});

export type FormData = z.infer<typeof schema>;

interface ReponerConsumibleDialogProps {
  consumible: Consumible;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRepuesto?: () => void;
}

export function ReponerConsumibleDialog({
  consumible,
  open,
  onOpenChange,
  onRepuesto,
}: ReponerConsumibleDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      cantidad: 1,
      fecha: new Date().toISOString().slice(0, 10),
      observaciones: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        cantidad: 1,
        fecha: new Date().toISOString().slice(0, 10),
        observaciones: "",
      });
    }
  }, [open, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await api.reponerConsumible(consumible.id, {
        cantidad: Number(data.cantidad),
        fecha: data.fecha || undefined,
        observaciones: data.observaciones || undefined,
      });
      toast.success("Stock reabastecido", {
        description: `+${data.cantidad} ${UNIDADES_LABEL[consumible.unidad]} de ${consumible.concepto}`,
      });
      onRepuesto?.();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo reponer el stock";
      toast.error("Error al reponer", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Info del consumible */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-emerald-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-900">
              {consumible.concepto}
            </p>
            <p className="text-xs text-emerald-700">
              Stock actual:{" "}
              <span className="font-bold">
                {parseFloat(consumible.cantidadActual)}{" "}
                {UNIDADES_LABEL[consumible.unidad]}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Cantidad + Fecha */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cantidad">
            Cantidad a reponer<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="cantidad"
            type="number"
            step="0.01"
            min="0"
            className={cn(
              errors.cantidad && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("cantidad", { valueAsNumber: true })}
          />
          {errors.cantidad && (
            <p className="text-xs text-red-600">{errors.cantidad.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fecha" className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-emerald-700" />
            Fecha
          </Label>
          <Input
            id="fecha"
            type="date"
            className={cn(
              errors.fecha && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("fecha")}
          />
          {errors.fecha && (
            <p className="text-xs text-red-600">{errors.fecha.message}</p>
          )}
        </div>
      </div>

      {/* Observaciones */}
      <div className="space-y-1.5">
        <Label htmlFor="observaciones">Observaciones</Label>
        <textarea
          id="observaciones"
          rows={2}
          placeholder="Procedencia, factura, motivo (opcional)"
          className={cn(
            "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            errors.observaciones && "border-red-500 focus-visible:ring-red-500",
          )}
          {...register("observaciones")}
        />
        {errors.observaciones && (
          <p className="text-xs text-red-600">{errors.observaciones.message}</p>
        )}
      </div>

      {/* Botones */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="min-w-[140px] bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Reponiendo...
            </>
          ) : (
            <>
              <ArrowDownToLine className="h-4 w-4" />
              Reponer stock
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
