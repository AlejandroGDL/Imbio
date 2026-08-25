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
  TIPOS_INCIDENCIA_LABEL,
  TIPOS_PERSONAL_LABEL,
  type Incidencia,
  type Personal,
} from "@/types/api";

// =================================================================
// Validación con Zod
// =================================================================
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const schema = z.object({
  personalId: z
    .number()
    .int()
    .positive("Selecciona un empleado"),
  tipo: z.enum(
    [
      "FALTA",
      "JUSTIFICANTE",
      "RETARDO",
      "PERMISO_SIN_GOCE_SUELDO",
      "PERMISO_CON_GOCE_SUELDO",
    ],
    { message: "Selecciona un tipo de incidencia" },
  ),
  fecha: z
    .string()
    .regex(dateRegex, "Fecha inválida (YYYY-MM-DD)"),
  descripcion: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
});

export type FormData = z.infer<typeof schema>;

// =================================================================
// Mapping de keys → etiqueta humana (para el banner de errores)
// =================================================================
const FIELD_LABELS: Record<keyof FormData, string> = {
  personalId: "Empleado",
  tipo: "Tipo de incidencia",
  fecha: "Fecha",
  descripcion: "Descripción",
};

interface IncidenciaFormProps {
  initialData?: Incidencia;
  /** Lista de personal activo para popular el select. */
  personalList: Personal[];
  onSaved?: (item: Incidencia) => void;
  embedded?: boolean;
  onCancel?: () => void;
}

function toFormData(i: Incidencia): FormData {
  const fecha = i.fecha.length >= 10 ? i.fecha.slice(0, 10) : i.fecha;
  return {
    personalId: i.personalId,
    tipo: i.tipo,
    fecha,
    descripcion: i.descripcion ?? "",
  };
}

function defaultFormData(): FormData {
  return {
    personalId: 0,
    tipo: "FALTA",
    fecha: "",
    descripcion: "",
  };
}

export function IncidenciaForm({
  initialData,
  personalList,
  onSaved,
  embedded = false,
  onCancel,
}: IncidenciaFormProps) {
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

  // Valor actual del empleado (para el Combobox controlado)
  const personalIdValue = watch("personalId");

  // Opciones del Combobox (memorizadas)
  const personalOptions: ComboboxOption[] = useMemo(
    () =>
      personalList.map((p) => ({
        value: p.id,
        label: `${p.apellidos} ${p.nombre}`,
        sublabel: `${p.puesto} · ${TIPOS_PERSONAL_LABEL[p.tipo]}`,
        // Si está inactivo, deshabilitar en el select
        disabled: !p.activo,
      })),
    [personalList],
  );

  useEffect(() => {
    if (initialData) reset(toFormData(initialData));
  }, [initialData, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const payload = {
        personalId: data.personalId,
        tipo: data.tipo,
        fecha: data.fecha,
        descripcion: data.descripcion || undefined,
      };

      const result = isEdit
        ? await api.actualizarIncidencia(initialData!.id, payload)
        : await api.crearIncidencia(payload);

      const empName = result.personal
        ? `${result.personal.nombre} ${result.personal.apellidos}`
        : `Empleado #${result.personalId}`;

      toast.success(
        isEdit ? "Incidencia actualizada" : "Incidencia registrada",
        {
          description: `${TIPOS_INCIDENCIA_LABEL[result.tipo]} — ${empName} — ${new Date(result.fecha).toLocaleDateString("es-MX")}`,
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
            ? "No se pudo actualizar la incidencia"
            : "No se pudo registrar la incidencia";
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
          value={personalIdValue || null}
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
        {/* Input hidden para que react-hook-form registre el campo y aplique validaciones */}
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

      {/* Tipo */}
      <div className="space-y-1.5">
        <Label htmlFor="tipo">
          Tipo de incidencia<span className="ml-1 text-red-500">*</span>
        </Label>
        <select
          id="tipo"
          className={cn(
            "flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            errors.tipo && "border-red-500 focus-visible:ring-red-500",
          )}
          {...register("tipo")}
        >
          {(
            Object.keys(TIPOS_INCIDENCIA_LABEL) as Array<keyof typeof TIPOS_INCIDENCIA_LABEL>
          ).map((k) => (
            <option key={k} value={k}>
              {TIPOS_INCIDENCIA_LABEL[k]}
            </option>
          ))}
        </select>
        {errors.tipo && (
          <p className="text-xs text-red-600">{errors.tipo.message}</p>
        )}
      </div>

      {/* Fecha */}
      <div className="space-y-1.5">
        <Label htmlFor="fecha">
          <Calendar className="mr-1 inline h-3.5 w-3.5" />
          Fecha<span className="ml-1 text-red-500">*</span>
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

      {/* Descripción */}
      <div className="space-y-1.5">
        <Label htmlFor="descripcion">
          Descripción{" "}
          <span className="text-xs font-normal text-muted-foreground">
            (Opcional)
          </span>
        </Label>
        <textarea
          id="descripcion"
          rows={3}
          placeholder="Detalle de la incidencia (opcional)"
          className={cn(
            "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            errors.descripcion && "border-red-500 focus-visible:ring-red-500",
          )}
          {...register("descripcion")}
        />
        {errors.descripcion && (
          <p className="text-xs text-red-600">{errors.descripcion.message}</p>
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
          className="min-w-[140px] bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700"
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
