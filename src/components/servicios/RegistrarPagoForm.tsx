import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { api, ApiError } from "@/lib/api";

const pagoSchema = z.object({
  folioPago: z.string().trim().min(1, "El folio de pago es obligatorio"),
});

type PagoForm = z.infer<typeof pagoSchema>;

export function RegistrarPagoForm({
  solicitudId,
  precioSugerido,
  onSaved,
  onCancel,
}: {
  solicitudId: number;
  precioSugerido: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PagoForm>({
    resolver: zodResolver(pagoSchema),
    defaultValues: { folioPago: "" },
  });

  const onSubmit = async (data: PagoForm) => {
    setSubmitting(true);
    try {
      await api.registrarPago(solicitudId, {
        folioPago: data.folioPago,
        monto: precioSugerido,
        fechaPago: new Date().toISOString().slice(0, 10),
      });
      toast.success("Pago registrado", { description: "La solicitud pasó a PAGADA" });
      onSaved();
    } catch (err) {
      toast.error("Error al registrar pago", {
        description: err instanceof ApiError ? err.message : "No se pudo registrar",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="folioPago">
          Folio de pago<span className="ml-1 text-red-500">*</span>
        </Label>
        <Input
          id="folioPago"
          placeholder="Ej: 123456789"
          className="font-mono"
          autoFocus
          {...register("folioPago")}
        />
        {errors.folioPago && (
          <p className="text-xs text-red-600">{errors.folioPago.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Folio que el ciudadano trae de la ventanilla de pagos
        </p>
      </div>

      {precioSugerido > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-amber-900">Monto a registrar</span>
            <span className="text-lg font-bold text-amber-900">
              ${precioSugerido.toLocaleString("es-MX", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <p className="mt-1 text-xs text-amber-700">
            Se toma automáticamente del precio de la solicitud
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            "Registrar pago"
          )}
        </Button>
      </div>
    </form>
  );
}
