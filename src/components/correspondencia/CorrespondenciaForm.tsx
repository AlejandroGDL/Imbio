import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Mail,
  Clock,
  Bell,
  BellRing,
  Calendar,
  CalendarDays,
  AlertCircle,
  Plus,
  X,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import { useServerStatus } from "@/hooks/use-server-status";
import { AsistentesField } from "./AsistentesField";
import type {
  Correspondencia,
  StatusCorrespondencia,
} from "@/types/api";

// =================================================================
// Validación con Zod
// =================================================================
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    tipo: z.enum(["ENTRADA", "SALIDA"], {
      message: "Tipo inválido (Entrada/Salida)",
    }),
    tipoDocumento: z.enum(["MEMORANDUM", "OFICIO"], {
      message: "Tipo de documento inválido",
    }),
    numero: z
      .string()
      .trim()
      .min(1, "Número requerido")
      .max(80, "Máximo 80 caracteres"),
    fecha: z.string().regex(dateRegex, "Fecha inválida (YYYY-MM-DD)"),
    remitente: z
      .string()
      .trim()
      .min(1, "Remitente requerido")
      .max(200, "Máximo 200 caracteres"),
    destinatario: z
      .string()
      .trim()
      .min(1, "Destinatario requerido")
      .max(200, "Máximo 200 caracteres"),
    asunto: z
      .string()
      .trim()
      .min(1, "Asunto requerido")
      .max(300, "Máximo 300 caracteres"),
    observaciones: z
      .string()
      .trim()
      .max(1000, "Máximo 1000 caracteres")
      .optional()
      .or(z.literal("")),
    // Status solo se incluye en modo edición
    status: z.enum(["PENDIENTE", "ATENDIDO", "ARCHIVADO"]).optional(),
    // ===== Notificación =====
    ocupaRespuesta: z.boolean(),
    fechaMaximaRespuesta: z.string().optional().or(z.literal("")),
    asisteAEvento: z.boolean(),
    fechasEvento: z.array(z.string()),
    asistentesIds: z.array(z.number()),
  })
  .superRefine((data, ctx) => {
    if (
      data.ocupaRespuesta &&
      (!data.fechaMaximaRespuesta || data.fechaMaximaRespuesta === "")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fechaMaximaRespuesta"],
        message: "Requerida cuando 'Ocupa respuesta' está marcado",
      });
    }
    if (data.asisteAEvento && data.fechasEvento.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fechasEvento"],
        message: "Agrega al menos un día de evento",
      });
    }
  });

export type FormData = z.infer<typeof schema>;

// Etiquetas legibles para el alert global de campos faltantes
const FIELD_LABELS: Record<keyof FormData, string> = {
  tipo: "Tipo",
  tipoDocumento: "Tipo de documento",
  numero: "Número",
  fecha: "Fecha",
  remitente: "Remitente",
  destinatario: "Destinatario",
  asunto: "Asunto",
  observaciones: "Observaciones",
  status: "Status",
  ocupaRespuesta: "Ocupa respuesta",
  fechaMaximaRespuesta: "Fecha máxima de respuesta",
  asisteAEvento: "Asiste a evento",
  fechasEvento: "Días del evento",
  asistentesIds: "Asistentes al evento",
};

interface CorrespondenciaFormProps {
  initialData?: Correspondencia;
  onSaved?: (item: Correspondencia) => void;
  embedded?: boolean;
  onCancel?: () => void;
}

