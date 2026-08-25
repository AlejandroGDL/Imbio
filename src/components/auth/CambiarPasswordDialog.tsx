/**
 * Dialog para que el usuario autenticado cambie su propia contraseña.
 * Accesible desde el Sidebar (clic en el nombre del usuario).
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, KeyRound, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Contraseña actual requerida"),
    newPassword: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .max(200, "Máximo 200 caracteres"),
    confirmPassword: z.string().min(1, "Confirma la nueva contraseña"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "La nueva contraseña debe ser distinta",
    path: ["newPassword"],
  });

type FormData = z.infer<typeof schema>;

interface CambiarPasswordDialogProps {
  /** Si se pasa, renderiza solo el contenido (sin trigger). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CambiarPasswordDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CambiarPasswordDialogProps) {
  const { logout } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showCon, setShowCon] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) controlledOnOpenChange?.(v);
    else setInternalOpen(v);
    if (!v) reset();
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await api.changePassword(data.currentPassword, data.newPassword);
      toast.success("Contraseña actualizada", {
        description: "Por seguridad, vuelve a iniciar sesión.",
      });
      // Forzar logout para que tenga que usar la nueva contraseña
      await logout();
      setOpen(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "No se pudo cambiar la contraseña";
      toast.error("Error al cambiar contraseña", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const trigger = isControlled ? null : (
    <DialogTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        title="Cambiar mi contraseña"
        className="h-8 w-8 shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <KeyRound className="h-4 w-4" />
      </Button>
    </DialogTrigger>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <KeyRound className="h-6 w-6 text-slate-600" />
          </div>
          <DialogTitle className="text-center">Cambiar contraseña</DialogTitle>
          <DialogDescription className="text-center">
            Por seguridad, después de cambiar la contraseña tendrás que
            iniciar sesión de nuevo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Contraseña actual</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCur ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                className={cn(
                  "pr-9",
                  errors.currentPassword && "border-red-500 focus-visible:ring-red-500",
                )}
                {...register("currentPassword")}
              />
              <button
                type="button"
                onClick={() => setShowCur((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                title={showCur ? "Ocultar" : "Mostrar"}
              >
                {showCur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-xs text-red-600">{errors.currentPassword.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">Nueva contraseña</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                className={cn(
                  "pr-9",
                  errors.newPassword && "border-red-500 focus-visible:ring-red-500",
                )}
                {...register("newPassword")}
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                title={showNew ? "Ocultar" : "Mostrar"}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword ? (
              <p className="text-xs text-red-600">{errors.newPassword.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Mínimo 8 caracteres</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showCon ? "text" : "password"}
                autoComplete="new-password"
                className={cn(
                  "pr-9",
                  errors.confirmPassword && "border-red-500 focus-visible:ring-red-500",
                )}
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowCon((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                title={showCon ? "Ocultar" : "Mostrar"}
              >
                {showCon ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-gradient-to-r from-imbio-green-500 to-imbio-green-700 hover:from-imbio-green-600 hover:to-imbio-green-800"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cambiando…
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  Cambiar contraseña
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
