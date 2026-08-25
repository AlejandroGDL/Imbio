import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  UserPlus,
  User,
  Car,
  Briefcase,
  AlertCircle,
  Camera,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getServerUrl } from "@/lib/config";

import { api, ApiError } from "@/lib/api";
import { useServerStatus } from "@/hooks/use-server-status";
import { TIPOS_PERSONAL_LABEL, type Personal } from "@/types/api";

// =================================================================
// Validación con Zod
// =================================================================
const curpRegex = /^[A-Z]{4}\d{6}[A-Z]{6}[A-Z0-9]{2}$/;
const telRegex = /^\d{10}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    // --- Datos personales ---
    nombre: z
      .string()
      .trim()
      .min(1, "Nombre requerido")
      .max(80, "Máximo 80 caracteres"),
    apellidos: z
      .string()
      .trim()
      .min(1, "Apellidos requeridos")
      .max(160, "Máximo 160 caracteres"),
    curp: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || curpRegex.test(v),
        "CURP inválida",
      ),
    fechaNacimiento: z
      .string()
      .regex(dateRegex, "Fecha inválida (YYYY-MM-DD)")
      .optional()
      .or(z.literal("")),
    telefono: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || telRegex.test(v), "Teléfono inválido (10 dígitos)"),
    domicilio: z
      .string()
      .trim()
      .max(500, "Máximo 500 caracteres")
      .optional()
      .or(z.literal("")),
    // --- Licencia de manejo ---
    sabeManejar: z.boolean(),
    tieneLicencia: z.boolean(),
    fechaExpedicionLicencia: z
      .string()
      .regex(dateRegex, "Fecha inválida (YYYY-MM-DD)")
      .optional()
      .or(z.literal("")),
    fechaExpiracionLicencia: z
      .string()
      .regex(dateRegex, "Fecha inválida (YYYY-MM-DD)")
      .optional()
      .or(z.literal("")),
    // --- Puesto ---
    puesto: z
      .string()
      .trim()
      .min(1, "Puesto requerido")
      .max(120, "Máximo 120 caracteres"),
    fechaIngreso: z
      .string()
      .regex(dateRegex, "Fecha de ingreso inválida (YYYY-MM-DD)"),
    tipo: z.enum(["CONFIANZA", "SINDICALIZADO"], {
      message: "Selecciona Confianza o Sindicalizado",
    }),
  })
  .refine(
    (data) => {
      if (!data.tieneLicencia) return true;
      if (!data.fechaExpedicionLicencia || !data.fechaExpiracionLicencia) {
        return false;
      }
      return data.fechaExpiracionLicencia > data.fechaExpedicionLicencia;
    },
    {
      message:
        "Si tiene licencia, completa expedición y expiración (expiración posterior)",
      path: ["fechaExpiracionLicencia"],
    },
  );

export type FormData = z.infer<typeof schema>;

interface PersonalFormProps {
  initialData?: Personal;
  onSaved?: (item: Personal) => void;
  embedded?: boolean;
  onCancel?: () => void;
}

function toFormData(p: Personal): FormData {
  const ymd = (d: string | null) => (d && d.length >= 10 ? d.slice(0, 10) : "");
  return {
    nombre: p.nombre,
    apellidos: p.apellidos,
    curp: p.curp ?? "",
    fechaNacimiento: ymd(p.fechaNacimiento),
    telefono: p.telefono ?? "",
    domicilio: p.domicilio ?? "",
    sabeManejar: p.sabeManejar,
    tieneLicencia: p.tieneLicencia,
    fechaExpedicionLicencia: ymd(p.fechaExpedicionLicencia),
    fechaExpiracionLicencia: ymd(p.fechaExpiracionLicencia),
    puesto: p.puesto,
    fechaIngreso: ymd(p.fechaIngreso),
    tipo: p.tipo,
  };
}

function defaultFormData(): FormData {
  return {
    nombre: "",
    apellidos: "",
    curp: "",
    fechaNacimiento: "",
    telefono: "",
    domicilio: "",
    sabeManejar: false,
    tieneLicencia: false,
    fechaExpedicionLicencia: "",
    fechaExpiracionLicencia: "",
    puesto: "",
    fechaIngreso: "",
    tipo: "CONFIANZA",
  };
}

