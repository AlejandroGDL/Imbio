import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save, Trees, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import { useServerStatus } from "@/hooks/use-server-status";
import {
  AREAS_VERDES_OPCIONES,
  TIPOS_EVENTO_OPCIONES,
  type AreaVerde,
} from "@/types/api";

// =================================================================
// Validación con Zod
// =================================================================
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const telRegex = /^\d{10}$/;

const schema = z
  .object({
    areaVerde: z
      .string()
      .trim()
      .min(1, "Selecciona un área verde"),
    // Ubicación específica dentro del área (esquina, sector, etc.).
    ubicacion: z
      .string()
      .trim()
      .min(1, "Ubicación requerida")
      .max(200, "Máximo 200 caracteres"),
    usuario: z
      .string()
      .trim()
      .min(1, "Usuario / institución requerido")
      .max(160, "Máximo 160 caracteres"),
    tipoEvento: z
      .string()
      .trim()
      .min(1, "Selecciona un tipo de evento")
      .refine(
        (v) => (TIPOS_EVENTO_OPCIONES as readonly string[]).includes(v),
        "Tipo de evento no válido",
      ),
    fecha: z
      .string()
      .regex(dateRegex, "Fecha inválida (formato YYYY-MM-DD)"),
    horaInicio: z
      .string()
      .regex(timeRegex, "Hora inválida (HH:MM 24h)"),
    horaFin: z
      .string()
      .regex(timeRegex, "Hora inválida (HH:MM 24h)"),
    // Hora de montaje (cuando llegan a armar)
    horaMontaje: z
      .string()
      .regex(timeRegex, "Hora inválida (HH:MM 24h)"),
    // Hora de desmontaje (cuando retiran todo)
    horaDesmontaje: z
      .string()
      .regex(timeRegex, "Hora inválida (HH:MM 24h)"),
    responsable: z
      .string()
      .trim()
      .min(1, "Responsable requerido")
      .max(160, "Máximo 160 caracteres"),
    telefono: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || telRegex.test(v),
        "Teléfono inválido (10 dígitos)",
      ),
    observaciones: z
      .string()
      .trim()
      .max(1000, "Máximo 1000 caracteres")
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => data.horaFin > data.horaInicio, {
    message: "La hora de fin debe ser posterior a la hora de inicio",
    path: ["horaFin"],
  })
  .refine((data) => data.horaDesmontaje > data.horaMontaje, {
    message: "La hora de desmontaje debe ser posterior a la hora de montaje",
    path: ["horaDesmontaje"],
  });

export type FormData = z.infer<typeof schema>;

interface AreaVerdeFormProps {
  initialData?: AreaVerde;
  onSaved?: (item: AreaVerde) => void;
  embedded?: boolean;
  onCancel?: () => void;
}

function toFormData(a: AreaVerde): FormData {
  // fecha viene como ISO (YYYY-MM-DDTHH:MM:SS.sssZ o solo YYYY-MM-DD)
  const fecha = a.fecha.length >= 10 ? a.fecha.slice(0, 10) : a.fecha;
  return {
    areaVerde: a.areaVerde,
    ubicacion: a.ubicacion ?? "",
    usuario: a.usuario,
    tipoEvento: a.tipoEvento,
    fecha,
    horaInicio: a.horaInicio,
    horaFin: a.horaFin,
    // Si no hay horaMontaje/Desmontaje, fallback a horaInicio/Fin
    horaMontaje: a.horaMontaje ?? a.horaInicio,
    horaDesmontaje: a.horaDesmontaje ?? a.horaFin,
    responsable: a.responsable,
    telefono: a.telefono ?? "",
    observaciones: a.observaciones ?? "",
  };
}

function defaultFormData(): FormData {
  return {
    areaVerde: "",
    ubicacion: "",
    usuario: "",
    tipoEvento: "",
    fecha: "",
    horaInicio: "",
    horaFin: "",
    horaMontaje: "",
    horaDesmontaje: "",
    responsable: "",
    telefono: "",
    observaciones: "",
  };
}