/** Convierte "2026-08-17T00:00:00.000Z" → "2026-08-17" */
function isoToYmd(iso: string): string {
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

function toFormData(c: Correspondencia): FormData {
  const fecha = isoToYmd(c.fecha);
  return {
    tipo: c.tipo,
    tipoDocumento: c.tipoDocumento,
    numero: c.numero,
    fecha,
    remitente: c.remitente,
    destinatario: c.destinatario,
    asunto: c.asunto,
    observaciones: c.observaciones ?? "",
    status: c.status,
    ocupaRespuesta: c.ocupaRespuesta,
    fechaMaximaRespuesta: isoToYmd(c.fechaMaximaRespuesta ?? ""),
    asisteAEvento: c.asisteAEvento,
    fechasEvento: (c.fechasEvento ?? []).map(isoToYmd).sort(),
    asistentesIds: c.asistentesIds ?? [],
  };
}

function defaultFormData(): FormData {
  return {
    tipo: "ENTRADA",
    tipoDocumento: "OFICIO",
    numero: "",
    fecha: "",
    remitente: "",
    destinatario: "Biól. Luis Felipe Lozano",
    asunto: "",
    observaciones: "",
    ocupaRespuesta: false,
    fechaMaximaRespuesta: "",
    asisteAEvento: false,
    fechasEvento: [],
    asistentesIds: [],
  };
}

export function CorrespondenciaForm({
  initialData,
  onSaved,
  embedded = false,
  onCancel,
}: CorrespondenciaFormProps) {
  const { status } = useServerStatus();
  const [submitting, setSubmitting] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState("");
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

  const tipoActual = watch("tipo");
  const ocupaRespuesta = watch("ocupaRespuesta");
  const asisteAEvento = watch("asisteAEvento");
  const fechasEvento = watch("fechasEvento") ?? [];
  const asistentesIds = watch("asistentesIds") ?? [];

  const agregarFecha = () => {
    if (!nuevaFecha || !dateRegex.test(nuevaFecha)) return;
    if (fechasEvento.includes(nuevaFecha)) {
      toast.error("Día duplicado", {
        description: "Ese día ya está en la lista.",
      });
      return;
    }
    const nuevas = [...fechasEvento, nuevaFecha].sort();
    setValue("fechasEvento", nuevas, { shouldDirty: true, shouldValidate: true });
    setNuevaFecha("");
  };

  const eliminarFecha = (fecha: string) => {
    const nuevas = fechasEvento.filter((f) => f !== fecha);
    setValue("fechasEvento", nuevas, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const payload: Parameters<typeof api.crearCorrespondencia>[0] = {
        tipo: data.tipo,
        tipoDocumento: data.tipoDocumento,
        numero: data.numero,
        fecha: data.fecha,
        remitente: data.remitente,
        destinatario: data.destinatario,
        asunto: data.asunto,
        observaciones: data.observaciones || undefined,
        ocupaRespuesta: data.ocupaRespuesta,
        fechaMaximaRespuesta: data.ocupaRespuesta
          ? data.fechaMaximaRespuesta || undefined
          : undefined,
        asisteAEvento: data.asisteAEvento,
        fechasEvento: data.asisteAEvento ? data.fechasEvento : [],
        asistentesIds: data.asisteAEvento ? data.asistentesIds : [],
      };

      let result: Correspondencia;
      if (isEdit) {
        result = await api.actualizarCorrespondencia(initialData!.id, payload);
        if (data.status && data.status !== initialData!.status) {
          result = await api.cambiarStatusCorrespondencia(
            initialData!.id,
            data.status as StatusCorrespondencia,
          );
        }
      } else {
        result = await api.crearCorrespondencia(payload);
      }

      toast.success(
        isEdit ? "Correspondencia actualizada" : "Correspondencia registrada",
        {
          description: `${result.tipoDocumento} #${result.numero} — ${result.asunto.slice(0, 40)}${result.asunto.length > 40 ? "…" : ""}`,
        },
      );

      if (!isEdit) {
        reset(defaultFormData());
        setNuevaFecha("");
      }
      onSaved?.(result);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : isEdit
            ? "No se pudo actualizar la correspondencia"
            : "No se pudo registrar la correspondencia";
      toast.error(isEdit ? "Error al actualizar" : "Error al registrar", {
        description: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const serverDown = status !== "online";
  const errorCount = Object.keys(errors).length;

  // Errores específicos del tab Notificación (para el indicador en el tab)
  const hasNotifErrors = !!(
    errors.ocupaRespuesta ||
    errors.fechaMaximaRespuesta ||
    errors.asisteAEvento ||
    errors.fechasEvento
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* ===== Alert global de campos faltantes ===== */}
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

      <Tabs defaultValue="documento" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documento">
            <Mail className="h-3.5 w-3.5" />
            Documento
          </TabsTrigger>
          <TabsTrigger value="notificacion" className="relative">
            <Bell className="h-3.5 w-3.5" />
            Notificación
            {hasNotifErrors && (
              <span
                className="ml-1 inline-block h-2 w-2 rounded-full bg-red-500"
                title="Hay errores en este tab"
              />
            )}
          </TabsTrigger>
        </TabsList>

        {/* ===== Tab: Documento ===== */}
        <TabsContent value="documento" className="space-y-4">
          {/* Tipo (Entrada/Salida) + Tipo de documento */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tipo">
                Tipo<span className="ml-1 text-red-500">*</span>
              </Label>
              <select
                id="tipo"
                className={cn(
                  "flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  errors.tipo && "border-red-500 focus-visible:ring-red-500",
                )}
                {...register("tipo")}
              >
                <option value="ENTRADA">📥 Entrada</option>
                <option value="SALIDA">📤 Salida</option>
              </select>
              {errors.tipo && (
                <p className="text-xs text-red-600">{errors.tipo.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tipoDocumento">
                Tipo de documento<span className="ml-1 text-red-500">*</span>
              </Label>
              <select
                id="tipoDocumento"
                className={cn(
                  "flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  errors.tipoDocumento && "border-red-500 focus-visible:ring-red-500",
                )}
                {...register("tipoDocumento")}
              >
                <option value="OFICIO">Oficio</option>
                <option value="MEMORANDUM">Memorándum</option>
              </select>
              {errors.tipoDocumento && (
                <p className="text-xs text-red-600">
                  {errors.tipoDocumento.message}
                </p>
              )}
            </div>
          </div>

          {/* Número + Fecha */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="numero">
                Número<span className="ml-1 text-red-500">*</span>
              </Label>
              <Input
                id="numero"
                placeholder="Ej. IMB-1-2026-00042"
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
              <Label htmlFor="fecha">
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
          </div>

          {/* Remitente + Destinatario */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="remitente">
                Remitente
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {tipoActual === "ENTRADA" ? "(quien envía)" : "(IMBIO)"}
                </span>
                <span className="ml-1 text-red-500">*</span>
              </Label>
              <Input
                id="remitente"
                placeholder={
                  tipoActual === "ENTRADA"
                    ? "Ej. Lic. Juan Pérez — Dirección de Ecología"
                    : "Ej. IMBIO — Director"
                }
                className={cn(
                  errors.remitente && "border-red-500 focus-visible:ring-red-500",
                )}
                {...register("remitente")}
              />
              {errors.remitente && (
                <p className="text-xs text-red-600">{errors.remitente.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="destinatario">
                Destinatario
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {tipoActual === "ENTRADA" ? "(IMBIO)" : "(quien recibe)"}
                </span>
                <span className="ml-1 text-red-500">*</span>
              </Label>
              <Input
                id="destinatario"
                placeholder={
                  tipoActual === "ENTRADA"
                    ? "Ej. IMBIO — Director"
                    : "Ej. Lic. Juan Pérez — Dirección de Ecología"
                }
                className={cn(
                  errors.destinatario && "border-red-500 focus-visible:ring-red-500",
                )}
                {...register("destinatario")}
              />
              {errors.destinatario && (
                <p className="text-xs text-red-600">
                  {errors.destinatario.message}
                </p>
              )}
            </div>
          </div>

          {/* Asunto */}
          <div className="space-y-1.5">
            <Label htmlFor="asunto">
              Asunto<span className="ml-1 text-red-500">*</span>
            </Label>
            <Input
              id="asunto"
              placeholder="Resumen breve del documento"
              className={cn(
                errors.asunto && "border-red-500 focus-visible:ring-red-500",
              )}
              {...register("asunto")}
            />
            {errors.asunto && (
              <p className="text-xs text-red-600">{errors.asunto.message}</p>
            )}
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
              <p className="text-xs text-red-600">
                {errors.observaciones.message}
              </p>
            )}
          </div>

          {/* Status (solo en edición) */}
          {isEdit && (
            <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <Label htmlFor="status" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-700" />
                Status
              </Label>
              <select
                id="status"
                className="flex h-9 w-full appearance-none rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                {...register("status")}
              >
                <option value="PENDIENTE">⏳ Pendiente</option>
                <option value="ATENDIDO">✅ Atendido</option>
                <option value="ARCHIVADO">📁 Archivado</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Modifica el estado del documento.
              </p>
            </div>
          )}
        </TabsContent>

        {/* ===== Tab: Notificación ===== */}
        <TabsContent value="notificacion" className="space-y-4">
          <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/40 p-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-sky-600" />
              <h3 className="text-sm font-semibold text-sky-900">Notificación</h3>
            </div>

            {/* Ocupa respuesta */}
            <div className="space-y-2">
              <label
                htmlFor="ocupaRespuesta"
                className="flex cursor-pointer items-start gap-2"
              >
                <Checkbox
                  id="ocupaRespuesta"
                  checked={ocupaRespuesta}
                  onCheckedChange={(checked) =>
                    setValue("ocupaRespuesta", !!checked, { shouldDirty: true })
                  }
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">
                    📬 Ocupa respuesta
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Marca si este documento requiere una respuesta por parte del
                    IMBIO.
                  </p>
                </div>
              </label>

              {ocupaRespuesta && (
                <div className="ml-7 space-y-1.5">
                  <Label
                    htmlFor="fechaMaximaRespuesta"
                    className="flex items-center gap-1.5"
                  >
                    <Calendar className="h-3.5 w-3.5 text-amber-700" />
                    Fecha máxima de respuesta
                    <span className="ml-1 text-red-500">*</span>
                  </Label>
                  <Input
                    id="fechaMaximaRespuesta"
                    type="date"
                    className={cn(
                      "max-w-xs",
                      errors.fechaMaximaRespuesta &&
                        "border-red-500 focus-visible:ring-red-500",
                    )}
                    {...register("fechaMaximaRespuesta")}
                  />
                  {errors.fechaMaximaRespuesta && (
                    <p className="text-xs text-red-600">
                      {errors.fechaMaximaRespuesta.message}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Asiste a evento */}
            <div className="space-y-2 border-t border-sky-200 pt-3">
              <label
                htmlFor="asisteAEvento"
                className="flex cursor-pointer items-start gap-2"
              >
                <Checkbox
                  id="asisteAEvento"
                  checked={asisteAEvento}
                  onCheckedChange={(checked) => {
                    setValue("asisteAEvento", !!checked, { shouldDirty: true });
                    if (!checked) {
                      setValue("fechasEvento", [], { shouldDirty: true });
                      setValue("asistentesIds", [], { shouldDirty: true });
                    }
                  }}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">
                    📅 Asiste a evento
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Marca si requiere asistir a una reunión, junta o acto. Puedes
                    capturar varios días no consecutivos.
                  </p>
                </div>
              </label>

              {asisteAEvento && (
                <div className="ml-7 space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-amber-700" />
                    Días del evento
                    <span className="ml-1 text-red-500">*</span>
                  </Label>

                  <div className="flex items-end gap-2">
                    <div className="flex-1 max-w-xs space-y-1">
                      <Input
                        type="date"
                        value={nuevaFecha}
                        onChange={(e) => setNuevaFecha(e.target.value)}
                        placeholder="YYYY-MM-DD"
                        className={cn(
                          errors.fechasEvento &&
                            "border-red-500 focus-visible:ring-red-500",
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={agregarFecha}
                      disabled={!nuevaFecha}
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar día
                    </Button>
                  </div>

                  {fechasEvento.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {fechasEvento.map((f) => (
                        <span
                          key={f}
                          className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-100 px-3 py-1 text-xs font-medium text-sky-900"
                        >
                          <CalendarDays className="h-3 w-3" />
                          {isoToYmd(f).split("-").reverse().join("/")}
                          <button
                            type="button"
                            onClick={() => eliminarFecha(f)}
                            className="ml-0.5 rounded-full p-0.5 hover:bg-sky-200"
                            title="Quitar este día"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {errors.fechasEvento && (
                    <p className="text-xs text-red-600">
                      {errors.fechasEvento.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {fechasEvento.length === 0
                      ? "Agrega al menos un día."
                      : `${fechasEvento.length} día${fechasEvento.length === 1 ? "" : "s"} capturado${fechasEvento.length === 1 ? "" : "s"}.`}
                  </p>
                </div>
              )}

              {/* Asistentes al evento */}
              <div className="ml-7 space-y-1.5 border-t border-sky-200 pt-3">
                <Label className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-amber-700" />
                  Personal que debe asistir
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (opcional, varios)
                  </span>
                </Label>
                <AsistentesField
                  value={asistentesIds}
                  onChange={(ids) =>
                    setValue("asistentesIds", ids, { shouldDirty: true })
                  }
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

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
          className="min-w-[140px] bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
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
              <Mail className="h-4 w-4" />
              Registrar
            </>
          )}
        </Button>
      </div>

      {serverDown && !embedded && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <BellRing className="mr-1 inline h-4 w-4" />
          <strong>Servidor desconectado.</strong> El formulario no podrá guardar
          hasta que conectes el servidor en{" "}
          <span className="font-semibold">Configuración</span>.
        </div>
      )}
    </form>
  );
}