/**
 * Mapping de keys de campos a etiquetas legibles en español. Se usa
 * para la alerta de campos faltantes.
 */
const FIELD_LABELS: Record<keyof FormData, string> = {
  nombre: "Nombre(s)",
  apellidos: "Apellidos",
  curp: "CURP",
  fechaNacimiento: "Fecha de nacimiento",
  telefono: "Teléfono",
  domicilio: "Domicilio",
  sabeManejar: "¿Sabe manejar?",
  tieneLicencia: "¿Cuenta con licencia?",
  fechaExpedicionLicencia: "Fecha de expedición de licencia",
  fechaExpiracionLicencia: "Fecha de expiración de licencia",
  puesto: "Puesto",
  fechaIngreso: "Fecha de ingreso",
  tipo: "Tipo (Confianza / Sindicalizado)",
};

export function PersonalForm({
  initialData,
  onSaved,
  embedded = false,
  onCancel,
}: PersonalFormProps) {
  const { status } = useServerStatus();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!initialData;
  // Foto: vive fuera del form (mismo patrón que Consumible/Resguardo)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [clearImage, setClearImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (initialData) {
      reset(toFormData(initialData));
    }
    setImageFile(null);
    setImagePreview(null);
    setClearImage(false);
  }, [initialData, reset]);

  // Si tieneLicencia se desmarca, limpiamos también las fechas
  const tieneLicencia = watch("tieneLicencia");
  useEffect(() => {
    if (!tieneLicencia) {
      setValue("fechaExpedicionLicencia", "", { shouldDirty: false });
      setValue("fechaExpiracionLicencia", "", { shouldDirty: false });
    }
  }, [tieneLicencia, setValue]);

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

  // Mismo truco que Consumible/Resguardo: la foto vive en useState
  // (no en RHF), por lo que no marca el form como dirty. Hacemos
  // dirty manual para que el botón "Guardar cambios" se habilite
  // cuando solo se cambia/quita la foto.
  const hasImageChanges = !isEdit
    ? false
    : imageFile !== null || clearImage;
  const canSubmitInEdit = !isEdit || isDirty || hasImageChanges;

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      // 1) Subir la foto si hay archivo nuevo
      let fotoUrl: string | undefined | null = undefined;
      if (imageFile) {
        const up = await api.subirImagen(imageFile, "personal");
        fotoUrl = up.url;
      } else if (clearImage) {
        fotoUrl = null; // borrado explícito
      } else if (initialData) {
        fotoUrl = initialData.foto ?? null; // mantener la anterior
      }

      const payload = {
        nombre: data.nombre,
        apellidos: data.apellidos,
        curp: data.curp || undefined,
        fechaNacimiento: data.fechaNacimiento || undefined,
        telefono: data.telefono || undefined,
        domicilio: data.domicilio || undefined,
        sabeManejar: data.sabeManejar,
        tieneLicencia: data.tieneLicencia,
        fechaExpedicionLicencia: data.tieneLicencia
          ? data.fechaExpedicionLicencia || undefined
          : undefined,
        fechaExpiracionLicencia: data.tieneLicencia
          ? data.fechaExpiracionLicencia || undefined
          : undefined,
        puesto: data.puesto,
        fechaIngreso: data.fechaIngreso,
        tipo: data.tipo,
        foto: fotoUrl === undefined ? undefined : fotoUrl,
      };

      const result = isEdit
        ? await api.actualizarPersonal(initialData!.id, payload)
        : await api.crearPersonal(payload);

      toast.success(
        isEdit ? "Personal actualizado" : "Personal registrado",
        {
          description: `${result.nombre} ${result.apellidos} — ${result.puesto} #${result.id}`,
        },
      );

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
            ? "No se pudo actualizar el personal"
            : "No se pudo registrar al personal";
      toast.error(isEdit ? "Error al actualizar" : "Error al registrar", {
        description: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const serverDown = status !== "online";

  // Imagen a mostrar: preview del archivo nuevo, o null si se borró,
  // o la original del servidor.
  const currentImageUrl = imagePreview
    ? imagePreview
    : clearImage
      ? null
      : initialData?.foto
        ? `${getServerUrl()}${initialData.foto}`
        : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Foto de perfil */}
      <div className="rounded-lg border border-sky-200 bg-sky-50/30 p-3">
        <Label className="flex items-center gap-1.5 text-sm">
          <Camera className="h-3.5 w-3.5 text-sky-700" />
          Foto de perfil
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            (opcional, máx 5 MB)
          </span>
        </Label>

        <div className="mt-2 flex items-start gap-3">
          {currentImageUrl ? (
            <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-sky-200 bg-sky-50">
              {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
              <img
                src={currentImageUrl}
                alt="Foto del personal"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-sky-300 bg-sky-50 text-xs text-sky-700 transition-colors hover:bg-sky-100"
            >
              <Camera className="h-5 w-5" />
              <span className="font-medium">Subir foto</span>
            </button>
          )}

          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {imageFile
                ? "Cambiar foto"
                : currentImageUrl
                  ? "Reemplazar"
                  : "Subir foto"}
            </Button>
            {currentImageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveImage}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <X className="h-3.5 w-3.5" />
                Quitar foto
              </Button>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
        {imageFile && (
          <p className="mt-2 text-xs text-muted-foreground">
            📎 Archivo seleccionado:{" "}
            <span className="font-medium">{imageFile.name}</span> (
            {(imageFile.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      {/* Alerta global de campos faltantes / inválidos (solo tras
          el primer intento de submit; desaparece cuando el form
          queda válido). */}
      {isSubmitted && Object.keys(errors).length > 0 && (
        <Alert variant="destructive" className="text-left">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>
            Faltan {Object.keys(errors).length === 1 ? "1 campo" : `${Object.keys(errors).length} campos`} por completar o corregir
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

      <Tabs defaultValue="personales" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personales">
            <User className="h-4 w-4" />
            Datos personales
          </TabsTrigger>
          <TabsTrigger value="licencia">
            <Car className="h-4 w-4" />
            Licencia de manejo
          </TabsTrigger>
          <TabsTrigger value="puesto">
            <Briefcase className="h-4 w-4" />
            Puesto
          </TabsTrigger>
        </TabsList>

        {/* =========================================== */}
        {/* TAB 1: Datos personales                      */}
        {/* =========================================== */}
        <TabsContent value="personales" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">
                Nombre(s)<span className="ml-1 text-red-500">*</span>
              </Label>
              <Input
                id="nombre"
                placeholder="Ej. María Fernanda"
                className={cn(
                  errors.nombre && "border-red-500 focus-visible:ring-red-500",
                )}
                {...register("nombre")}
              />
              {errors.nombre && (
                <p className="text-xs text-red-600">{errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="apellidos">
                Apellidos<span className="ml-1 text-red-500">*</span>
              </Label>
              <Input
                id="apellidos"
                placeholder="Ej. Castillo Ruiz"
                className={cn(
                  errors.apellidos && "border-red-500 focus-visible:ring-red-500",
                )}
                {...register("apellidos")}
              />
              {errors.apellidos && (
                <p className="text-xs text-red-600">
                  {errors.apellidos.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="curp">
                CURP{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (Opcional)
                </span>
              </Label>
              <Input
                id="curp"
                placeholder="GARP850612HDFRML09"
                maxLength={18}
                className={cn(
                  "font-mono uppercase",
                  errors.curp && "border-red-500 focus-visible:ring-red-500",
                )}
                {...register("curp")}
              />
              {errors.curp ? (
                <p className="text-xs text-red-600">{errors.curp.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  18 caracteres (único en el sistema si se captura)
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fechaNacimiento">
                Fecha de nacimiento{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (Opcional)
                </span>
              </Label>
              <Input
                id="fechaNacimiento"
                type="date"
                className={cn(
                  errors.fechaNacimiento &&
                    "border-red-500 focus-visible:ring-red-500",
                )}
                {...register("fechaNacimiento")}
              />
              {errors.fechaNacimiento && (
                <p className="text-xs text-red-600">
                  {errors.fechaNacimiento.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="telefono">
                Teléfono{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (Opcional)
                </span>
              </Label>
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
                <p className="text-xs text-muted-foreground">10 dígitos</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="domicilio">
              Domicilio{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (Opcional)
              </span>
            </Label>
            <textarea
              id="domicilio"
              rows={2}
              placeholder="Calle, número, colonia, ciudad (opcional)"
              className={cn(
                "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                errors.domicilio && "border-red-500 focus-visible:ring-red-500",
              )}
              {...register("domicilio")}
            />
            {errors.domicilio && (
              <p className="text-xs text-red-600">
                {errors.domicilio.message}
              </p>
            )}
          </div>
        </TabsContent>

        {/* =========================================== */}
        {/* TAB 2: Licencia de manejo                   */}
        {/* =========================================== */}
        <TabsContent value="licencia" className="space-y-4">
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="sabeManejar"
                checked={watch("sabeManejar")}
                onCheckedChange={(checked) =>
                  setValue("sabeManejar", !!checked, { shouldDirty: true })
                }
              />
              <Label
                htmlFor="sabeManejar"
                className="cursor-pointer text-sm font-medium"
              >
                ¿Sabe manejar?
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="tieneLicencia"
                checked={watch("tieneLicencia")}
                onCheckedChange={(checked) =>
                  setValue("tieneLicencia", !!checked, { shouldDirty: true })
                }
              />
              <Label
                htmlFor="tieneLicencia"
                className="cursor-pointer text-sm font-medium"
              >
                ¿Cuenta con licencia de manejo?
              </Label>
            </div>
          </div>

          {tieneLicencia && (
            <div className="grid gap-4 rounded-lg border border-amber-200 bg-amber-50/40 p-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fechaExpedicionLicencia">
                  Fecha de expedición
                  <span className="ml-1 text-red-500">*</span>
                </Label>
                <Input
                  id="fechaExpedicionLicencia"
                  type="date"
                  className={cn(
                    errors.fechaExpedicionLicencia &&
                      "border-red-500 focus-visible:ring-red-500",
                  )}
                  {...register("fechaExpedicionLicencia")}
                />
                {errors.fechaExpedicionLicencia && (
                  <p className="text-xs text-red-600">
                    {errors.fechaExpedicionLicencia.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fechaExpiracionLicencia">
                  Fecha de expiración
                  <span className="ml-1 text-red-500">*</span>
                </Label>
                <Input
                  id="fechaExpiracionLicencia"
                  type="date"
                  className={cn(
                    errors.fechaExpiracionLicencia &&
                      "border-red-500 focus-visible:ring-red-500",
                  )}
                  {...register("fechaExpiracionLicencia")}
                />
                {errors.fechaExpiracionLicencia && (
                  <p className="text-xs text-red-600">
                    {errors.fechaExpiracionLicencia.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {!tieneLicencia && (
            <p className="text-xs text-muted-foreground">
              Activa "¿Cuenta con licencia de manejo?" para capturar las fechas
              de expedición y expiración.
            </p>
          )}
        </TabsContent>

        {/* =========================================== */}
        {/* TAB 3: Puesto                               */}
        {/* =========================================== */}
        <TabsContent value="puesto" className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="puesto">
              Puesto<span className="ml-1 text-red-500">*</span>
            </Label>
            <Input
              id="puesto"
              placeholder="Ej. Inspector Ambiental, Director, Auxiliar..."
              className={cn(
                errors.puesto && "border-red-500 focus-visible:ring-red-500",
              )}
              {...register("puesto")}
            />
            {errors.puesto && (
              <p className="text-xs text-red-600">{errors.puesto.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fechaIngreso">
                Fecha de ingreso<span className="ml-1 text-red-500">*</span>
              </Label>
              <Input
                id="fechaIngreso"
                type="date"
                className={cn(
                  errors.fechaIngreso &&
                    "border-red-500 focus-visible:ring-red-500",
                )}
                {...register("fechaIngreso")}
              />
              {errors.fechaIngreso && (
                <p className="text-xs text-red-600">
                  {errors.fechaIngreso.message}
                </p>
              )}
            </div>

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
                {(Object.keys(TIPOS_PERSONAL_LABEL) as Array<keyof typeof TIPOS_PERSONAL_LABEL>).map(
                  (k) => (
                    <option key={k} value={k}>
                      {TIPOS_PERSONAL_LABEL[k]}
                    </option>
                  ),
                )}
              </select>
              {errors.tipo && (
                <p className="text-xs text-red-600">{errors.tipo.message}</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Botones */}
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={submitting || serverDown || !canSubmitInEdit}
          className="min-w-[140px] bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700"
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
