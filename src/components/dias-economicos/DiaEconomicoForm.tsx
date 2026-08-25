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
  CalendarDays,
  Coins,
  AlertCircle,
  Plus,
  X,
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
  type DiaEconomico,
  type Personal,
} from "@/types/api";

// =================================================================
// Validación con Zod
// =================================================================
const ANIO_MIN = 2000;
const ANIO_MAX = 2100;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const schema = z.object({
  personalId: z
    .number()
    .int()
    .positive("Selecciona un empleado"),
  anio: z
    .number()
    .int()
    .min(ANIO_MIN, `El año debe ser ≥ ${ANIO_MIN}`)
    .max(ANIO_MAX, `El año debe ser ≤ ${ANIO_MAX}`),
  observaciones: z
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
  anio: "Año",
  observaciones: "Observaciones",
};

interface DiaEconomicoFormProps {
  initialData?: DiaEconomico;
  /** Lista de personal SINDICALIZADO activo para popular el select. */
  personalList: Personal[];
  onSaved?: (item: DiaEconomico) => void;
  embedded?: boolean;
  onCancel?: () => void;
}

function toFormData(d: DiaEconomico): FormData {
  return {
    personalId: d.personalId,
    anio: d.anio,
    observaciones: d.observaciones ?? "",
  };
}

function defaultFormData(): FormData {
  const currentYear = new Date().getFullYear();
  return {
    personalId: 0,
    anio: currentYear,
    observaciones: "",
  };
}

/** Convierte "2026-08-19T00:00:00.000Z" → "2026-08-19" */
function isoToYmd(iso: string): string {
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

const NOMBRES_DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
/** Días permitidos: martes (2), miércoles (3), jueves (4). */
const DIAS_PERMITIDOS = new Set([2, 3, 4]);
function diaSemana(ymd: string): number {
  // Usamos T12:00 para evitar el off-by-one por zona horaria
  const d = new Date(`${ymd}T12:00:00`);
  return d.getDay();
}
function nombreDia(ymd: string): string {
  return NOMBRES_DIAS[diaSemana(ymd)];
}

export function DiaEconomicoForm({
  initialData,
  personalList,
  onSaved,
  embedded = false,
  onCancel,
}: DiaEconomicoFormProps) {
  const { status } = useServerStatus();
  const [submitting, setSubmitting] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState("");
  // Las fechas viven en useState (no en react-hook-form) porque es un
  // array dinámico. Se envía al backend como `fechas` y se calcula
  // `diasSolicitados` automáticamente del array.
  const [fechas, setFechas] = useState<string[]>([]);
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

  useEffect(() => {
    if (initialData) {
      reset(toFormData(initialData));
      setFechas((initialData.fechas ?? []).map(isoToYmd).sort());
    } else {
      setFechas([]);
    }
  }, [initialData, reset]);

  // Opciones del Combobox — solo SINDICALIZADOS activos
  const personalOptions: ComboboxOption[] = useMemo(
    () =>
      personalList.map((p) => ({
        value: p.id,
        label: `${p.apellidos} ${p.nombre}`,
        sublabel: `${p.puesto} · ${TIPOS_PERSONAL_LABEL[p.tipo]}`,
        disabled: !p.activo || p.tipo !== "SINDICALIZADO",
      })),
    [personalList],
  );

  const anioActual = watch("anio");

  const agregarFecha = () => {
    if (!nuevaFecha || !dateRegex.test(nuevaFecha)) {
      toast.error("Fecha inválida", { description: "Formato esperado: YYYY-MM-DD" });
      return;
    }
    // Validar que pertenezca al año seleccionado
    if (anioActual) {
      const yyyy = nuevaFecha.slice(0, 4);
      if (Number(yyyy) !== Number(anioActual)) {
        toast.error("Año incorrecto", {
          description: `La fecha ${nuevaFecha} no pertenece al año ${anioActual}.`,
        });
        return;
      }
    }
    // Validar día de la semana permitido (mar/mié/jue)
    const dow = diaSemana(nuevaFecha);
    if (!DIAS_PERMITIDOS.has(dow)) {
      toast.error("Día no permitido", {
        description: `El ${nuevaFecha} cae ${nombreDia(nuevaFecha)}. Solo se permiten martes, miércoles y jueves.`,
      });
      return;
    }
    if (fechas.includes(nuevaFecha)) {
      toast.error("Día duplicado", { description: "Ese día ya está en la lista." });
      return;
    }
    const nuevas = [...fechas, nuevaFecha].sort();
    setFechas(nuevas);
    setNuevaFecha("");
  };

  const eliminarFecha = (f: string) => {
    setFechas((prev) => prev.filter((x) => x !== f));
  };

  const onSubmit = async (data: FormData) => {
    if (fechas.length === 0) {
      toast.error("Faltan fechas", {
        description: "Agregá al menos un día al calendario.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        personalId: data.personalId,
        anio: data.anio,
        diasSolicitados: fechas.length,
        fechas,
        observaciones: data.observaciones || undefined,
      };

      const result = isEdit
        ? await api.actualizarDiaEconomico(initialData!.id, payload)
        : await api.crearDiaEconomico(payload);

      const empName = result.personal
        ? `${result.personal.nombre} ${result.personal.apellidos}`
        : `Empleado #${result.personalId}`;

      const fechaTxt =
        result.fechas && result.fechas.length > 0
          ? ` (${result.fechas.length} ${result.fechas.length === 1 ? "día capturado" : "días capturados"})`
          : ` (${result.diasSolicitados} ${result.diasSolicitados === 1 ? "día" : "días"})`;

      toast.success(
        isEdit ? "Días económicos actualizados" : "Días económicos registrados",
        {
          description: `${empName} — Año ${result.anio}${fechaTxt} #${result.id}`,
        },
      );

      if (!isEdit) {
        reset(defaultFormData());
        setFechas([]);
        setNuevaFecha("");
      }
      onSaved?.(result);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : isEdit
            ? "No se pudieron actualizar los días económicos"
            : "No se pudieron registrar los días económicos";
      toast.error(isEdit ? "Error al actualizar" : "Error al registrar", {
        description: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const serverDown = status !== "online";
  // Las fechas son state local (no RHF), por lo que no marcan el form
  // como dirty. Lo hacemos manual para que el botón "Guardar cambios"
  // se habilite cuando solo se cambian fechas.
  const hasFechasChanges = !isEdit
    ? false
    : JSON.stringify([...(fechas ?? [])].sort()) !==
      JSON.stringify([...(initialData?.fechas ?? [])].map(isoToYmd).sort());
  const canSubmitInEdit = !isEdit || isDirty || hasFechasChanges;
  const submitDisabled = submitting || serverDown || !canSubmitInEdit;

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

      {/* Nota informativa */}
      <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
        <Coins className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Los <strong>días económicos</strong> son exclusivos para empleados
          <strong> Sindicalizados</strong>. Capturá el año y los días
          específicos que se van a tomar.
        </p>
      </div>

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
          placeholder="Busca un empleado SINDICALIZADO…"
          emptyMessage={
            personalList.length === 0
              ? "No hay empleados sindicalizados activos"
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
            No hay empleados sindicalizados activos. Primero registra personal
            con tipo "Sindicalizado" en el tab "Personal".
          </p>
        )}
      </div>

      {/* Año */}
      <div className="space-y-1.5">
        <Label htmlFor="anio">
          <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
          Año<span className="ml-1 text-red-500">*</span>
        </Label>
        <Input
          id="anio"
          type="number"
          min={ANIO_MIN}
          max={ANIO_MAX}
          step={1}
          className={cn(
            "max-w-[140px]",
            errors.anio && "border-red-500 focus-visible:ring-red-500",
          )}
          {...register("anio", { valueAsNumber: true })}
        />
        {errors.anio && (
          <p className="text-xs text-red-600">{errors.anio.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Todos los días que agregues deben pertenecer a este año.
        </p>
      </div>

      {/* Captura de fechas específicas (no consecutivas) */}
      <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/30 p-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-emerald-700" />
            Días específicos<span className="ml-1 text-red-500">*</span>
          </Label>
          <span className="inline-flex h-5 min-w-[24px] items-center justify-center rounded-full bg-emerald-100 px-2 text-[11px] font-semibold text-emerald-800">
            {fechas.length} {fechas.length === 1 ? "día" : "días"}
          </span>
        </div>

        {/* Nota: días permitidos */}
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-800">
          <span className="inline-flex h-4 items-center rounded-full bg-emerald-200 px-1.5 font-semibold uppercase tracking-wide">
            Restricción
          </span>
          <span>
            Solo se permiten <strong>martes</strong>, <strong>miércoles</strong> y{" "}
            <strong>jueves</strong>. El sistema rechaza lunes, viernes, sábados y
            domingos.
          </span>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 max-w-xs space-y-1">
            <Input
              type="date"
              value={nuevaFecha}
              onChange={(e) => setNuevaFecha(e.target.value)}
              min={`${anioActual || ANIO_MIN}-01-01`}
              max={`${anioActual || ANIO_MAX}-12-31`}
              className="font-mono"
            />
            {nuevaFecha && dateRegex.test(nuevaFecha) && (
              <p className="text-[11px] text-muted-foreground">
                Caería <strong className={DIAS_PERMITIDOS.has(diaSemana(nuevaFecha)) ? "text-emerald-700" : "text-red-600"}>{nombreDia(nuevaFecha)}</strong>
                {!DIAS_PERMITIDOS.has(diaSemana(nuevaFecha)) && " — día no permitido"}
              </p>
            )}
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

        {fechas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {fechas.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900"
              >
                <CalendarDays className="h-3 w-3" />
                {f.split("-").reverse().join("/")}
                <span className="text-[10px] text-emerald-700">
                  ({nombreDia(f)})
                </span>
                <button
                  type="button"
                  onClick={() => eliminarFecha(f)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-emerald-200"
                  title="Quitar este día"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {fechas.length === 0
            ? "Agregá al menos un día."
            : "Podés capturar varios días no consecutivos. Hacé click en la X para quitar uno."}
        </p>
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
          placeholder="Motivo, autorización, etc. (opcional)"
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
          disabled={submitDisabled}
          className="min-w-[140px] bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
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
