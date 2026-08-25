import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  ClipboardList,
  Calendar,
  AlertCircle,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import { useServerStatus } from "@/hooks/use-server-status";
import type { Requisicion, Unidad } from "@/types/api";
import { UNIDADES, UNIDADES_LABEL } from "@/types/api";

// =================================================================
// Validación con Zod
// =================================================================
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    numero: z
      .string()
      .trim()
      .min(1, "N° de Requisición requerido")
      .max(40, "Máximo 40 caracteres"),
    concepto: z
      .string()
      .trim()
      .min(1, "Concepto requerido")
      .max(200, "Máximo 200 caracteres"),
    cantidad: z
      .number()
      .refine((n) => Number.isFinite(n) && n > 0, "Cantidad debe ser mayor a 0"),
    unidad: z.enum(UNIDADES, { message: "Unidad inválida" }),
    partida: z
      .string()
      .trim()
      .min(1, "Partida requerida")
      .max(100, "Máximo 100 caracteres"),
    fechaSolicitud: z.string().regex(dateRegex, "Fecha inválida (YYYY-MM-DD)"),
    observaciones: z
      .string()
      .trim()
      .max(1000, "Máximo 1000 caracteres")
      .optional()
      .or(z.literal("")),
    surtido: z.boolean(),
    fechaEntrega: z.string().optional().or(z.literal("")),
    esConsumible: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.surtido && (!data.fechaEntrega || data.fechaEntrega === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fechaEntrega"],
        message: "Requerida cuando 'Surtido' está marcado",
      });
    }
  });

export type FormData = z.infer<typeof schema>;

const FIELD_LABELS: Record<keyof FormData, string> = {
  numero: "N° de Requisición",
  concepto: "Concepto",
  cantidad: "Cantidad",
  unidad: "Unidad",
  partida: "Partida",
  fechaSolicitud: "Fecha de solicitud",
  observaciones: "Observaciones",
  surtido: "Surtido",
  fechaEntrega: "Fecha de entrega",
  esConsumible: "¿Es Consumible?",
};

interface RequisicionFormProps {
  initialData?: Requisicion;
  onSaved?: (item: Requisicion) => void;
  embedded?: boolean;
  onCancel?: () => void;
}

function toFormData(r: Requisicion): FormData {
  return {
    numero: r.numero,
    concepto: r.concepto,
    cantidad: parseFloat(r.cantidad),
    unidad: r.unidad,
    partida: r.partida,
    fechaSolicitud: r.fechaSolicitud.slice(0, 10),
    observaciones: r.observaciones ?? "",
    surtido: r.surtido,
    fechaEntrega:
      r.fechaEntrega && r.fechaEntrega.length >= 10
        ? r.fechaEntrega.slice(0, 10)
        : "",
    esConsumible: r.esConsumible,
  };
}

function defaultFormData(): FormData {
  const today = new Date().toISOString().slice(0, 10);
  return {
    numero: "",
    concepto: "",
    cantidad: 1,
    unidad: "PIEZA",
    partida: "",
    fechaSolicitud: today,
    observaciones: "",
    surtido: false,
    fechaEntrega: "",
    esConsumible: false,
  };
}