/**
 * Si el `tipoEvento` actual no está en la lista predefinida (datos
 * creados antes de que el campo fuera un select), lo devuelve
 * marcado como "(valor anterior)" para que no se pierda al editar.
 */
function tiposEventoOptions(currentValue: string): string[] {
  if (
    currentValue &&
    !(TIPOS_EVENTO_OPCIONES as readonly string[]).includes(currentValue)
  ) {
    return [currentValue, ...TIPOS_EVENTO_OPCIONES];
  }
  return [...TIPOS_EVENTO_OPCIONES];
}

export function AreaVerdeForm({
  initialData,
  onSaved,
  embedded = false,
  onCancel,
}: AreaVerdeFormProps) {
  const { status } = useServerStatus();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!initialData;
  const tiposOptions = tiposEventoOptions(initialData?.tipoEvento ?? "");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData ? toFormData(initialData) : defaultFormData(),
  });

  useEffect(() => {
    if (initialData) reset(toFormData(initialData));
  }, [initialData, reset]);

  // Auto-completar horaMontaje cuando cambia horaInicio
  // y horaDesmontaje cuando cambia horaFin (solo si están vacíos)
  const horaInicio = watch("horaInicio");
  const horaFin = watch("horaFin");
  const horaMontaje = watch("horaMontaje");
  const horaDesmontaje = watch("horaDesmontaje");
  useEffect(() => {
    if (horaInicio && !horaMontaje) {
      setValue("horaMontaje", horaInicio, { shouldValidate: false });
    }
  }, [horaInicio, horaMontaje, setValue]);
  useEffect(() => {
    if (horaFin && !horaDesmontaje) {
      setValue("horaDesmontaje", horaFin, { shouldValidate: false });
    }
  }, [horaFin, horaDesmontaje, setValue]);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const payload = {
        areaVerde: data.areaVerde,
        ubicacion: data.ubicacion,
        usuario: data.usuario,
        tipoEvento: data.tipoEvento,
        fecha: data.fecha,
        horaInicio: data.horaInicio,
        horaFin: data.horaFin,
        horaMontaje: data.horaMontaje,
        horaDesmontaje: data.horaDesmontaje,
        responsable: data.responsable,
        telefono: data.telefono || undefined,
        observaciones: data.observaciones || undefined,
      };

      const result = isEdit
        ? await api.actualizarAreaVerde(initialData!.id, payload)
        : await api.crearAreaVerde(payload);

      toast.success(
        isEdit ? "Reserva actualizada" : "Reserva registrada",
        {
          description: `${result.areaVerde} — ${new Date(
            result.fecha,
          ).toLocaleDateString("es-MX")} #${result.id}`,
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
            ? "No se pudo actualizar la reserva"
            : "No se pudo registrar la reserva";
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
      {/* Área verde + Ubicación */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="areaVerde">
            Área Verde<span className="ml-1 text-red-500">*</span>
          </Label>
          <div className="relative">
            <Trees className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              id="areaVerde"
              className={cn(
                "flex h-9 w-full appearance-none rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                errors.areaVerde && "border-red-500 focus-visible:ring-red-500",
              )}
              {...register("areaVerde")}
            >
              <option value="">Selecciona un área verde…</option>
              {AREAS_VERDES_OPCIONES.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
          {errors.areaVerde && (
            <p className="text-xs text-red-600">{errors.areaVerde.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ubicacion">
            Ubicación<span className="ml-1 text-red-500">*</span>
          </Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="ubicacion"
              placeholder="Ej. Esquina norte, frente a la presidencia"
              maxLength={200}
              className={cn("pl-9", errors.ubicacion && "border-red-500 focus-visible:ring-red-500")}
              {...register("ubicacion")}
            />
          </div>
          {errors.ubicacion ? (
            <p className="text-xs text-red-600">{errors.ubicacion.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Punto específico dentro del área verde
            </p>
          )}
        </div>
      </div>

      {/* Usuario / Institución + Tipo de evento */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="usuario">
            Usuario / Institución<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="usuario"
            placeholder="Ej. Escuela Primaria Benito Juárez"
            className={cn(errors.usuario && "border-red-500 focus-visible:ring-red-500")}
            {...register("usuario")}
          />
          {errors.usuario && (
            <p className="text-xs text-red-600">{errors.usuario.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tipoEvento">
            Tipo de evento<span className="ml-1 text-red-500">*</span>
          </Label>
          <select
            id="tipoEvento"
            className={cn(
              "flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              errors.tipoEvento && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("tipoEvento")}
          >
            <option value="">Selecciona un tipo de evento…</option>
            {tiposOptions.map((op) => {
              const isLegacy =
                !(TIPOS_EVENTO_OPCIONES as readonly string[]).includes(op) &&
                op === initialData?.tipoEvento;
              return (
                <option key={op} value={op}>
                  {isLegacy ? `${op} (valor anterior)` : op}
                </option>
              );
            })}
          </select>
          {errors.tipoEvento && (
            <p className="text-xs text-red-600">{errors.tipoEvento.message}</p>
          )}
        </div>
      </div>

      {/* Fecha + Horario del evento (inicio/fin) */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="fecha">
            Fecha<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="fecha"
            type="date"
            className={cn(errors.fecha && "border-red-500 focus-visible:ring-red-500")}
            {...register("fecha")}
          />
          {errors.fecha && (
            <p className="text-xs text-red-600">{errors.fecha.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="horaInicio">
            Hora de inicio<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="horaInicio"
            type="time"
            className={cn(
              errors.horaInicio && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("horaInicio")}
          />
          {errors.horaInicio && (
            <p className="text-xs text-red-600">{errors.horaInicio.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="horaFin">
            Hora de fin<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="horaFin"
            type="time"
            className={cn(
              errors.horaFin && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("horaFin")}
          />
          {errors.horaFin && (
            <p className="text-xs text-red-600">{errors.horaFin.message}</p>
          )}
        </div>
      </div>

      {/* Horario logístico (montaje / desmontaje) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="horaMontaje">
            Hora de montaje<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="horaMontaje"
            type="time"
            className={cn(
              errors.horaMontaje && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("horaMontaje")}
          />
          {errors.horaMontaje ? (
            <p className="text-xs text-red-600">{errors.horaMontaje.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Cuándo llegan a armar el evento
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="horaDesmontaje">
            Hora de desmontaje<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="horaDesmontaje"
            type="time"
            className={cn(
              errors.horaDesmontaje && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("horaDesmontaje")}
          />
          {errors.horaDesmontaje ? (
            <p className="text-xs text-red-600">{errors.horaDesmontaje.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Cuándo retiran todo (fin del evento + 1 h)
            </p>
          )}
        </div>
      </div>

      {/* Responsable + Teléfono */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="responsable">
            Responsable<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="responsable"
            placeholder="Nombre completo del responsable"
            className={cn(
              errors.responsable && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("responsable")}
          />
          {errors.responsable && (
            <p className="text-xs text-red-600">{errors.responsable.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            placeholder="4491234567"
            inputMode="numeric"
            maxLength={10}
            className={cn(
              "font-mono",
              errors.telefono && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("telefono")}
          />
          {errors.telefono ? (
            <p className="text-xs text-red-600">{errors.telefono.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">10 dígitos (opcional)</p>
          )}
        </div>
      </div>

      {/* Observaciones */}
      <div className="space-y-1.5">
        <Label htmlFor="observaciones">Observaciones</Label>
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
          <p className="text-xs text-red-600">{errors.observaciones.message}</p>
        )}
      </div>

      {/* Botones */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={submitting || serverDown || (isEdit && !isDirty)}
          className="min-w-[140px] bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-600 hover:to-green-700"
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
              <Trees className="h-4 w-4" />
              Registrar reserva
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
