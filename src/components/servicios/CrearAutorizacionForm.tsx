import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, FileCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";
import { DatalistInput } from "@/components/ui/datalist-input";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import type { CampoTramite, Tramite, Autorizacion } from "@/types/api";
import { buscarCientifico } from "@/data/arboles-pabellon";

// =================================================================
// Tipos
// =================================================================
type FormData = {
  datos: Record<string, unknown>;
};

// =================================================================
// Helpers de fecha/hora
// =================================================================
/** Devuelve la fecha de hoy en formato YYYY-MM-DD (zona local). */
function hoyYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Suma N días a una fecha YYYY-MM-DD y devuelve otra YYYY-MM-DD. */
function sumarDias(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00");
  if (isNaN(d.getTime())) return ymd;
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Suma N meses a una fecha `Date` y devuelve una nueva `Date`. */
function sumarMeses(base: Date, n: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + n);
  return d;
}

/** Formatea una Date como "DD/MM/YYYY" en zona local. */
function fmtDmy(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${m}/${d.getFullYear()}`;
}

// =================================================================
// Componente principal
// =================================================================
/**
 * Form para crear O editar una autorización.
 *
 * Modo "create" (sin `initialAutorizacion`):
 *   - Crea una nueva autorización, persiste los datos y abre el PDF
 *
 * Modo "edit" (con `initialAutorizacion`):
 *   - Edita los datos de la solicitud + campos propios de la autorización
 *   - Regenera el PDF automáticamente al guardar
 */
export function CrearAutorizacionForm({
  solicitudId,
  initialAutorizacion,
  onSaved,
  onCancel,
}: {
  solicitudId: number;
  /** Si viene, el form entra en modo edición. */
  initialAutorizacion?: Autorizacion;
  onSaved: (opts?: { openPdf?: boolean }) => void;
  onCancel: () => void;
}) {
  const isEdit = !!initialAutorizacion;
  const [submitting, setSubmitting] = useState(false);
  const [tramite, setTramite] = useState<Tramite | null>(null);
  const [loading, setLoading] = useState(true);
  // Sugerencias de marca/modelo para autocompletar (sólo Traslado de Leña)
  const [marcasModelos, setMarcasModelos] = useState<{
    marcas: string[];
    modelos: string[];
  }>({ marcas: [], modelos: [] });

  const { control, handleSubmit, register, formState: { errors }, setValue, reset } =
    useForm<FormData>({
      mode: "onBlur",
      defaultValues: {
        datos: {},
      },
    });

  // Carga la solicitud completa, el trámite y (en edit) la autorización
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const solicitud: Awaited<ReturnType<typeof api.obtenerSolicitud>> =
          await api.obtenerSolicitud(solicitudId);
        const tramiteCompleto = await api.obtenerTramite(solicitud.tramiteId);
        setTramite(tramiteCompleto);

        // Si es Traslado de Leña, también cargamos las marcas/modelos
        // ya registradas para el autocompletado del form.
        if (tramiteCompleto.codigo === "PERMISO_TRASLADO_LENA") {
          try {
            const mm = await api.listarMarcasModelos();
            setMarcasModelos(mm);
          } catch {
            // Si falla, seguimos con listas vacías (no rompe el form)
            setMarcasModelos({ marcas: [], modelos: [] });
          }
        }

        // Construimos el objeto de datos inicial combinando:
        // 1) los datos que ya trae la solicitud (de cuando se creó)
        // 2) los defaults del trámite para campos vacíos (vigencia,
        //    plazoEjecucion, etc.) — sólo en modo CREATE
        // 3) campos auto-rellenados (nombreSolicitante, responsable,
        //    nombreResponsable, nombreCientifico fallback) — sólo CREATE
        const datosIniciales: Record<string, unknown> = {
          ...((solicitud.datos as Record<string, unknown> | null) ?? {}),
        };

        if (!isEdit) {
          // Defensa: si tenemos `nombreComun` pero NO `nombreCientifico`
          // (caso de solicitudes creadas antes de que el wizard guardara
          // ambos campos), intentamos resolver el científico desde la
          // lista de árboles.
          if (
            datosIniciales.nombreComun &&
            (datosIniciales.nombreCientifico === undefined ||
              datosIniciales.nombreCientifico === null ||
              datosIniciales.nombreCientifico === "")
          ) {
            const ci = buscarCientifico(String(datosIniciales.nombreComun));
            if (ci) datosIniciales.nombreCientifico = ci;
          }

          // Aplica los defaults del trámite sólo si el campo está vacío
          // (ej. vigencia = "24 horas" para Traslado de Leña).
          tramiteCompleto.campos.forEach((campo) => {
            if (campo.default === undefined) return;
            const current = datosIniciales[campo.key];
            const hasValue =
              current !== undefined && current !== null && current !== "";
            if (!hasValue) {
              datosIniciales[campo.key] = campo.default;
            }
          });

          // PERMISO_QUEMA: defaults automáticos
          if (tramiteCompleto.codigo === "PERMISO_QUEMA") {
            if (!datosIniciales.fechaInicio) {
              datosIniciales.fechaInicio = hoyYmd();
            }
            if (datosIniciales.fechaInicio && !datosIniciales.fechaFin) {
              datosIniciales.fechaFin = sumarDias(
                String(datosIniciales.fechaInicio),
                2,
              );
            }
            if (!datosIniciales.horaInicio) {
              datosIniciales.horaInicio = "09:00";
            }
            if (!datosIniciales.horaFin) {
              datosIniciales.horaFin = "16:00";
            }
          }

          // Auto-rellenar campos con el nombre del ciudadano según el
          // trámite (sólo si están vacíos).
          const ciud = solicitud.ciudadano;
          const fullName = ciud
            ? [ciud.nombre, ciud.apellidoPaterno, ciud.apellidoMaterno]
                .filter(Boolean)
                .join(" ")
            : "";
          if (fullName) {
            if (
              tramiteCompleto.codigo === "PERMISO_PODA" ||
              tramiteCompleto.codigo === "PERMISO_DERRIBO" ||
              tramiteCompleto.codigo === "SERVICIO_PODA" ||
              tramiteCompleto.codigo === "SERVICIO_DERRIBO"
            ) {
              if (!datosIniciales.nombreSolicitante) {
                datosIniciales.nombreSolicitante = fullName;
              }
            } else if (tramiteCompleto.codigo === "PERMISO_QUEMA") {
              if (!datosIniciales.responsable) {
                datosIniciales.responsable = fullName;
              }
            } else if (tramiteCompleto.codigo === "PERMISO_TRASLADO_LENA") {
              if (!datosIniciales.nombreResponsable) {
                datosIniciales.nombreResponsable = fullName;
              }
            } else if (tramiteCompleto.codigo === "USO_CONTENEDORES") {
              // El "Nombre o Razón Social" se autorrellena con el
              // ciudadano que hizo la solicitud. El operador puede
              // cambiarlo si es una persona moral diferente.
              if (!datosIniciales.nombreRazonSocial) {
                datosIniciales.nombreRazonSocial = fullName;
              }
            }
          }
        }

        // Reset re-inicializa el form con los defaultValues calculados
        // Y fuerza a los inputs a mostrar esos valores en pantalla.
        // (setValue por sí solo no siempre re-renderiza el <input>.)
        reset({
          datos: datosIniciales,
        });
      } catch (err) {
        toast.error("Error al cargar", {
          description: err instanceof ApiError ? err.message : "No se pudo cargar la solicitud",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [solicitudId, reset, isEdit, initialAutorizacion]);

  const onSubmit = async (data: FormData) => {
    if (!tramite) return;

    // Defensa extra: si por algún motivo la validación del form pasó
    // pero hay campos obligatorios vacíos, los listamos aquí y
    // bloqueamos el submit.
    const faltantes = tramite.campos
      .filter(
        (c) =>
          c.required &&
          (data.datos[c.key] === undefined ||
            data.datos[c.key] === null ||
            data.datos[c.key] === ""),
      )
      .map((c) => c.label);
    if (faltantes.length > 0) {
      toast.error("Faltan campos obligatorios", {
        description:
          faltantes.length <= 3
            ? `Completá: ${faltantes.join(", ")}`
            : `Hay ${faltantes.length} campos obligatorios sin completar`,
      });
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && initialAutorizacion) {
        // ============================================================
        // MODO EDICIÓN: actualiza los datos del trámite y regenera PDF
        // (los campos fechaVencimiento/considerandos/observaciones
        // de la autorización NO se exponen en el form; el backend
        // los preserva tal cual si no se mandan en el PATCH)
        // ============================================================
        const result = await api.actualizarAutorizacion(
          initialAutorizacion.id,
          {
            datos: data.datos,
          },
        );

        const descripcion = result.pdfRegenerado
          ? "Cambios guardados. PDF regenerado."
          : "Cambios guardados.";

        if (result.pdfRegenerado) {
          // Cache buster: el backend envía Cache-Control: no-store,
          // pero algunos navegadores aún pueden servir el PDF cacheado
          // cuando la URL no cambia. Añadimos `?_t=...` para forzar
          // la descarga del PDF regenerado.
          const pdfUrl = `${api.getPdfUrl(initialAutorizacion.id)}?_t=${Date.now()}`;
          window.open(pdfUrl, "_blank", "noopener,noreferrer");
          toast.success("Autorización editada y PDF regenerado", {
            description: descripcion,
          });
        } else {
          toast.success("Autorización editada", { description: descripcion });
        }
        onSaved({ openPdf: false });
      } else {
        // ============================================================
        // MODO CREATE
        // ============================================================
        // 1) Actualizar los datos de la solicitud con todos los campos
        await api.actualizarSolicitud(solicitudId, {
          datos: data.datos,
        });

        // 2) Crear la autorización. El backend, si el trámite genera
        //    PDF, lo crea y lo guarda en BD. Devuelve `pdfGenerado`.
        const result = await api.crearAutorizacion(solicitudId, {});

        // 3) Si se generó PDF, abrirlo en una nueva pestaña.
        if (result.pdfGenerado && result.autorizacion?.id) {
          const pdfUrl = api.getPdfUrl(result.autorizacion.id);
          window.open(pdfUrl, "_blank", "noopener,noreferrer");
          toast.success("Autorización y PDF generados", {
            description: `La solicitud pasó a AUTORIZADA. PDF abierto en nueva pestaña.`,
          });
        } else {
          toast.success("Autorización generada", {
            description: "La solicitud pasó a AUTORIZADA",
          });
        }
        onSaved({ openPdf: false });
      }
    } catch (err) {
      toast.error(
        isEdit ? "Error al editar la autorización" : "Error al generar autorización",
        {
          description: err instanceof ApiError ? err.message : "No se pudo guardar",
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !tramite) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando datos del trámite...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* ============================================================ */}
      {/* Banner informativo: fecha de vencimiento auto-calculada      */}
      {/* (sólo USO_CONTENEDORES en modo CREATE — la vigencia del      */}
      {/* permiso se calcula como `fechaEmision + mesesPermiso`)        */}
      {/* ============================================================ */}
      {!isEdit && tramite.codigo === "USO_CONTENEDORES" && (() => {
        const datos = (control._formValues.datos ?? {}) as Record<string, unknown>;
        const meses = datos.mesesPermiso as number | string | null | undefined;
        const mesesNum =
          typeof meses === "string" ? Number(meses) : meses ?? null;
        if (mesesNum === null || !Number.isFinite(mesesNum) || mesesNum <= 0) {
          return (
            <div className="flex items-start gap-2 rounded-lg border-2 border-amber-300 bg-amber-50 p-3 text-amber-900">
              <span className="text-base">⏱</span>
              <div className="text-sm">
                <p className="font-semibold">Vigencia del permiso</p>
                <p className="mt-0.5 text-xs text-amber-800">
                  Completá los <strong>meses del permiso</strong> en los
                  campos de abajo. La vigencia se calcula automáticamente
                  como <span className="font-mono">fecha de hoy + meses</span>.
                </p>
              </div>
            </div>
          );
        }
        const hoy = new Date();
        const vto = sumarMeses(hoy, Math.floor(mesesNum));
        return (
          <div className="flex items-start gap-2 rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3 text-emerald-900">
            <span className="text-base">⏱</span>
            <div className="text-sm">
              <p className="font-semibold">Vigencia del permiso (auto-calculada)</p>
              <p className="mt-0.5 text-xs text-emerald-800">
                Se otorga por <strong>{Math.floor(mesesNum)} {Math.floor(mesesNum) === 1 ? "mes" : "meses"}</strong> a
                partir de hoy.{" "}
                <span className="font-mono font-semibold">
                  Vence: {fmtDmy(vto)}
                </span>
              </p>
            </div>
          </div>
        );
      })()}

      {/* Campos dinámicos del trámite */}
      <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/30 p-4">
        <div className="mb-3 flex items-center gap-2 text-emerald-900">
          <FileCheck className="h-4 w-4" />
          <span className="text-sm font-semibold">Datos del trámite</span>
          <span className="ml-auto text-xs text-emerald-700">
            {tramite.campos.length} {tramite.campos.length === 1 ? "campo" : "campos"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tramite.campos.map((campo) => {
            // errors.datos[key] es un objeto FormError {type, message, ref}.
            // Extraemos sólo el message (string) para pasarlo al hijo.
            const errorObj = errors.datos?.[campo.key] as
              | { message?: string }
              | undefined;
            const errorMsg = errorObj?.message;
            // Autocompletado: marca y modelo en Traslado de Leña
            const datalistOptions =
              tramite.codigo === "PERMISO_TRASLADO_LENA" &&
              (campo.key === "marca" || campo.key === "modelo")
                ? campo.key === "marca"
                  ? marcasModelos.marcas
                  : marcasModelos.modelos
                : undefined;
            return (
              <div
                key={campo.key}
                className={cn(
                  campo.tipo === "textarea" || campo.tipo === "boolean"
                    ? "sm:col-span-2"
                    : "",
                )}
              >
                <CampoInput
                  campo={campo}
                  control={control}
                  register={register}
                  setValue={setValue}
                  tramiteCodigo={tramite.codigo}
                  error={errorMsg}
                  datalistOptions={datalistOptions}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className={
            isEdit
              ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
              : "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
          }
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isEdit ? "Guardando..." : "Generando..."}
            </>
          ) : isEdit ? (
            <>
              <FileCheck className="h-4 w-4" />
              Guardar y regenerar PDF
            </>
          ) : (
            "Generar autorización"
          )}
        </Button>
      </div>
    </form>
  );
}

// =================================================================
// Input dinámico según el tipo de campo
// =================================================================
function CampoInput({
  campo,
  register,
  control,
  setValue,
  tramiteCodigo,
  error,
  datalistOptions,
}: {
  campo: CampoTramite;
  register: any;
  control: any;
  setValue: any;
  tramiteCodigo?: string;
  error?: string;
  /** Si viene, el input muestra sugerencias (autocompletado). */
  datalistOptions?: string[];
}) {
  const id = `campo-${campo.key}`;
  const errorClass = error
    ? "border-red-500 focus-visible:ring-red-500"
    : "";

  // Reglas de validación. Para campos obligatorios exigimos un valor
  // no vacío. Si el campo es número y tiene min, validamos también.
  const requiredMsg = "Este campo es obligatorio";
  const requiredRule = campo.required ? requiredMsg : false;
  const minRule =
    campo.tipo === "number" && campo.min !== undefined
      ? {
          value: campo.min,
          message: `El valor mínimo es ${campo.min}`,
        }
      : undefined;

  const input = (() => {
    const commonInputProps = {
      id,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${id}-error` : undefined,
      className: cn(errorClass),
    };

    switch (campo.tipo) {
      case "text":
        // Si hay datalistOptions, usamos DatalistInput (con autocomplete)
        if (datalistOptions && datalistOptions.length > 0) {
          return (
            <DatalistInput
              {...commonInputProps}
              placeholder={campo.placeholder}
              options={datalistOptions}
              {...register(`datos.${campo.key}`, {
                required: requiredRule,
                ...(minRule ? { min: minRule } : {}),
              })}
            />
          );
        }
        return (
          <Input
            {...commonInputProps}
            placeholder={campo.placeholder}
            {...register(`datos.${campo.key}`, {
              required: requiredRule,
              ...(minRule ? { min: minRule } : {}),
            })}
          />
        );
      case "number":
        return (
          <Input
            {...commonInputProps}
            type="number"
            min={campo.min}
            max={campo.max}
            step={campo.step ?? "any"}
            placeholder={campo.placeholder}
            {...register(`datos.${campo.key}`, {
              required: requiredRule,
              validate: (v: string) => {
                if (v === "" || v === null || v === undefined) {
                  return campo.required ? requiredMsg : true;
                }
                const n = Number(v);
                if (!Number.isFinite(n)) return "Número inválido";
                if (campo.min !== undefined && n < campo.min) {
                  return `El valor mínimo es ${campo.min}`;
                }
                if (campo.max !== undefined && n > campo.max) {
                  return `El valor máximo es ${campo.max}`;
                }
                return true;
              },
            })}
          />
        );
      case "date":
        return (
          <Input
            {...commonInputProps}
            type="date"
            {...register(`datos.${campo.key}`, { required: requiredRule })}
          />
        );
      case "datetime":
        return (
          <Input
            {...commonInputProps}
            type="datetime-local"
            {...register(`datos.${campo.key}`, { required: requiredRule })}
          />
        );
      case "time":
        return (
          <Controller
            control={control}
            name={`datos.${campo.key}` as any}
            rules={{ required: requiredRule }}
            render={({ field }) => (
              <TimePicker
                id={id}
                value={(field.value as string) ?? ""}
                onChange={(v) => field.onChange(v)}
              />
            )}
          />
        );
      case "select":
        return (
          <Controller
            control={control}
            name={`datos.${campo.key}` as any}
            rules={{
              required: requiredRule,
              validate: (v) => {
                if (campo.required && (v === "" || v === undefined || v === null)) {
                  return requiredMsg;
                }
                return true;
              },
            }}
            render={({ field }) => {
              // nombreComun: en PERMISO_DERRIBO el tipo de árbol es
              // inamovible (lo eligió el operador al crear la solicitud
              // y así se queda). En el resto de trámites (PERMISO_PODA,
              // SERVICIO_PODA, etc.) sí se puede cambiar.
              const esNombreComunBloqueado =
                campo.key === "nombreComun" &&
                tramiteCodigo === "PERMISO_DERRIBO" &&
                !!field.value &&
                String(field.value).trim() !== "";

              if (esNombreComunBloqueado) {
                return (
                  <div
                    id={id}
                    className={cn(
                      "flex h-9 w-full items-center rounded-md border border-input bg-slate-50 px-3 py-1 text-sm",
                      errorClass,
                    )}
                  >
                    <span className="font-medium">
                      {String(field.value)}
                    </span>
                  </div>
                );
              }

              return (
                <select
                  id={id}
                  value={(field.value as string) ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    field.onChange(v);

                    // PERMISO_PODA / PERMISO_DERRIBO: al elegir nombreComun,
                    // autorrellena el nombreCientifico desde la lista de
                    // Pabellón de Arteaga (data/arboles-pabellon.ts).
                    if (campo.key === "nombreComun" && v) {
                      const cientifico = buscarCientifico(v);
                      if (cientifico) {
                        setValue("datos.nombreCientifico" as any, cientifico, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      }
                    }
                  }}
                  className={cn(
                    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    errorClass,
                  )}
                >
                  <option value="">— Seleccionar —</option>
                  {campo.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              );
            }}
          />
        );
      case "textarea":
        return (
          <textarea
            id={id}
            rows={3}
            placeholder={campo.placeholder}
            className={cn(
              "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              errorClass,
            )}
            {...register(`datos.${campo.key}`, { required: requiredRule })}
          />
        );
      case "boolean":
        return (
          <Controller
            control={control}
            name={`datos.${campo.key}` as any}
            render={({ field }) => (
              <label className="flex h-9 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm">Sí</span>
              </label>
            )}
          />
        );
      case "currency":
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              {...commonInputProps}
              type="number"
              min="0"
              step="0.01"
              placeholder={campo.placeholder ?? "0.00"}
              className={cn("pl-7", errorClass)}
              {...register(`datos.${campo.key}`, {
                required: requiredRule,
                validate: (v: string) => {
                  if (v === "" || v === null || v === undefined) {
                    return campo.required ? requiredMsg : true;
                  }
                  const n = Number(v);
                  if (!Number.isFinite(n) || n < 0) return "Número inválido";
                  return true;
                },
              })}
            />
          </div>
        );
      default:
        return (
          <Input
            {...commonInputProps}
            {...register(`datos.${campo.key}`, { required: requiredRule })}
          />
        );
    }
  })();

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {campo.label}
        {campo.required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {input}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-red-600">
          ⚠ {error}
        </p>
      ) : null}
    </div>
  );
}