export function RequisicionForm({
  initialData,
  onSaved,
  embedded = false,
  onCancel,
}: RequisicionFormProps) {
  const { status } = useServerStatus();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!initialData;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitted },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData ? toFormData(initialData) : defaultFormData(),
  });

  useEffect(() => {
    if (initialData) reset(toFormData(initialData));
  }, [initialData, reset]);

  const surtido = watch("surtido");
  const esConsumible = watch("esConsumible");
  const cantidad = watch("cantidad");
  const unidad = watch("unidad");

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const payload: Parameters<typeof api.crearRequisicion>[0] = {
        numero: data.numero,
        concepto: data.concepto,
        cantidad: typeof data.cantidad === "string" ? parseFloat(data.cantidad) : data.cantidad,
        unidad: data.unidad as Unidad,
        partida: data.partida,
        fechaSolicitud: data.fechaSolicitud,
        observaciones: data.observaciones || undefined,
        surtido: data.surtido,
        fechaEntrega: data.surtido ? data.fechaEntrega || undefined : undefined,
        // Al editar NO se puede cambiar si es consumible (afecta stock ya creado)
        ...(isEdit ? {} : { esConsumible: data.esConsumible }),
      };

      let result: Requisicion;
      if (isEdit) {
        result = await api.actualizarRequisicion(initialData!.id, payload);
        toast.success("Requisición actualizada", {
          description: `#${result.numero} — ${result.concepto}`,
        });
      } else {
        result = await api.crearRequisicion(payload);
        const autoMsg =
          result.esConsumible && result.surtido
            ? " (entrada automática a Consumibles)"
            : "";
        toast.success("Requisición registrada" + autoMsg, {
          description: `#${result.numero} — ${result.concepto}`,
        });
      }

      if (!isEdit) reset(defaultFormData());
      onSaved?.(result);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : isEdit
            ? "No se pudo actualizar la requisición"
            : "No se pudo registrar la requisición";
      toast.error(isEdit ? "Error al actualizar" : "Error al registrar", {
        description: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const serverDown = status !== "online";
  const errorCount = Object.keys(errors).length;
  const showConsumibleHint = surtido && esConsumible;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Alert global */}
      {isSubmitted && errorCount > 0 && (
        <Alert variant="destructive" className="text-left">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>
            {errorCount === 1
              ? "Falta 1 campo por completar o corregir"
              : `Faltan ${errorCount} campos por completar o corregir`}
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

      {/* N° Requisición + Fecha Solicitud */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="numero">
            N° de Requisición<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="numero"
            placeholder="Ej. REQ-001"
            className={cn(
              "font-mono",
              errors.numero && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("numero")}
          />
          {errors.numero && (
            <p className="text-xs text-red-600">{errors.numero.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fechaSolicitud">
            Fecha de solicitud<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="fechaSolicitud"
            type="date"
            className={cn(
              errors.fechaSolicitud && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("fechaSolicitud")}
          />
          {errors.fechaSolicitud && (
            <p className="text-xs text-red-600">{errors.fechaSolicitud.message}</p>
          )}
        </div>
      </div>

      {/* Concepto */}
      <div className="space-y-1.5">
        <Label htmlFor="concepto">
          Concepto<span className="ml-1 text-red-500">*</span>
        </Label>
        <Input
          id="concepto"
          placeholder="Ej. Limpiavidrios en aerosol"
          className={cn(
            errors.concepto && "border-red-500 focus-visible:ring-red-500",
          )}
          {...register("concepto")}
        />
        {errors.concepto && (
          <p className="text-xs text-red-600">{errors.concepto.message}</p>
        )}
      </div>

      {/* Cantidad + Unidad + Partida */}
      <div className="grid gap-4 sm:grid-cols-6">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cantidad">
            Cantidad<span className="ml-1 text-red-500">*</span>
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

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="unidad">
            Unidad<span className="ml-1 text-red-500">*</span>
          </Label>
          <select
            id="unidad"
            className={cn(
              "flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              errors.unidad && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("unidad")}
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {UNIDADES_LABEL[u]}
              </option>
            ))}
          </select>
          {errors.unidad && (
            <p className="text-xs text-red-600">{errors.unidad.message}</p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="partida">
            Partida<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="partida"
            placeholder="Ej. Materiales de limpieza"
            className={cn(
              errors.partida && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("partida")}
          />
          {errors.partida && (
            <p className="text-xs text-red-600">{errors.partida.message}</p>
          )}
        </div>
      </div>

      {/* Observaciones */}
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

      {/* Surtido */}
      <div className="space-y-3 rounded-lg border border-cyan-200 bg-cyan-50/40 p-4">
        <label
          htmlFor="surtido"
          className="flex cursor-pointer items-start gap-2"
        >
          <Checkbox
            id="surtido"
            checked={surtido}
            onCheckedChange={(checked) => {
              setValue("surtido", !!checked, { shouldDirty: true });
              if (!checked) setValue("fechaEntrega", "", { shouldDirty: true });
            }}
            className="mt-0.5"
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-foreground">
              ✅ Surtido
            </span>
            <p className="text-xs text-muted-foreground">
              Marca si la requisición ya fue surtida por compras.
            </p>
          </div>
        </label>

        {surtido && (
          <div className="ml-7 space-y-1.5">
            <Label
              htmlFor="fechaEntrega"
              className="flex items-center gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5 text-cyan-700" />
              Fecha de entrega
              <span className="ml-1 text-red-500">*</span>
            </Label>
            <Input
              id="fechaEntrega"
              type="date"
              className={cn(
                "max-w-xs",
                errors.fechaEntrega && "border-red-500 focus-visible:ring-red-500",
              )}
              {...register("fechaEntrega")}
            />
            {errors.fechaEntrega && (
              <p className="text-xs text-red-600">
                {errors.fechaEntrega.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ¿Es Consumible? — solo visible al crear */}
      {!isEdit && (
      <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50/40 p-4">
        <label
          htmlFor="esConsumible"
          className="flex cursor-pointer items-start gap-2"
        >
          <Checkbox
            id="esConsumible"
            checked={esConsumible}
            onCheckedChange={(checked) =>
              setValue("esConsumible", !!checked, { shouldDirty: true })
            }
            className="mt-0.5"
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-foreground">
              📦 ¿Es Consumible?
            </span>
            <p className="text-xs text-muted-foreground">
              Si está marcado y la requisición está surtida, se registrará
              automáticamente en el catálogo de Consumibles.
            </p>
          </div>
        </label>

        {showConsumibleHint && (
          <Alert
            variant="info"
            className="border-rose-200 bg-rose-50/60 text-rose-900"
          >
            <Info className="h-4 w-4" />
            <AlertTitle className="text-sm">Se creará un Consumible</AlertTitle>
            <AlertDescription className="text-xs">
              Al guardar, se buscará un consumible existente con concepto{" "}
              <span className="font-mono font-semibold">
                &laquo;{watch("concepto") || "(vacío)"}&raquo;
              </span>{" "}
              y unidad{" "}
              <span className="font-mono font-semibold">
                {UNIDADES_LABEL[unidad as Unidad] || unidad}
              </span>
              . Si existe, se sumarán{" "}
              <span className="font-semibold">
                {cantidad} {UNIDADES_LABEL[unidad as Unidad] || unidad}
              </span>{" "}
              al stock. Si no, se creará con ese stock inicial.
            </AlertDescription>
          </Alert>
        )}
      </div>
      )}

      {/* Aviso al editar: si la requisición es consumible, mostrar info fija */}
      {isEdit && initialData?.esConsumible && (
        <Alert
          variant="info"
          className="border-rose-200 bg-rose-50/60 text-rose-900"
        >
          <AlertTitle className="text-sm">
            📦 Esta requisición es un Consumible
          </AlertTitle>
          <AlertDescription className="text-xs">
            Marcado como consumible al crear (no se puede modificar desde
            aquí). El stock se gestiona desde el módulo de{" "}
            <span className="font-semibold">Consumibles</span>.
            {initialData.consumibleMovimientoId && (
              <>
                {" "}Movimiento de entrada #<span className="font-mono">
                  {initialData.consumibleMovimientoId}
                </span>.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Botones */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={submitting || serverDown || (isEdit && !isDirty)}
          className="min-w-[140px] bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700"
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
              <ClipboardList className="h-4 w-4" />
              Registrar
            </>
          )}
        </Button>
      </div>

      {serverDown && !embedded && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <strong>Servidor desconectado.</strong> El formulario no podrá guardar
          hasta que conectes el servidor en{" "}
          <span className="font-semibold">Configuración</span>.
        </div>
      )}
    </form>
  );
}
