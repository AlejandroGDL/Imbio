/**
 * Gestión de usuarios (solo ADMIN).
 *
 * CRUD completo de usuarios con:
 * - Listar (con búsqueda + filtro por rol)
 * - Crear (con username, password, nombre, email, rol)
 * - Editar (datos + reset password)
 * - Desactivar (borrado lógico)
 *
 * Accesible desde la página de Configuración (solo visible para ADMIN).
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
  ShieldAlert,
  UserCheck,
  UserX,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { api, ApiError, type AuthUser } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// =================================================================
// Validación
// =================================================================
const createSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(50, "Máximo 50")
    .regex(/^[a-zA-Z0-9._-]+$/, "Solo letras, números, . _ -"),
  nombre: z.string().trim().min(1, "Requerido").max(120),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(120)
    .optional()
    .or(z.literal("")),
  rol: z.enum(["ADMIN", "OPERADOR", "TECNICO"]),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(200, "Máximo 200"),
});

const editSchema = z.object({
  nombre: z.string().trim().min(1, "Requerido").max(120),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(120)
    .optional()
    .or(z.literal("")),
  rol: z.enum(["ADMIN", "OPERADOR", "TECNICO"]),
  activo: z.boolean(),
  // Opcional: solo si se quiere cambiar
  password: z
    .string()
    .max(200)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || v.length >= 8,
      "Si la pones, mínimo 8 caracteres",
    ),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm = z.infer<typeof editSchema>;

const PAGE_SIZE = 20;

// =================================================================
// Componente principal
// =================================================================
export function UsuariosAdmin() {
  const { user: currentUser } = useAuth();
  const [items, setItems] = useState<AuthUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterRol, setFilterRol] = useState<string>("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AuthUser | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listarUsuarios({
        q: search || undefined,
        rol: (filterRol || undefined) as "ADMIN" | "OPERADOR" | "TECNICO" | undefined,
        page,
        limit: PAGE_SIZE,
      });
      setItems(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterRol]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-imbio-green-600" />
              Usuarios del sistema
            </CardTitle>
            <CardDescription>
              Solo los administradores pueden crear y gestionar usuarios.
              Sesión actual: <span className="font-semibold">@{currentUser?.username}</span>
            </CardDescription>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-gradient-to-r from-imbio-green-500 to-imbio-green-700 hover:from-imbio-green-600 hover:to-imbio-green-800"
          >
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput);
            void load();
          }}
          className="flex flex-wrap gap-2"
        >
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por nombre, usuario, email..."
              className="pl-9"
            />
          </div>
          <select
            value={filterRol}
            onChange={(e) => {
              setFilterRol(e.target.value);
              setPage(1);
            }}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Todos los roles</option>
            <option value="ADMIN">Administrador</option>
            <option value="OPERADOR">Operador</option>
            <option value="TECNICO">Técnico</option>
          </select>
          <Button type="submit" variant="outline" disabled={loading}>
            Buscar
          </Button>
        </form>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando…
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>No hay usuarios con esos filtros.</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Último acceso</TableHead>
                  <TableHead className="w-28 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((u) => {
                  const isMe = u.id === currentUser?.id;
                  return (
                    <TableRow key={u.id} className={cn(!u.activo && "opacity-60")}>
                      <TableCell className="font-mono text-xs">@{u.username}</TableCell>
                      <TableCell className="font-medium">{u.nombre}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.email || "—"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            u.rol === "ADMIN"
                              ? "bg-purple-100 text-purple-700"
                              : u.rol === "TECNICO"
                                ? "bg-sky-100 text-sky-700"
                                : "bg-slate-100 text-slate-700",
                          )}
                        >
                          {u.rol}
                        </span>
                      </TableCell>
                      <TableCell>
                        {u.activo ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <UserCheck className="h-2.5 w-2.5" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            <UserX className="h-2.5 w-2.5" />
                            Inactivo
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.ultimoAcceso
                          ? new Date(u.ultimoAcceso).toLocaleString("es-MX", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Nunca"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingUser(u)}
                            title="Editar"
                            className="h-8 w-8 text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!isMe && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingUser(u)}
                              title="Desactivar"
                              className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      <CrearUsuarioDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          setCreateOpen(false);
          void load();
        }}
      />

      <EditarUsuarioDialog
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSaved={() => {
          setEditingUser(null);
          void load();
        }}
      />

      <DesactivarUsuarioDialog
        user={deletingUser}
        onClose={() => setDeletingUser(null)}
        onDeleted={() => {
          setDeletingUser(null);
          void load();
        }}
      />
    </Card>
  );
}

// =================================================================
// Dialog: Crear usuario
// =================================================================
function CrearUsuarioDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      username: "",
      nombre: "",
      email: "",
      rol: "OPERADOR",
      password: "",
    },
  });

  const onSubmit = async (data: CreateForm) => {
    setSubmitting(true);
    try {
      await api.crearUsuario({
        username: data.username,
        nombre: data.nombre,
        email: data.email || undefined,
        rol: data.rol,
        password: data.password,
      });
      toast.success("Usuario creado", { description: `@${data.username}` });
      reset();
      onCreated();
    } catch (err) {
      toast.error("Error al crear usuario", {
        description: err instanceof ApiError ? err.message : "Error desconocido",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
          <DialogDescription>
            Crea una cuenta para un miembro del equipo. El usuario podrá
            cambiar su contraseña después de iniciar sesión.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cu-username">Usuario</Label>
            <Input
              id="cu-username"
              autoFocus
              placeholder="jperez"
              className={cn("font-mono", errors.username && "border-red-500 focus-visible:ring-red-500")}
              {...register("username")}
            />
            {errors.username && (
              <p className="text-xs text-red-600">{errors.username.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-nombre">Nombre completo</Label>
            <Input
              id="cu-nombre"
              placeholder="Juan Pérez López"
              className={cn(errors.nombre && "border-red-500 focus-visible:ring-red-500")}
              {...register("nombre")}
            />
            {errors.nombre && (
              <p className="text-xs text-red-600">{errors.nombre.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-email">Email (opcional)</Label>
            <Input
              id="cu-email"
              type="email"
              placeholder="jperez@imbio.gob.mx"
              className={cn(errors.email && "border-red-500 focus-visible:ring-red-500")}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-rol">Rol</Label>
            <select
              id="cu-rol"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              {...register("rol")}
            >
              <option value="OPERADOR">Operador</option>
              <option value="TECNICO">Técnico</option>
              <option value="ADMIN">Administrador</option>
            </select>
            <p className="text-xs text-muted-foreground">
              ADMIN: gestión completa. TECNICO: firma autorizaciones. OPERADOR: captura.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-password">Contraseña inicial</Label>
            <div className="relative">
              <Input
                id="cu-password"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                className={cn("pr-9", errors.password && "border-red-500 focus-visible:ring-red-500")}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                title={showPassword ? "Ocultar" : "Mostrar"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>
          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
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
                  Creando…
                </>
              ) : (
                "Crear usuario"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =================================================================
// Dialog: Editar usuario
// =================================================================
function EditarUsuarioDialog({
  user,
  onClose,
  onSaved,
}: {
  user: AuthUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user: currentUser } = useAuth();
  const isMe = user?.id === currentUser?.id;
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      nombre: "",
      email: "",
      rol: "OPERADOR",
      activo: true,
      password: "",
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        nombre: user.nombre,
        email: user.email ?? "",
        rol: user.rol,
        activo: user.activo ?? true,
        password: "",
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: EditForm) => {
    if (!user) return;
    setSubmitting(true);
    try {
      const payload: {
        nombre?: string;
        email?: string;
        rol?: "ADMIN" | "OPERADOR" | "TECNICO";
        activo?: boolean;
        password?: string;
      } = {
        nombre: data.nombre,
        email: data.email || undefined,
        rol: data.rol,
        activo: data.activo,
      };
      if (data.password && data.password.length >= 8) {
        payload.password = data.password;
      }
      await api.actualizarUsuario(user.id, payload);
      toast.success("Usuario actualizado", { description: `@${user.username}` });
      onSaved();
    } catch (err) {
      toast.error("Error al actualizar", {
        description: err instanceof ApiError ? err.message : "Error desconocido",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const activo = watch("activo");

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>
            {user && (
              <>
                Editando a <span className="font-mono font-semibold">@{user.username}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="eu-nombre">Nombre completo</Label>
            <Input
              id="eu-nombre"
              className={cn(errors.nombre && "border-red-500 focus-visible:ring-red-500")}
              {...register("nombre")}
            />
            {errors.nombre && (
              <p className="text-xs text-red-600">{errors.nombre.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eu-email">Email (opcional)</Label>
            <Input
              id="eu-email"
              type="email"
              className={cn(errors.email && "border-red-500 focus-visible:ring-red-500")}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eu-rol">Rol</Label>
            <select
              id="eu-rol"
              disabled={isMe}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
              {...register("rol")}
            >
              <option value="OPERADOR">Operador</option>
              <option value="TECNICO">Técnico</option>
              <option value="ADMIN">Administrador</option>
            </select>
            {isMe && (
              <p className="text-xs text-muted-foreground">
                No puedes cambiar tu propio rol.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="eu-activo"
              type="checkbox"
              checked={activo}
              disabled={isMe}
              onChange={(e) => setValue("activo", e.target.checked, { shouldValidate: true })}
              className="h-4 w-4 rounded border-slate-300 text-imbio-green-600 focus:ring-imbio-green-500 disabled:opacity-60"
            />
            <Label htmlFor="eu-activo" className="cursor-pointer">
              Usuario activo
            </Label>
            {isMe && (
              <span className="text-xs text-muted-foreground">
                (no puedes desactivarte)
              </span>
            )}
          </div>

          <div className="space-y-1.5 border-t pt-3">
            <Label htmlFor="eu-password" className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              Resetear contraseña (opcional)
            </Label>
            <div className="relative">
              <Input
                id="eu-password"
                type={showPassword ? "text" : "password"}
                placeholder="Dejar vacío para no cambiar"
                className={cn("pr-9", errors.password && "border-red-500 focus-visible:ring-red-500")}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                title={showPassword ? "Ocultar" : "Mostrar"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-600">{errors.password.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Solo se actualizará si escribes algo (mínimo 8 caracteres).
            </p>
          </div>

          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
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
                  Guardando…
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// =================================================================
// Dialog: Desactivar
// =================================================================
function DesactivarUsuarioDialog({
  user,
  onClose,
  onDeleted,
}: {
  user: AuthUser | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      await api.eliminarUsuario(user.id);
      toast.success("Usuario desactivado", { description: `@${user.username}` });
      onDeleted();
    } catch (err) {
      toast.error("Error al desactivar", {
        description: err instanceof ApiError ? err.message : "Error desconocido",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Trash2 className="h-6 w-6 text-red-600" />
          </div>
          <AlertDialogTitle className="text-center">¿Desactivar usuario?</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Vas a desactivar a{" "}
            <span className="font-semibold text-foreground">{user?.nombre}</span>{" "}
            (<span className="font-mono">@{user?.username}</span>). No podrá iniciar
            sesión. Podrás reactivarlo después editando el usuario.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={submitting}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Desactivando…
              </>
            ) : (
              "Sí, desactivar"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
