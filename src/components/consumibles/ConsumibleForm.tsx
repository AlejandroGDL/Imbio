/**
 * Form para crear/editar un Consumible (catálogo).
 * Campos: Concepto, Unidad, Cantidad inicial, Imagen (upload local), Observaciones.
 */

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Package,
  Upload,
  X,
  ImageIcon,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import { getServerUrl } from "@/lib/config";
import { useServerStatus } from "@/hooks/use-server-status";
import type { Consumible, Unidad } from "@/types/api";
import { UNIDADES, UNIDADES_LABEL } from "@/types/api";

const schema = z.object({
  concepto: z
    .string()
    .trim()
    .min(1, "Concepto requerido")
    .max(200, "Máximo 200 caracteres"),
  unidad: z.enum(UNIDADES, { message: "Unidad inválida" }),
  cantidadActual: z
    .number()
    .refine((n) => Number.isFinite(n) && n >= 0, "Cantidad debe ser ≥ 0"),
  observaciones: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

export type FormData = z.infer<typeof schema>;

const FIELD_LABELS: Record<keyof FormData, string> = {
  concepto: "Concepto",
  unidad: "Unidad",
  cantidadActual: "Cantidad inicial",
  observaciones: "Observaciones",
};

interface ConsumibleFormProps {
  initialData?: Consumible;
  onSaved?: (item: Consumible) => void;
  embedded?: boolean;
  onCancel?: () => void;
}

function toFormData(c: Consumible): FormData {
  return {
    concepto: c.concepto,
    unidad: c.unidad,
    cantidadActual: parseFloat(c.cantidadActual),
    observaciones: c.observaciones ?? "",
  };
}

function defaultFormData(): FormData {
  return {
    concepto: "",
    unidad: "PIEZA",
    cantidadActual: 0,
    observaciones: "",
  };
}

/** Construye la URL absoluta del backend para una imagen guardada como "/uploads/..." */
function absoluteImageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${getServerUrl()}${path}`;
}

export function ConsumibleForm({
  initialData,
  onSaved,
  embedded = false,
  onCancel,
}: ConsumibleFormProps) {
  const { status } = useServerStatus();
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [clearImage, setClearImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = !!initialData;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitted },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData ? toFormData(initialData) : defaultFormData(),
  });

  useEffect(() => {
    if (initialData) reset(toFormData(initialData));
    setImageFile(null);
    setImagePreview(null);
    setClearImage(false);
  }, [initialData, reset]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen excede 5 MB");
      return;
    }
    setImageFile(file);
    setClearImage(false);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setClearImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      // 1. Subir imagen si hay archivo nuevo
      let imagenUrl: string | undefined | null = undefined;
      if (imageFile) {
        const up = await api.subirImagen(imageFile);
        imagenUrl = up.url;
      } else if (clearImage) {
        imagenUrl = null; // se borró explícitamente
      } else if (initialData) {
        imagenUrl = initialData.imagen ?? null; // mantener la anterior
      }

      const payload = {
        concepto: data.concepto,
        unidad: data.unidad as Unidad,
        cantidadActual: data.cantidadActual,
        imagen: imagenUrl === undefined ? undefined : imagenUrl,
        observaciones: data.observaciones || undefined,
      };

      let result: Consumible;
      if (isEdit) {
        result = await api.actualizarConsumible(initialData!.id, payload);
        toast.success("Consumible actualizado", {
          description: result.concepto,
        });
      } else {
        result = await api.crearConsumible(payload);
        toast.success("Consumible creado", {
          description: result.concepto,
        });
      }
      if (!isEdit) {
        reset(defaultFormData());
        setImageFile(null);
        setImagePreview(null);
        setClearImage(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      onSaved?.(result);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : isEdit
            ? "No se pudo actualizar"
            : "No se pudo crear";
      toast.error(isEdit ? "Error al actualizar" : "Error al crear", {
        description: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const serverDown = status !== "online";
  const errorCount = Object.keys(errors).length;
  // La imagen vive fuera de react-hook-form (en useState), por lo que no
  // marca el form como dirty. Lo hacemos manual para que el botón
  // "Guardar cambios" se habilite cuando solo se cambió/quitó la imagen.
  const hasImageChanges = imageFile !== null || clearImage;
  const canSubmitInEdit = !isEdit || isDirty || hasImageChanges;

  // La imagen actual a mostrar: si hay preview de archivo nuevo, esa; si no y no se borró, la original
  const currentImageUrl = imagePreview
    ? imagePreview
    : clearImage
      ? null
      : absoluteImageUrl(initialData?.imagen ?? null);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

      {/* Concepto */}
      <div className="space-y-1.5">
        <Label htmlFor="concepto">
          Concepto<span className="ml-1 text-red-500">*</span>
        </Label>
        <Input
          id="concepto"
          placeholder="Ej. Tóner para impresora HP"
          className={cn(
            errors.concepto && "border-red-500 focus-visible:ring-red-500",
          )}
          {...register("concepto")}
        />
        {errors.concepto && (
          <p className="text-xs text-red-600">{errors.concepto.message}</p>
        )}
      </div>

      {/* Unidad + Cantidad */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
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

        <div className="space-y-1.5">
          <Label htmlFor="cantidadActual">Cantidad inicial</Label>
          <Input
            id="cantidadActual"
            type="number"
            step="0.01"
            min="0"
            className={cn(
              errors.cantidadActual && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("cantidadActual", { valueAsNumber: true })}
          />
          <p className="text-xs text-muted-foreground">
            Para ajuste manual. Las entradas/salidas reales se llevan en el
            historial.
          </p>
        </div>
      </div>

      {/* Imagen */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5 text-rose-700" />
          Imagen
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            (opcional, máx 5 MB)
          </span>
        </Label>

        {currentImageUrl ? (
          <div className="flex items-start gap-3">
            <div className="relative h-32 w-32 overflow-hidden rounded-lg border border-rose-200 bg-rose-50">
              {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
              <img
                src={currentImageUrl}
                alt="Vista previa"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {imageFile ? "Cambiar imagen" : "Reemplazar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveImage}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <X className="h-3.5 w-3.5" />
                Quitar imagen
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-rose-200 bg-rose-50/30 px-4 py-6 text-sm text-rose-700 transition-colors hover:bg-rose-50"
          >
            <Upload className="h-6 w-6" />
            <span className="font-medium">Click para seleccionar imagen</span>
            <span className="text-xs text-muted-foreground">
              JPG, PNG, WebP o GIF · máx 5 MB
            </span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
        {imageFile && (
          <p className="text-xs text-muted-foreground">
            📎 Archivo seleccionado: <span className="font-medium">{imageFile.name}</span> (
            {(imageFile.size / 1024).toFixed(1)} KB)
          </p>
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
          disabled={submitting || serverDown || !canSubmitInEdit}
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
              <Package className="h-4 w-4" />
              Crear consumible
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
