import { useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Settings,
  FileText,
  DollarSign,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import { useServerStatus } from "@/hooks/use-server-status";
import type { CampoTramite, Tramite, TipoCampo } from "@/types/api";

// =================================================================
// Schema de validación
// =================================================================

const TIPOS_CAMPO: { value: TipoCampo; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Fecha" },
  { value: "datetime", label: "Fecha y hora" },
  { value: "time", label: "Hora" },
  { value: "select", label: "Selección" },
  { value: "textarea", label: "Texto largo" },
  { value: "boolean", label: "Sí/No" },
  { value: "currency", label: "Moneda" },
];

const CATEGORIAS = [
  { value: "PERMISO", label: "Permiso" },
  { value: "SERVICIO", label: "Servicio" },
  { value: "SANCION", label: "Sanción" },
] as const;

const campoSchema = z.object({
  key: z.string().trim().min(1, "Requerido").max(50),
  label: z.string().trim().min(1, "Requerido").max(120),
  tipo: z.enum([
    "text",
    "number",
    "date",
    "datetime",
    "time",
    "select",
    "textarea",
    "boolean",
    "currency",
  ]),
  required: z.boolean(),
  placeholder: z.string().optional(),
  optionsText: z.string().optional(), // solo se usa para tipo "select", separado por líneas
  helpText: z.string().optional(),
  showInAuthorization: z.boolean(),
  afectaPrecio: z.boolean(),
});

// Tipo del form — todo string/number/boolean, sin coercion
// Las conversiones se hacen en el submit
type FormData = {
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: "PERMISO" | "SERVICIO" | "SANCION";
  precioBase: string;
  requierePago: boolean;
  activo: boolean;
  orden: number;
  reglaPrecioJson: string;
  campos: z.infer<typeof campoSchema>[];
};

const schema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(50)
    .regex(/^[A-Z0-9_]+$/, "Solo mayúsculas, números y guión bajo"),
  nombre: z.string().trim().min(1, "Requerido").max(120),
  descripcion: z.string(),
  categoria: z.enum(["PERMISO", "SERVICIO", "SANCION"]),
  precioBase: z.string(),
  requierePago: z.boolean(),
  activo: z.boolean(),
  orden: z.number().int().min(0),
  reglaPrecioJson: z.string(),
  campos: z.array(campoSchema).min(1, "Define al menos un campo"),
});

// =================================================================
// Helpers
// =================================================================

