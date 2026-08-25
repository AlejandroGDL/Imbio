import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  UserPlus,
  User,
  Calendar,
  CalendarRange,
  Calculator,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import { useServerStatus } from "@/hooks/use-server-status";
import {
  TIPOS_PERSONAL_LABEL,
  type Personal,
  type Vacacion,
} from "@/types/api";

// =================================================================
// Validación con Zod
// =================================================================
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    personalId: z
      .number()
      .int()
      .positive("Selecciona un empleado"),
    fechaInicio: z
      .string()
      .regex(dateRegex, "Fecha de inicio inválida (YYYY-MM-DD)"),
    fechaFin: z
      .string()
      .regex(dateRegex, "Fecha de fin inválida (YYYY-MM-DD)"),
    diasSolicitados: z
      .number()
      .int()
      .positive("Días solicitados debe ser un entero positivo")
      .max(365, "Máximo 365 días por solicitud"),
    observaciones: z
      .string()
      .trim()
      .max(500, "Máximo 500 caracteres")
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => data.fechaFin >= data.fechaInicio, {
    message: "La fecha de fin debe ser igual o posterior a la fecha de inicio",
    path: ["fechaFin"],
  });

export type FormData = z.infer<typeof schema>;

// =================================================================
// Mapping de keys → etiqueta humana (para el banner de errores)
// =================================================================
const FIELD_LABELS: Record<keyof FormData, string> = {
  personalId: "Empleado",
  fechaInicio: "Fecha de inicio",
  fechaFin: "Fecha de fin",
  diasSolicitados: "Días solicitados",
  observaciones: "Observaciones",
};

// =================================================================
// Helper: calcula días entre dos fechas (inclusive)
// =================================================================
function diffDias(inicio: string, fin: string): number {
  if (!inicio || !fin) return 0;
  const a = new Date(`${inicio}T00:00:00Z`);
  const b = new Date(`${fin}T00:00:00Z`);
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86_400_000) + 1;
}

interface VacacionFormProps {
  initialData?: Vacacion;
  /** Lista de personal activo para popular el select. */
  personalList: Personal[];
  onSaved?: (item: Vacacion) => void;
  embedded?: boolean;
  onCancel?: () => void;
}

function toFormData(v: Vacacion): FormData {
  const ymd = (d: string) => (d && d.length >= 10 ? d.slice(0, 10) : "");
  return {
    personalId: v.personalId,
    fechaInicio: ymd(v.fechaInicio),
    fechaFin: ymd(v.fechaFin),
    diasSolicitados: v.diasSolicitados,
    observaciones: v.observaciones ?? "",
  };
}

function defaultFormData(): FormData {
  return {
    personalId: 0,
    fechaInicio: "",
    fechaFin: "",
    diasSolicitados: 0,
    observaciones: "",
  };
}

