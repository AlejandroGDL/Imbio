/**
 * Dialog para asignar un Resguardo a un empleado.
 * Crea un registro en el historial y actualiza el estado del equipo.
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Send, User, Calendar, ShieldCheck, StickyNote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import type { Resguardo } from "@/types/api";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    personalId: z.number({ message: "Selecciona un empleado" }).int().positive(),
    fechaAsignacion: z
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

const FIELD_LABELS: Record<keyof FormData, string> = {
  personalId: "Empleado",
  fechaAsignacion: "Fecha de asignación",
  motivo: "Motivo",
  observaciones: "Observaciones",
};

interface AsignarResguardoDialogProps {
  resguardo: Resguardo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAsignado?: () => void;
}

export function AsignarResguardoDialog({
  resguardo,
  open,
  onOpenChange,
  onAsignado,
}: AsignarResguardoDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [personalOptions, setPersonalOptions] = useState<
    { value: number; label: string; sublabel?: string; disabled?: boolean }[]
  >([]);
  const [loadingPersonal, setLoadingPersonal] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitted },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      personalId: 0,
      fechaAsignacion: new Date().toISOString().slice(0, 10),
      motivo: "",
      observaciones: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        personalId: 0,
        fechaAsignacion: new Date().toISOString().slice(0, 10),
        motivo: "",
        observaciones: "",
      });
      setLoadingPersonal(true);
      api
        .listarPersonal({ activo: true, limit: 200 })
        .then((res) => {
          setPersonalOptions(
            res.data.map((p) => ({
              value: p.id,
              label: `${p.nombre} ${p.apellidos}`,
              sublabel: p.puesto,
            })),
          );
        })
        .catch(() => toast.error("No se pudo cargar el personal"))
        .finally(() => setLoadingPersonal(false));
    }
  }, [open, reset]);

  const personalId = watch("personalId");

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await api.asignarResguardo(resguardo.id, {
        personalId: data.personalId,
        fechaAsignacion: data.fechaAsignacion || undefined,
        motivo: data.motivo || undefined,
        observaciones: data.observaciones || undefined,
      });
      toast.success("Resguardo asignado", {
        description: `${resguardo.tipo} ${resguardo.marca} (S/N ${resguardo.numeroSerie})`,
      });
      onAsignado?.();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo asignar el resguardo";
      toast.error("Error al asignar", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {isSubmitted && errorCount > 0 && (
        <Alert variant="destructive" className="text-left">
          <AlertTitle>
            {errorCount === 1
              ? "Falta 1 campo por completar"
              : `Faltan ${errorCount} campos por completar`}
          </AlertTitle>
          <AlertDescription>
            <ul className="ml-4 list-disc space-y-1 text-sm">
              {Object.entries(errors).map(([key, err]) => (
                <li key={key}>
                  <span className="font-semibold">
                    {FIELD_LABELS[key as keyof FormData] ?? key}:
                  </span>{" "}
                  {err.message as string}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/50 p-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-fuchsia-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-fuchsia-900">
              {resguardo.tipo} {resguardo.marca}
              {resguardo.modelo && ` · ${resguardo.modelo}`}
            </p>
            <p className="font-mono text-xs text-fuchsia-700">
              S/N: {resguardo.numeroSerie}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-fuchsia-700" />
          Empleado que recibe<span className="ml-1 text-red-500">*</span>
        </Label>
        {loadingPersonal ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando personal...
          </div>
        ) : (
          <Combobox
            value={personalId || null}
            onChange={(v) => {
              const id = v == null ? 0 : typeof v === "string" ? parseInt(v, 10) : v;
              setValue("personalId", id, { shouldValidate: true });
            }}
            options={personalOptions}
            placeholder="Busca un empleado..."
            emptyMessage="No hay empleados activos"
            required
          />
        )}
        {errors.personalId && (
          <p className="text-xs text-red-600">{errors.personalId.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fechaAsignacion" className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-fuchsia-700" />
            Fecha de asignación
          </Label>
          <Input
            id="fechaAsignacion"
            type="date"
            {...register("fechaAsignacion")}
          />
          {errors.fechaAsignacion && (
            <p className="text-xs text-red-600">
              {errors.fechaAsignacion.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="motivo" className="flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5 text-fuchsia-700" />
            Motivo
          </Label>
          <Input
            id="motivo"
            placeholder="Ej. Equipo nuevo, reemplazo"
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
          placeholder="Notas adicionales (opcional)"
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
          className="min-w-[140px] bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Asignando...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Asignar
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
