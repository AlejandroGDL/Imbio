/**
 * Dialog para dar de baja un Resguardo.
 * Cierra cualquier asignación abierta y marca el equipo como BAJA.
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { XCircle, AlertTriangle, StickyNote, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import type { Resguardo } from "@/types/api";

const schema = z.object({
  motivo: z
    .string()
    .trim()
    .min(1, "Motivo de baja requerido")
    .max(200, "Máximo 200 caracteres"),
  observaciones: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

export type FormData = z.infer<typeof schema>;

interface BajaResguardoDialogProps {
  resguardo: Resguardo;
  onClose: () => void;
  onBaja?: () => void;
}

export function BajaResguardoDialog({
  resguardo,
  onClose,
  onBaja,
}: BajaResguardoDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { motivo: "", observaciones: "" },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await api.darBajaResguardo(resguardo.id, {
        motivo: data.motivo,
        observaciones: data.observaciones || undefined,
      });
      toast.success("Resguardo dado de baja", {
        description: `${resguardo.tipo} ${resguardo.marca} (S/N ${resguardo.numeroSerie})`,
      });
      onBaja?.();
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo dar de baja";
      toast.error("Error al dar de baja", { description: msg });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>¿Dar de baja este equipo?</AlertTitle>
        <AlertDescription>
          El equipo quedará marcado como <strong>BAJA</strong> y ya no podrá
          asignarse. Esta acción queda registrada en el historial.
        </AlertDescription>
      </Alert>

      {isSubmitted && Object.keys(errors).length > 0 && (
        <Alert variant="destructive" className="text-left">
          <ul className="ml-4 list-disc space-y-1 text-sm">
            {Object.entries(errors).map(([key, err]) => (
              <li key={key}>
                <span className="font-semibold">
                  {key === "motivo" ? "Motivo" : "Observaciones"}:
                </span>{" "}
                {err.message as string}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-900">
              {resguardo.tipo} {resguardo.marca}
              {resguardo.modelo && ` · ${resguardo.modelo}`}
            </p>
            <p className="font-mono text-xs text-red-700">
              S/N: {resguardo.numeroSerie}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="motivo" className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-red-700" />
          Motivo de baja<span className="ml-1 text-red-500">*</span>
        </Label>
        <Input
          id="motivo"
          placeholder="Ej. Equipo obsoleto, robo, daño irreparable"
          className={cn(
            errors.motivo && "border-red-500 focus-visible:ring-red-500",
          )}
          {...register("motivo")}
        />
        {errors.motivo && (
          <p className="text-xs text-red-600">{errors.motivo.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="observaciones" className="flex items-center gap-1.5">
          <StickyNote className="h-3.5 w-3.5 text-red-700" />
          Observaciones
        </Label>
        <textarea
          id="observaciones"
          rows={2}
          placeholder="Detalles adicionales (opcional)"
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
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="submit"
          className="min-w-[140px] bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800"
        >
          <XCircle className="h-4 w-4" />
          Dar de baja
        </Button>
      </div>
    </form>
  );
}
