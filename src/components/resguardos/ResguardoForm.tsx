/**
 * Form para crear/editar un Resguardo (equipo del inventario).
 * Campos: tipo, marca, modelo, número de serie, imagen, descripción,
 * estado, observaciones.
 */

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  ShieldCheck,
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
import type { EstadoResguardo, Resguardo } from "@/types/api";
import { ESTADO_RESGUARDO_LABEL } from "@/types/api";

const schema = z.object({
  tipo: z
    .string()
    .trim()
    .min(1, "Tipo requerido (ej. LAPTOP, MOUSE, MONITOR)")
    .max(80, "Máximo 80 caracteres"),
  marca: z
    .string()
    .trim()
    .min(1, "Marca requerida")
    .max(80, "Máximo 80 caracteres"),
  modelo: z
    .string()
    .trim()
    .max(120, "Máximo 120 caracteres")
    .optional()
    .or(z.literal("")),
  numeroSerie: z
    .string()
    .trim()
    .min(1, "Número de serie requerido")
    .max(120, "Máximo 120 caracteres"),
  descripcion: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
  estado: z.enum(["EN_BODEGA", "ASIGNADO", "REPARACION", "BAJA"]),
  observaciones: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
});

export type FormData = z.infer<typeof schema>;

const FIELD_LABELS: Record<keyof FormData, string> = {
  tipo: "Tipo",
  marca: "Marca",
  modelo: "Modelo",
  numeroSerie: "Número de serie",
  descripcion: "Descripción",
  estado: "Estado",
  observaciones: "Observaciones",
};

interface ResguardoFormProps {
  initialData?: Resguardo;
  onSaved?: (item: Resguardo) => void;
  embedded?: boolean;
  onCancel?: () => void;
}

function toFormData(r: Resguardo): FormData {
  return {
    tipo: r.tipo,
    marca: r.marca,
    modelo: r.modelo ?? "",
    numeroSerie: r.numeroSerie,
    descripcion: r.descripcion ?? "",
    estado: r.estado,
    observaciones: r.observaciones ?? "",
  };
}

function defaultFormData(): FormData {
  return {
    tipo: "",
    marca: "",
    modelo: "",
    numeroSerie: "",
    descripcion: "",
    estado: "EN_BODEGA",
    observaciones: "",
  };
}

function absoluteImageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${getServerUrl()}${path}`;
}

export function ResguardoForm({
  initialData,
  onSaved,
  embedded = false,
  onCancel,
}: ResguardoFormProps) {
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
        const up = await api.subirImagen(imageFile, "resguardos");
        imagenUrl = up.url;
      } else if (clearImage) {
        imagenUrl = null;
      } else if (initialData) {
        imagenUrl = initialData.imagen ?? null;
      }

      const payload = {
        tipo: data.tipo.toUpperCase(),
        marca: data.marca,
        modelo: data.modelo || undefined,
        numeroSerie: data.numeroSerie,
        imagen: imagenUrl === undefined ? undefined : imagenUrl,
        descripcion: data.descripcion || undefined,
        estado: data.estado as EstadoResguardo,
        observaciones: data.observaciones || undefined,
      };

      let result: Resguardo;
      if (isEdit) {
        result = await api.actualizarResguardo(initialData!.id, payload);
        toast.success("Resguardo actualizado", {
          description: `${result.tipo} ${result.marca} (S/N ${result.numeroSerie})`,
        });
      } else {
        result = await api.crearResguardo(payload);
        toast.success("Resguardo creado", {
          description: `${result.tipo} ${result.marca} (S/N ${result.numeroSerie})`,
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
            ? "No se pudo actualizar el resguardo"
            : "No se pudo crear el resguardo";
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

      {/* Tipo + Marca */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tipo">
            Tipo<span className="ml-1 text-red-500">*</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (LAPTOP, MOUSE, MONITOR…)
            </span>
          </Label>
          <Input
            id="tipo"
            placeholder="Ej. LAPTOP"
            className={cn(
              errors.tipo && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("tipo")}
          />
          {errors.tipo && (
            <p className="text-xs text-red-600">{errors.tipo.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="marca">
            Marca<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="marca"
            placeholder="Ej. HP, Dell, Logitech"
            className={cn(
              errors.marca && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("marca")}
          />
          {errors.marca && (
            <p className="text-xs text-red-600">{errors.marca.message}</p>
          )}
        </div>
      </div>

      {/* Modelo + N° de Serie */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="modelo">Modelo</Label>
          <Input
            id="modelo"
            placeholder="Ej. EliteBook 840 G7"
            {...register("modelo")}
          />
          {errors.modelo && (
            <p className="text-xs text-red-600">{errors.modelo.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="numeroSerie">
            Número de serie<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="numeroSerie"
            placeholder="Ej. SN-12345ABC"
            className={cn(
              "font-mono",
              errors.numeroSerie && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("numeroSerie")}
          />
          {errors.numeroSerie && (
            <p className="text-xs text-red-600">
              {errors.numeroSerie.message}
            </p>
          )}
        </div>
      </div>

      {/* Estado */}
      <div className="space-y-1.5">
        <Label htmlFor="estado">
          Estado<span className="ml-1 text-red-500">*</span>
        </Label>
        <select
          id="estado"
          className={cn(
            "flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            errors.estado && "border-red-500 focus-visible:ring-red-500",
          )}
          {...register("estado")}
        >
          {(["EN_BODEGA", "REPARACION"] as const).map((e) => (
            <option key={e} value={e}>
              {ESTADO_RESGUARDO_LABEL[e]}
            </option>
          ))}
        </select>
        {errors.estado && (
          <p className="text-xs text-red-600">{errors.estado.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Para asignar/devolver/baja usa los botones de la tarjeta en el
          inventario.
        </p>
      </div>

      {/* Imagen */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5 text-fuchsia-700" />
          Imagen
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            (opcional, máx 5 MB)
          </span>
        </Label>

        {currentImageUrl ? (
          <div className="flex items-start gap-3">
            <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-fuchsia-200 bg-fuchsia-50">
              {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
              <img
                src={currentImageUrl}
                alt="Vista previa"
                className="h-full w-full object-contain p-1"
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
            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/30 px-4 py-5 text-sm text-fuchsia-700 transition-colors hover:bg-fuchsia-50"
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
            📎 Archivo seleccionado:{" "}
            <span className="font-medium">{imageFile.name}</span> (
            {(imageFile.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      {/* Descripción */}
      <div className="space-y-1.5">
        <Label htmlFor="descripcion">Descripción</Label>
        <Input
          id="descripcion"
          placeholder="Características, accesorios incluidos, etc."
          {...register("descripcion")}
        />
        {errors.descripcion && (
          <p className="text-xs text-red-600">
            {errors.descripcion.message}
          </p>
        )}
      </div>

      {/* Observaciones */}
      <div className="space-y-1.5">
        <Label htmlFor="observaciones">Observaciones</Label>
        <textarea
          id="observaciones"
          rows={2}
          placeholder="Notas internas (opcional)"
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
          className="min-w-[140px] bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700"
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
              <ShieldCheck className="h-4 w-4" />
              Registrar equipo
            </>
          )}
        </Button>
      </div>

      {serverDown && !embedded && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <strong>Servidor desconectado.</strong> El formulario no podrá
          guardar hasta que conectes el servidor en{" "}
          <span className="font-semibold">Configuración</span>.
        </div>
      )}
    </form>
  );
}
