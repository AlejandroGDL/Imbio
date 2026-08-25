import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { UserPlus, Loader2, RotateCcw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { api, ApiError } from "@/lib/api";
import { useServerStatus } from "@/hooks/use-server-status";
import type { Ciudadano } from "@/types/api";

// =================================================================
// Validación con Zod
// =================================================================
const curpRegex = /^[A-Z]{4}\d{6}[A-Z]{6}[A-Z0-9]{2}$/;
const telRegex = /^\d{10}$/;

const schema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(80, "Máximo 80 caracteres"),
  apellidoPaterno: z
    .string()
    .trim()
    .min(1, "El apellido paterno es obligatorio")
    .max(80, "Máximo 80 caracteres"),
  apellidoMaterno: z
    .string()
    .trim()
    .max(80, "Máximo 80 caracteres")
    .optional()
    .or(z.literal("")),
  curp: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || curpRegex.test(v),
      "CURP inválido (formato: 4 letras, 6 dígitos, 6 letras, 2 alfanuméricos)",
    ),
  telefono: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || telRegex.test(v),
      "Teléfono inválido (10 dígitos)",
    ),
});

export type FormData = z.infer<typeof schema>;

interface CiudadanoFormProps {
  /** Si se pasa, el formulario está en modo edición */
  initialData?: Ciudadano;
  /** Callback después de guardar exitosamente */
  onSaved?: (ciudadano: Ciudadano) => void;
  /** Si es true, oculta la card wrapper (para usar dentro de modales) */
  embedded?: boolean;
  /** Si es true, muestra botón Cancelar en vez de Limpiar */
  onCancel?: () => void;
}

// Helper: convierte Ciudadano → FormData
function toFormData(c: Ciudadano): FormData {
  return {
    nombre: c.nombre,
    apellidoPaterno: c.apellidoPaterno,
    apellidoMaterno: c.apellidoMaterno ?? "",
    curp: c.curp ?? "",
    telefono: c.telefono ?? "",
  };
}

export function CiudadanoForm({
  initialData,
  onSaved,
  embedded = false,
  onCancel,
}: CiudadanoFormProps) {
  const { status } = useServerStatus();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!initialData;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData
      ? toFormData(initialData)
      : { nombre: "", apellidoPaterno: "", apellidoMaterno: "", curp: "", telefono: "" },
  });

  // Si cambia initialData, resetea el form (útil si se reabre el modal)
  useEffect(() => {
    if (initialData) reset(toFormData(initialData));
  }, [initialData, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const payload = {
        nombre: data.nombre,
        apellidoPaterno: data.apellidoPaterno,
        apellidoMaterno: data.apellidoMaterno || undefined,
        curp: data.curp || undefined,
        telefono: data.telefono || undefined,
      };

      const result = isEdit
        ? await api.actualizarCiudadano(initialData!.id, payload)
        : await api.crearCiudadano(payload);

      toast.success(isEdit ? "Ciudadano actualizado" : "Ciudadano registrado", {
        description: `${result.nombre} ${result.apellidoPaterno} — ID #${result.id}`,
      });

      if (!isEdit) {
        reset();
      }
      onSaved?.(result);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : isEdit
            ? "No se pudo actualizar el ciudadano"
            : "No se pudo registrar al ciudadano";
      toast.error(isEdit ? "Error al actualizar" : "Error al registrar", {
        description: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const serverDown = status !== "online";

  // Si está embebido (dentro de un modal), solo retornamos el form
  if (embedded) {
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="nombre">
            Nombre(s)<span className="ml-1 text-red-500">*</span>
          </Label>
          <Input
            id="nombre"
            placeholder="Juan Pablo"
            autoComplete="given-name"
            className={cn(errors.nombre && "border-red-500 focus-visible:ring-red-500")}
            {...register("nombre")}
          />
          {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="apellidoPaterno">
              Apellido Paterno<span className="ml-1 text-red-500">*</span>
            </Label>
            <Input
              id="apellidoPaterno"
              placeholder="García"
              autoComplete="family-name"
              className={cn(
                errors.apellidoPaterno && "border-red-500 focus-visible:ring-red-500",
              )}
              {...register("apellidoPaterno")}
            />
            {errors.apellidoPaterno && (
              <p className="text-xs text-red-600">{errors.apellidoPaterno.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="apellidoMaterno">Apellido Materno</Label>
            <Input
              id="apellidoMaterno"
              placeholder="López"
              {...register("apellidoMaterno")}
            />
            {errors.apellidoMaterno && (
              <p className="text-xs text-red-600">{errors.apellidoMaterno.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="curp">CURP</Label>
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
              <p className="text-xs text-muted-foreground">18 caracteres (opcional)</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              placeholder="5551234567"
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

        <div className="flex items-center justify-end gap-2 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              Cancelar
            </Button>
          )}
          <Button
            type="submit"
            disabled={submitting || serverDown || (isEdit && !isDirty)}
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
      </form>
    );
  }

  // Modo standalone (con card wrapper)
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="overflow-hidden border-2 shadow-lg">
        <div className="h-2 w-full bg-gradient-to-r from-sky-500 to-blue-600" />

        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg">
            <UserPlus className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Registrar Ciudadano</CardTitle>
          <CardDescription>
            Completa los datos del ciudadano. Solo nombre y apellido paterno son obligatorios.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {serverDown && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <strong>Servidor desconectado.</strong> El formulario no podrá guardar hasta
              que conectes el servidor en{" "}
              <span className="font-semibold">Configuración</span>.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">
                Nombre(s)<span className="ml-1 text-red-500">*</span>
              </Label>
              <Input
                id="nombre"
                placeholder="Juan Pablo"
                autoComplete="given-name"
                className={cn(errors.nombre && "border-red-500 focus-visible:ring-red-500")}
                {...register("nombre")}
              />
              {errors.nombre && (
                <p className="text-xs text-red-600">{errors.nombre.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="apellidoPaterno">
                  Apellido Paterno<span className="ml-1 text-red-500">*</span>
                </Label>
                <Input
                  id="apellidoPaterno"
                  placeholder="García"
                  autoComplete="family-name"
                  className={cn(
                    errors.apellidoPaterno && "border-red-500 focus-visible:ring-red-500",
                  )}
                  {...register("apellidoPaterno")}
                />
                {errors.apellidoPaterno && (
                  <p className="text-xs text-red-600">{errors.apellidoPaterno.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="apellidoMaterno">Apellido Materno</Label>
                <Input
                  id="apellidoMaterno"
                  placeholder="López"
                  {...register("apellidoMaterno")}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="curp">CURP</Label>
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
                  <p className="text-xs text-muted-foreground">18 caracteres (opcional)</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  placeholder="5551234567"
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

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => reset()}
                disabled={submitting}
              >
                <RotateCcw className="h-4 w-4" />
                Limpiar
              </Button>
              <Button
                type="submit"
                disabled={submitting || serverDown}
                className="min-w-[160px] bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Registrar ciudadano
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
