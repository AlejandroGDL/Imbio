import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  Users,
  ChevronLeft,
  ChevronRight,
  Car,
  Phone,
  Calendar,
  Cake,
  Hash,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { getServerUrl } from "@/lib/config";
import { useDebounce } from "@/hooks/use-debounce";

import { useServerStatus } from "@/hooks/use-server-status";
import { api, ApiError } from "@/lib/api";
import {
  TIPOS_PERSONAL_LABEL,
  type Personal,
  type TipoPersonal,
} from "@/types/api";

interface PersonalListProps {
  onEdit: (item: Personal) => void;
  refreshTrigger?: number;
}

const PAGE_SIZE = 12;

function formatFecha(ymd: string | null): string {
  if (!ymd || ymd.length < 10) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Devuelve la URL absoluta de la imagen del personal, o null. */
function absoluteFotoUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${getServerUrl()}${path}`;
}

export function PersonalList({ onEdit, refreshTrigger = 0 }: PersonalListProps) {
  const { status } = useServerStatus();
  const [items, setItems] = useState<Personal[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterTipo, setFilterTipo] = useState<TipoPersonal | "">("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Debounce del search
  const debouncedSearch = useDebounce(searchInput, 300);
  useEffect(() => {
    if (debouncedSearch !== search) {
      setSearch(debouncedSearch);
      setPage(1);
    }
  }, [debouncedSearch, search]);

  const load = async (
    q = search,
    p = page,
    tipo = filterTipo,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listarPersonal({
        q,
        tipo: tipo || undefined,
        page: p,
        limit: PAGE_SIZE,
      });
      setItems(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Error al cargar personal",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "online") load(search, page, filterTipo);
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, refreshTrigger, filterTipo, search]);

  const handleDelete = async (p: Personal) => {
    setDeletingId(p.id);
    try {
      await api.eliminarPersonal(p.id);
      toast.success("Personal eliminado", {
        description: `${p.nombre} ${p.apellidos} — desactivado`,
      });
      const newTotal = total - 1;
      const lastPage = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      if (page > lastPage) setPage(lastPage);
      else load(search, page, filterTipo);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo eliminar";
      toast.error("Error al eliminar", { description: msg });
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Personal registrado</span>
          <span className="text-sm font-normal text-muted-foreground">
            {total} {total === 1 ? "registro" : "registros"}
          </span>
        </CardTitle>
        <CardDescription>
          {status !== "online"
            ? "Conecta el servidor para ver el personal."
            : "Busca, edita o elimina personal del IMBIO."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        {status === "online" && (
          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex flex-wrap gap-2"
          >
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por nombre, apellido, CURP, puesto…"
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <select
              value={filterTipo}
              onChange={(e) => {
                setFilterTipo(e.target.value as TipoPersonal | "");
                setPage(1);
              }}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos los tipos</option>
              <option value="CONFIANZA">Confianza</option>
              <option value="SINDICALIZADO">Sindicalizado</option>
            </select>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setFilterTipo("");
                setPage(1);
                load("", 1, "");
              }}
              disabled={loading}
              title="Limpiar búsqueda"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </form>
        )}

        {/* Estados */}
        {status === "offline" && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">Servidor desconectado</p>
              <p className="mt-1 text-amber-800">
                Ve a <strong>Configuración</strong> y verifica la URL del servidor backend.
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando...
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && status === "online" && items.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>
              {search || filterTipo
                ? "No se encontraron personas con esos filtros."
                : "Aún no hay personal registrado."}
            </p>
            {!search && !filterTipo && (
              <p className="mt-1 text-sm">
                Usa el botón "Nuevo personal" para registrar el primero.
              </p>
            )}
          </div>
        )}

        {/* Grid de cards */}
        {!loading && !error && items.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((p) => (
                <PersonalCard
                  key={p.id}
                  item={p}
                  onEdit={onEdit}
                  onDelete={handleDelete}
                  isDeleting={deletingId === p.id}
                />
              ))}
            </div>

            {/* Paginación */}
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
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// =================================================================
// Card de personal
// =================================================================
function PersonalCard({
  item,
  onEdit,
  onDelete,
  isDeleting,
}: {
  item: Personal;
  onEdit: (item: Personal) => void;
  onDelete: (item: Personal) => void;
  isDeleting: boolean;
}) {
  const fotoUrl = absoluteFotoUrl(item.foto);
  const initials = `${item.nombre.charAt(0)}${item.apellidos.charAt(0)}`.toUpperCase();
  const isConfianza = item.tipo === "CONFIANZA";

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        "border-slate-200",
      )}
    >
      {/* Header: foto + tipo badge */}
      <div
        className={cn(
          "relative flex h-44 items-center justify-center overflow-hidden sm:h-48",
          isConfianza
            ? "bg-gradient-to-br from-sky-100 to-blue-200"
            : "bg-gradient-to-br from-orange-100 to-amber-200",
        )}
      >
        {fotoUrl ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={fotoUrl}
            alt={`Foto de ${item.nombre} ${item.apellidos}`}
            className="h-full w-full object-cover object-center"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/85 text-4xl font-bold text-sky-700 shadow-inner ring-4 ring-white/50 backdrop-blur-sm sm:h-32 sm:w-32 sm:text-5xl">
            {initials}
          </div>
        )}

        {/* Badge de tipo en la esquina */}
        <span
          className={cn(
            "absolute right-2 top-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm",
            isConfianza
              ? "bg-sky-600 text-white"
              : "bg-orange-600 text-white",
          )}
        >
          {TIPOS_PERSONAL_LABEL[item.tipo]}
        </span>

        {/* ID en la otra esquina */}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-mono text-slate-700 shadow-sm backdrop-blur-sm">
          <Hash className="h-2.5 w-2.5" />#{item.id}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-h-0">
          <h3
            className="truncate text-base font-semibold text-slate-900"
            title={`${item.nombre} ${item.apellidos}`}
          >
            {item.nombre} {item.apellidos}
          </h3>
          <p
            className="truncate text-xs text-muted-foreground"
            title={item.puesto}
          >
            {item.puesto}
          </p>
        </div>

        {/* Datos clave */}
        <div className="space-y-1 text-xs text-slate-600">
          {item.curp && (
            <div
              className="flex items-center gap-1.5 truncate font-mono"
              title={item.curp}
            >
              <Hash className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="truncate">{item.curp}</span>
            </div>
          )}
          {item.telefono && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="font-mono">{item.telefono}</span>
            </div>
          )}
          {item.fechaNacimiento && (
            <div
              className="flex items-center gap-1.5"
              title={`Nac: ${formatFecha(item.fechaNacimiento)}`}
            >
              <Cake className="h-3 w-3 shrink-0 text-slate-400" />
              <span>Edad: {calcularEdad(item.fechaNacimiento)} años</span>
            </div>
          )}
          <div
            className="flex items-center gap-1.5"
            title={`Ingreso: ${formatFecha(item.fechaIngreso)}`}
          >
            <Calendar className="h-3 w-3 shrink-0 text-slate-400" />
            <span>Ingreso: {formatFecha(item.fechaIngreso)}</span>
          </div>
        </div>

        {/* Tags de licencia */}
        {item.tieneLicencia && (
          <span
            className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
            title={
              item.fechaExpiracionLicencia
                ? `Vence: ${formatFecha(item.fechaExpiracionLicencia)}`
                : "Licencia activa"
            }
          >
            <Car className="h-2.5 w-2.5" />
            Licencia{item.fechaExpiracionLicencia ? ` (vence ${formatFecha(item.fechaExpiracionLicencia)})` : ""}
          </span>
        )}
      </div>

      {/* Footer: acciones */}
      <div className="flex items-center justify-end gap-1 border-t bg-slate-50/50 px-2 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(item)}
          title="Editar"
          className="h-7 px-2 text-xs text-sky-600 hover:bg-sky-50 hover:text-sky-700"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
        <DeleteButton
          item={item}
          onConfirm={() => onDelete(item)}
          loading={isDeleting}
        />
      </div>
    </div>
  );
}

/** Calcula la edad a partir de una fecha de nacimiento YYYY-MM-DD. */
function calcularEdad(ymd: string): number {
  if (!ymd || ymd.length < 10) return 0;
  const [, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const [, mm, dd] = ymd.slice(0, 10).split("-").map(Number);
  const hoy = new Date();
  let edad = hoy.getFullYear() - yyyyFromYmd(ymd);
  if (
    hoy.getMonth() + 1 < mm ||
    (hoy.getMonth() + 1 === mm && hoy.getDate() < dd)
  ) {
    edad--;
  }
  return edad;
  // suppress unused-var warning
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void m;
  void d;
}

function yyyyFromYmd(ymd: string): number {
  return Number(ymd.slice(0, 4));
}

// =================================================================
// Botón de eliminar con AlertDialog
// =================================================================
function DeleteButton({
  item,
  onConfirm,
  loading,
}: {
  item: Personal;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
          title="Eliminar"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Trash2 className="h-6 w-6 text-red-600" />
          </div>
          <AlertDialogTitle className="text-center">¿Eliminar personal?</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Vas a eliminar a{" "}
            <span className="font-semibold text-foreground">
              {item.nombre} {item.apellidos}
            </span>{" "}
            ({item.puesto}). El registro se desactivará (no se borra de la base de
            datos) y no aparecerá en los listados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            Sí, eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