export function VacacionForm({
  initialData,
  personalList,
  onSaved,
  embedded = false,
  onCancel,
}: VacacionFormProps) {
  const { status } = useServerStatus();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!initialData;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitted },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData ? toFormData(initialData) : defaultFormData(),
  });

  // Watch de fechas para auto-calcular días
  const fechaInicio = watch("fechaInicio");
  const fechaFin = watch("fechaFin");
  const dias = watch("diasSolicitados");

  useEffect(() => {
    if (initialData) reset(toFormData(initialData));
  }, [initialData, reset]);

  // Días calculados (no se aplican al form, solo se muestran)
  const diasCalculados = useMemo(() => {
    if (!fechaInicio || !fechaFin) return 0;
    const n = diffDias(fechaInicio, fechaFin);
    return n > 0 ? n : 0;
  }, [fechaInicio, fechaFin]);

  // Opciones del Combobox
  const personalOptions: ComboboxOption[] = useMemo(
    () =>
      personalList.map((p) => ({
        value: p.id,
        label: `${p.apellidos} ${p.nombre}`,
        sublabel: `${p.puesto} · ${TIPOS_PERSONAL_LABEL[p.tipo]}`,
        disabled: !p.activo,
      })),
    [personalList],
  );

  const aplicarDiasCalculados = () => {
    if (diasCalculados > 0) {
      setValue("diasSolicitados", diasCalculados, { shouldDirty: true });
    }
  };

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const payload = {
        personalId: data.personalId,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
        diasSolicitados: data.diasSolicitados,
        observaciones: data.observaciones || undefined,
      };

      const result = isEdit
        ? await api.actualizarVacacion(initialData!.id, payload)
        : await api.crearVacacion(payload);

      const empName = result.personal
        ? `${result.personal.nombre} ${result.personal.apellidos}`
        : `Empleado #${result.personalId}`;

      toast.success(
        isEdit ? "Vacaciones actualizadas" : "Vacaciones registradas",
        {
          description: `${empName} — ${new Date(result.fechaInicio).toLocaleDateString("es-MX")} al ${new Date(result.fechaFin).toLocaleDateString("es-MX")} (${result.diasSolicitados} días) #${result.id}`,
        },
      );

      if (!isEdit) {
        reset(defaultFormData());
      }
      onSaved?.(result);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : isEdit
            ? "No se pudieron actualizar las vacaciones"
            : "No se pudieron registrar las vacaciones";
      toast.error(isEdit ? "Error al actualizar" : "Error al registrar", {
        description: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const serverDown = status !== "online";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Alerta global de campos faltantes / inválidos */}
      {isSubmitted && Object.keys(errors).length > 0 && (
        <Alert variant="destructive" className="text-left">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>
            Faltan{" "}
            {Object.keys(errors).length === 1
              ? "1 campo"
              : `${Object.keys(errors).length} campos`}{" "}
            por completar o corregir
          </AlertTitle>
          <AlertDescription>
            <p className="mb-2 text-red-800/80">
              Revisá los siguientes campos antes de guardar:
            </p>
            <ul className="ml-4 list-disc space-y-1 text-sm">
              {Object.entries(errors).map(([key, err]) => {
                const label = FIELD_LABELS[key as keyof FormData] ?? key;
                const msg = err?.message ?? "Inválido";
                return (
                  <li key={key}>
                    <span className="font-semibold">{label}:</span> {msg}
                  </li>
                );
              })}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Empleado */}
      <div className="space-y-1.5">
        <Label htmlFor="personalId">
          <User className="mr-1 inline h-3.5 w-3.5" />
          Empleado<span className="ml-1 text-red-500">*</span>
        </Label>
        <Combobox
          value={watch("personalId") || null}
          onChange={(v) =>
            setValue("personalId", (v as number) || 0, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
          options={personalOptions}
          placeholder="Busca y selecciona un empleado…"
          emptyMessage={
            personalList.length === 0
              ? "No hay personal activo"
              : "No hay coincidencias"
          }
          disabled={personalList.length === 0}
          required
        />
        <input
          type="hidden"
          {...register("personalId", { valueAsNumber: true })}
        />
        {errors.personalId && (
          <p className="text-xs text-red-600">{errors.personalId.message}</p>
        )}
        {personalList.length === 0 && (
          <p className="text-xs text-amber-700">
            No hay personal activo. Registrá personal en el tab "Personal" primero.
          </p>
        )}
      </div>

      {/* Fecha inicio + fin */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fechaInicio">
            <Calendar className="mr-1 inline h-3.5 w-3.5" />
            Fecha de inicio<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="fechaInicio"
            type="date"
            className={cn(
              errors.fechaInicio && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("fechaInicio")}
          />
          {errors.fechaInicio && (
            <p className="text-xs text-red-600">
              {errors.fechaInicio.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fechaFin">
            <CalendarRange className="mr-1 inline h-3.5 w-3.5" />
            Fecha de fin<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="fechaFin"
            type="date"
            className={cn(
              errors.fechaFin && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("fechaFin")}
          />
          {errors.fechaFin && (
            <p className="text-xs text-red-600">{errors.fechaFin.message}</p>
          )}
        </div>
      </div>

      {/* Días solicitados con auto-cálculo */}
      <div className="space-y-1.5">
        <Label htmlFor="diasSolicitados">
          Días solicitados<span className="ml-1 text-red-500">*</span>
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="diasSolicitados"
            type="number"
            min={1}
            max={365}
            className={cn(
              "w-24",
              errors.diasSolicitados &&
                "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("diasSolicitados", { valueAsNumber: true })}
          />
          {diasCalculados > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={aplicarDiasCalculados}
              title={`Aplicar ${diasCalculados} días (calculado del rango)`}
            >
              <Calculator className="h-3.5 w-3.5" />
              Aplicar {diasCalculados} {diasCalculados === 1 ? "día" : "días"}
            </Button>
          )}
        </div>
        {diasCalculados > 0 ? (
          <p className="text-xs text-muted-foreground">
            Diferencia entre fechas: {diasCalculados}{" "}
            {diasCalculados === 1 ? "día" : "días"} (incluye ambos extremos).
            {dias !== diasCalculados && dias > 0 && (
              <span className="ml-1 text-amber-700">
                (diferente de los {dias} capturados)
              </span>
            )}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Capturá las fechas y el sistema calculará los días. Podés
            ajustar manualmente si difieren (ej. excluyendo fines de semana).
          </p>
        )}
        {errors.diasSolicitados && (
          <p className="text-xs text-red-600">
            {errors.diasSolicitados.message}
          </p>
        )}
      </div>

      {/* Observaciones */}
      <div className="space-y-1.5">
        <Label htmlFor="observaciones">
          Observaciones{" "}
          <span className="text-xs font-normal text-muted-foreground">
            (Opcional)
          </span>
        </Label>
        <textarea
          id="observaciones"
          rows={3}
          placeholder="Notas adicionales (opcional)"
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

      {/* Botones */}
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={submitting || serverDown || (isEdit && !isDirty)}
          className="min-w-[140px] bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : isEdit ? (
            <>
              <Save className="h-4 w-4" />
              Guardar cambios
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              Registrar
            </>
          )}
        </Button>
      </div>

      {serverDown && !embedded && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <strong>Servidor desconectado.</strong> El formulario no podrá guardar hasta
          que conectes el servidor en{" "}
          <span className="font-semibold">Configuración</span>.
        </div>
      )}
    </form>
  );
}
