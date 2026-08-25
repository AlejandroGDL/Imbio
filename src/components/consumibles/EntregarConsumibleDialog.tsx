/**
 * Dialog para entregar un consumible a un empleado del IMBIO.
 * Registra un movimiento SALIDA y descuenta del stock.
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Send, User, Package, Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import type { Consumible } from "@/types/api";
import { UNIDADES_LABEL } from "@/types/api";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    personalId: z.number({ message: "Selecciona un empleado" }).int().positive(),
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

const FIELD_LABELS: Record<keyof FormData, string> = {
  personalId: "Empleado",
  cantidad: "Cantidad",
  fecha: "Fecha de entrega",
  observaciones: "Observaciones",
};

interface EntregarConsumibleDialogProps {
  consumible: Consumible;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEntregado?: () => void;
}

export function EntregarConsumibleDialog({
  consumible,
  open,
  onOpenChange,
  onEntregado,
}: EntregarConsumibleDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [personalOptions, setPersonalOptions] = useState<
    { value: number; label: string; sublabel?: string; disabled?: boolean }[]
  >([]);
  const [loadingPersonal, setLoadingPersonal] = useState(false);

  const stockDisponible = parseFloat(consumible.cantidadActual);

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
      cantidad: 1,
      fecha: new Date().toISOString().slice(0, 10),
      observaciones: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        personalId: 0,
        cantidad: 1,
        fecha: new Date().toISOString().slice(0, 10),
        observaciones: "",
      });
      // Cargar personal activo
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
        .catch(() => {
          toast.error("No se pudo cargar el personal");
        })
        .finally(() => setLoadingPersonal(false));
    }
  }, [open, reset]);

  const personalId = watch("personalId");
  const cantidad = watch("cantidad");
  const cantidadExcede = cantidad > stockDisponible;

  const onSubmit = async (data: FormData) => {
    if (cantidadExcede) {
      toast.error("Cantidad excede el stock", {
        description: `Disponible: ${stockDisponible} ${UNIDADES_LABEL[consumible.unidad]}`,
      });
      return;
    }
    setSubmitting(true);
    try {
      await api.entregarConsumible(consumible.id, {
        personalId: data.personalId,
        cantidad: Number(data.cantidad),
        fecha: data.fecha || undefined,
        observaciones: data.observaciones || undefined,
      });
      toast.success("Entrega registrada", {
        description: `${data.cantidad} ${UNIDADES_LABEL[consumible.unidad]} de ${consumible.concepto}`,
      });
      onEntregado?.();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo registrar la entrega";
      toast.error("Error al registrar la entrega", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Alert global */}
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

      {/* Info del consumible */}
      <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-rose-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose-900">
              {consumible.concepto}
            </p>
            <p className="text-xs text-rose-700">
              Stock disponible:{" "}
              <span className="font-bold">
                {stockDisponible} {UNIDADES_LABEL[consumible.unidad]}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Empleado */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-rose-700" />
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

      {/* Cantidad + Fecha */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
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
              cantidadExcede && "border-amber-500 focus-visible:ring-amber-500",
            )}
            {...register("cantidad", { valueAsNumber: true })}
          />
          {errors.cantidad && (
            <p className="text-xs text-red-600">{errors.cantidad.message}</p>
          )}
          {cantidadExcede && !errors.cantidad && (
            <p className="text-xs text-amber-700">
              Excede el stock disponible
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fecha" className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-rose-700" />
            Fecha de entrega
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
          placeholder="Para qué se usa, proyecto, etc. (opcional)"
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
          disabled={submitting || cantidadExcede}
          className="min-w-[140px] bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Entregando...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Entregar
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
