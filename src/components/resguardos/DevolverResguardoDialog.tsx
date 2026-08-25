/**
 * Dialog para devolver un Resguardo (deja al equipo en bodega).
 * Cierra el registro abierto en el historial y actualiza el estado.
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDownToLine, Calendar, StickyNote, ShieldCheck, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import type { Resguardo } from "@/types/api";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const schema = z.object({
  fechaDevolucion: z
    .string()
    .regex(dateRegex, "Fecha inválida (YYYY-MM-DD)")
    .optional()
    .or(z.literal("")),
  motivo: z
    .string()
    .trim()
    .max(200, "Máximo 200 caracteres")
    .optional()
    .or(z.literal("")),
  observaciones: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

export type FormData = z.infer<typeof schema>;

interface DevolverResguardoDialogProps {
  resguardo: Resguardo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDevuelto?: () => void;
}

export function DevolverResguardoDialog({
  resguardo,
  open,
  onOpenChange,
  onDevuelto,
}: DevolverResguardoDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fechaDevolucion: new Date().toISOString().slice(0, 10),
      motivo: "",
      observaciones: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        fechaDevolucion: new Date().toISOString().slice(0, 10),
        motivo: "",
        observaciones: "",
      });
    }
  }, [open, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      await api.devolverResguardo(resguardo.id, {
        fechaDevolucion: data.fechaDevolucion || undefined,
        motivo: data.motivo || undefined,
        observaciones: data.observaciones || undefined,
      });
      toast.success("Resguardo devuelto", {
        description: `${resguardo.tipo} ${resguardo.marca} (S/N ${resguardo.numeroSerie}) — disponible en bodega`,
      });
      onDevuelto?.();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo devolver el resguardo";
      toast.error("Error al devolver", { description: msg });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-900">
              {resguardo.tipo} {resguardo.marca}
              {resguardo.modelo && ` · ${resguardo.modelo}`}
            </p>
            <p className="font-mono text-xs text-emerald-700">
              S/N: {resguardo.numeroSerie}
            </p>
            {resguardo.personalActual && (
              <p className="mt-1 flex items-center gap-1 text-xs text-emerald-800">
                <User className="h-3 w-3" />
                Asignado a:{" "}
                <span className="font-semibold">
                  {resguardo.personalActual.nombre} {resguardo.personalActual.apellidos}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fechaDevolucion" className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-emerald-700" />
            Fecha de devolución
          </Label>
          <Input
            id="fechaDevolucion"
            type="date"
            {...register("fechaDevolucion")}
          />
          {errors.fechaDevolucion && (
            <p className="text-xs text-red-600">
              {errors.fechaDevolucion.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="motivo" className="flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5 text-emerald-700" />
            Motivo
          </Label>
          <Input
            id="motivo"
            placeholder="Ej. Cambio de equipo, fin de contrato"
            {...register("motivo")}
          />
          {errors.motivo && (
            <p className="text-xs text-red-600">{errors.motivo.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="observaciones">Observaciones</Label>
        <textarea
          id="observaciones"
          rows={2}
          placeholder="Estado del equipo, accesorios devueltos, etc. (opcional)"
          className={cn(
            "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            errors.observaciones && "border-red-500 focus-visible:ring-red-500",
          )}
          {...register("observaciones")}
        />
        {errors.observaciones && (
          <p className="text-xs text-red-600">
            {errors.observaciones.message}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="min-w-[140px] bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
        >
          <ArrowDownToLine className="h-4 w-4" />
          Devolver a bodega
        </Button>
      </div>
    </form>
  );
}