function camposToText(options?: string[]) {
  return (options ?? []).join("\n");
}
function textToOptions(text?: string) {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function formDataToCampos(arr: z.infer<typeof campoSchema>[]): CampoTramite[] {
  return arr.map((c) => ({
    key: c.key,
    label: c.label,
    tipo: c.tipo,
    required: c.required,
    placeholder: c.placeholder || undefined,
    options: c.tipo === "select" ? textToOptions(c.optionsText) : undefined,
    helpText: c.helpText || undefined,
    showInAuthorization: c.showInAuthorization,
    afectaPrecio: c.afectaPrecio,
  }));
}

function camposToFormData(campos: CampoTramite[]): z.infer<typeof campoSchema>[] {
  return campos.map((c) => ({
    key: c.key,
    label: c.label,
    tipo: c.tipo,
    required: c.required,
    placeholder: c.placeholder ?? "",
    optionsText: c.tipo === "select" ? camposToText(c.options) : "",
    helpText: c.helpText ?? "",
    showInAuthorization: c.showInAuthorization ?? false,
    afectaPrecio: c.afectaPrecio ?? false,
  }));
}

function tramiteToFormData(t: Tramite): FormData {
  return {
    codigo: t.codigo,
    nombre: t.nombre,
    descripcion: t.descripcion ?? "",
    categoria: t.categoria,
    precioBase: t.precioBase ?? "",
    requierePago: t.requierePago,
    activo: t.activo,
    orden: t.orden,
    reglaPrecioJson: t.reglaPrecio ? JSON.stringify(t.reglaPrecio, null, 2) : "",
    campos: camposToFormData(t.campos),
  };
}

function emptyFormData(): FormData {
  return {
    codigo: "",
    nombre: "",
    descripcion: "",
    categoria: "PERMISO",
    precioBase: "",
    requierePago: true,
    activo: true,
    orden: 0,
    reglaPrecioJson: "",
    campos: [
      {
        key: "campo1",
        label: "Campo 1",
        tipo: "text",
        required: false,
        placeholder: "",
        optionsText: "",
        helpText: "",
        showInAuthorization: true,
        afectaPrecio: false,
      },
    ],
  };
}

// =================================================================
// Componente
// =================================================================

interface TramiteFormProps {
  initialData?: Tramite;
  onSaved?: (t: Tramite) => void;
  onCancel?: () => void;
}

export function TramiteForm({ initialData, onSaved, onCancel }: TramiteFormProps) {
  const { status } = useServerStatus();
  const isEdit = !!initialData;
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData ? tramiteToFormData(initialData) : emptyFormData(),
  });

  useEffect(() => {
    if (initialData) reset(tramiteToFormData(initialData));
  }, [initialData, reset]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "campos",
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      // Parsea reglaPrecioJson si viene
      let reglaPrecio: unknown = undefined;
      if (data.reglaPrecioJson && data.reglaPrecioJson.trim()) {
        try {
          reglaPrecio = JSON.parse(data.reglaPrecioJson);
        } catch {
          toast.error("JSON inválido en Regla de Precio", {
            description: "Revisa la sintaxis del JSON",
          });
          setSubmitting(false);
          return;
        }
      }

      const precioBaseNum =
        data.precioBase === undefined ||
        data.precioBase === "" ||
        data.precioBase === null
          ? undefined
          : Number(data.precioBase);

      const payload = {
        codigo: data.codigo.toUpperCase(),
        nombre: data.nombre,
        descripcion: data.descripcion || undefined,
        categoria: data.categoria,
        campos: formDataToCampos(data.campos),
        precioBase: precioBaseNum,
        reglaPrecio,
        requierePago: data.requierePago,
        activo: data.activo,
        orden: Number(data.orden) || 0,
      };

      const result = isEdit
        ? await api.actualizarTramite(initialData!.id, payload)
        : await api.crearTramite(payload as any);

      onSaved?.(result);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : isEdit
            ? "No se pudo guardar el trámite"
            : "No se pudo crear el trámite";
      toast.error(isEdit ? "Error al guardar" : "Error al crear", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const serverDown = status !== "online";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* ============================================================ */}
      {/* Datos básicos */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-emerald-600" />
            Datos básicos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="codigo">
                Código<span className="ml-1 text-red-500">*</span>
              </Label>
              <Input
                id="codigo"
                placeholder="PERMISO_PODA"
                className={cn(
                  "font-mono uppercase",
                  errors.codigo && "border-red-500",
                )}
                {...register("codigo")}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase();
                  register("codigo").onChange(e);
                }}
              />
              {errors.codigo && (
                <p className="text-xs text-red-600">{errors.codigo.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Mayúsculas, números y guión bajo. Sin espacios.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="categoria">
                Categoría<span className="ml-1 text-red-500">*</span>
              </Label>
              <select
                id="categoria"
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  errors.categoria && "border-red-500",
                )}
                {...register("categoria")}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nombre">
              Nombre<span className="ml-1 text-red-500">*</span>
            </Label>
            <Input
              id="nombre"
              placeholder="Permiso de Poda de Árbol"
              className={cn(errors.nombre && "border-red-500")}
              {...register("nombre")}
            />
            {errors.nombre && (
              <p className="text-xs text-red-600">{errors.nombre.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descripcion">Descripción</Label>
            <textarea
              id="descripcion"
              placeholder="Descripción breve del trámite..."
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              {...register("descripcion")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="precioBase">Precio base (MXN)</Label>
              <Input
                id="precioBase"
                type="number"
                min="0"
                step="0.01"
                placeholder="250.00"
                {...register("precioBase")}
              />
              <p className="text-xs text-muted-foreground">Vacío = variable</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="orden">Orden</Label>
              <Input
                id="orden"
                type="number"
                min="0"
                {...register("orden")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>¿Requiere pago?</Label>
              <Controller
                control={control}
                name="requierePago"
                render={({ field }) => (
                  <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      className="h-4 w-4"
                    />
                    <span>Sí (memorándum)</span>
                  </label>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Activo</Label>
              <Controller
                control={control}
                name="activo"
                render={({ field }) => (
                  <label
                    className={cn(
                      "flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm",
                      field.value
                        ? "bg-emerald-50 text-emerald-900"
                        : "bg-slate-50 text-slate-500",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      className="h-4 w-4"
                    />
                    <span>
                      {field.value
                        ? "Activo — se muestra en el wizard de Nuevos Servicios"
                        : "Inactivo — NO se muestra en el wizard de Nuevos Servicios"}
                    </span>
                  </label>
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Campos dinámicos */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4 text-emerald-600" />
            Campos del formulario
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({fields.length} {fields.length === 1 ? "campo" : "campos"})
            </span>
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                key: `campo${fields.length + 1}`,
                label: `Campo ${fields.length + 1}`,
                tipo: "text",
                required: false,
                placeholder: "",
                optionsText: "",
                helpText: "",
                showInAuthorization: true,
                afectaPrecio: false,
              })
            }
          >
            <Plus className="h-4 w-4" />
            Agregar campo
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {errors.campos?.root && (
            <p className="text-xs text-red-600">{errors.campos.root.message}</p>
          )}
          {fields.length === 0 && (
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Agrega al menos un campo. Este trámite no se puede crear sin campos.
            </div>
          )}

          {fields.map((field, index) => (
            <CampoEditor
              key={field.id}
              index={index}
              register={register}
              control={control}
              watch={watch}
              onRemove={() => remove(index)}
              canRemove={fields.length > 1}
            />
          ))}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Regla de precio (opcional, JSON) */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Regla de precio variable
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              (opcional)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-xs text-muted-foreground">
            Si el precio varía según los datos capturados (ej. según la altura del
            árbol), definí la regla en JSON. Si no, dejá vacío.
          </p>
          <textarea
            placeholder={`{
  "tipo": "rango",
  "campo": "altura",
  "rangos": [
    { "hasta": 5, "precio": 150 },
    { "hasta": 10, "precio": 300 }
  ]
}`}
            rows={6}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            {...register("reglaPrecioJson")}
          />
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Acciones */}
      {/* ============================================================ */}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={submitting || serverDown || (isEdit && !isDirty)}
          className="min-w-[160px] bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
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
              <Plus className="h-4 w-4" />
              Crear trámite
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// =================================================================
// Editor de un campo individual
// =================================================================

interface CampoEditorProps {
  index: number;
  register: any;
  control: any;
  watch: any;
  onRemove: () => void;
  canRemove: boolean;
}

function CampoEditor({ index, register, watch, onRemove, canRemove }: CampoEditorProps) {
  const [expanded, setExpanded] = useState(true);
  const tipo = watch(`campos.${index}.tipo`);
  const label = watch(`campos.${index}.label`);
  const key = watch(`campos.${index}.key`);
  const required = watch(`campos.${index}.required`);

  return (
    <div
      className={cn(
        "rounded-lg border bg-slate-50/40 transition-colors",
        required && "border-emerald-300 bg-emerald-50/30",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b bg-white/50 px-3 py-2">
        <GripVertical className="h-4 w-4 text-slate-400" />
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
          <span className="text-sm font-medium">
            {label || `Campo ${index + 1}`}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {key}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
            {tipo}
          </span>
          {required && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">
              obligatorio
            </span>
          )}
        </button>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-7 w-7 text-red-600 hover:bg-red-50"
            title="Eliminar campo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Body */}
      {expanded && (
        <div className="space-y-3 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Key (identificador único)</Label>
              <Input
                placeholder="altura"
                className="font-mono text-xs"
                {...register(`campos.${index}.key`)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Label (etiqueta visible)</Label>
              <Input
                placeholder="Altura (m)"
                {...register(`campos.${index}.label`)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo de campo</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                {...register(`campos.${index}.tipo`)}
              >
                {TIPOS_CAMPO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Placeholder (opcional)</Label>
              <Input
                placeholder="Texto de ayuda"
                {...register(`campos.${index}.placeholder`)}
              />
            </div>
          </div>

          {/* Si es select, mostrar opciones */}
          {tipo === "select" && (
            <div className="space-y-1.5">
              <Label>Opciones (una por línea)</Label>
              <textarea
                rows={4}
                placeholder={"Bueno\nRegular\nMalo"}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                {...register(`campos.${index}.optionsText`)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Texto de ayuda (opcional)</Label>
            <Input
              placeholder="Ej: Diámetro a la altura del pecho"
              {...register(`campos.${index}.helpText`)}
            />
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-4 border-t pt-3 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-4 w-4" {...register(`campos.${index}.required`)} />
              <span>Obligatorio</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                {...register(`campos.${index}.showInAuthorization`)}
              />
              <span>Mostrar en autorización</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                {...register(`campos.${index}.afectaPrecio`)}
              />
              <span>Afecta precio</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
