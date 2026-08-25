import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Calendar,
  StickyNote,
  X,
  User as UserIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Highlight } from "@/components/ui/highlight";
import { cn } from "@/lib/utils";

import { useServerStatus } from "@/hooks/use-server-status";
import { useDebounce } from "@/hooks/use-debounce";
import { api, ApiError } from "@/lib/api";
import {
  TIPOS_INCIDENCIA_LABEL,
  TIPOS_PERSONAL_LABEL,
  type Incidencia,
  type Personal,
  type TipoIncidencia,
} from "@/types/api";

interface IncidenciasListProps {
  /** Si se pasa, filtra la lista a un solo empleado. */
  personalId?: number;
  /** Personal activo para popular el filtro por empleado. */
  personalList?: Personal[];
  onEdit: (item: Incidencia) => void;
  refreshTrigger?: number;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

function formatFecha(ymd: string): string {
  if (!ymd || ymd.length < 10) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const TIPO_STYLES: Record<TipoIncidencia, { classes: string }> = {
  FALTA: { classes: "bg-red-100 text-red-800 border-red-200" },
  JUSTIFICANTE: { classes: "bg-sky-100 text-sky-800 border-sky-200" },
  RETARDO: { classes: "bg-amber-100 text-amber-800 border-amber-200" },
  PERMISO_SIN_GOCE_SUELDO: {
    classes: "bg-slate-100 text-slate-800 border-slate-200",
  },
  PERMISO_CON_GOCE_SUELDO: {
    classes: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
};

function hayFiltrosActivos(
  q: string,
  personalId: number | "",
  tipo: TipoIncidencia | "",
  desde: string,
  hasta: string,
): boolean {
  return Boolean(q || personalId || tipo || desde || hasta);
}

export function IncidenciasList({
  personalId: personalIdForzado,
  personalList = [],
  onEdit,
  refreshTrigger = 0,
}: IncidenciasListProps) {
  const { status } = useServerStatus();
  const [items, setItems] = useState<Incidencia[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Estado de filtros ---
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterPersonal, setFilterPersonal] = useState<number | "">(
    personalIdForzado ?? "",
  );
  const [filterTipo, setFilterTipo] = useState<TipoIncidencia | "">("");
  const [filterDesde, setFilterDesde] = useState("");
  const [filterHasta, setFilterHasta] = useState("");

  // Debounce del texto de búsqueda (escritura → query)
  const debouncedSearch = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    setSearch(debouncedSearch);
    setPage(1);
  }, [debouncedSearch]);
  // Cuando cambia cualquier otro filtro, también volvemos a página 1
  useEffect(() => {
    setPage(1);
  }, [filterPersonal, filterTipo, filterDesde, filterHasta]);

  const queryParaBackend = search;
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const pid =
        (personalIdForzado ?? filterPersonal) || undefined || undefined;
      const res = await api.listarIncidencias({
        q: queryParaBackend || undefined,
        personalId: pid,
        tipo: filterTipo || undefined,
        desde: filterDesde || undefined,
        hasta: filterHasta || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setItems(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Error al cargar incidencias",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "online") load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    status,
    page,
    refreshTrigger,
    queryParaBackend,
    filterPersonal,
    filterTipo,
    filterDesde,
    filterHasta,
    personalIdForzado,
  ]);

  const handleDelete = async (i: Incidencia) => {
    setDeletingId(i.id);
    try {
      await api.eliminarIncidencia(i.id);
      const empName = i.personal
        ? `${i.personal.nombre} ${i.personal.apellidos}`
        : `Empleado #${i.personalId}`;
      toast.success("Incidencia eliminada", {
        description: `${TIPOS_INCIDENCIA_LABEL[i.tipo]} — ${empName} — ${formatFecha(i.fecha)}`,
      });
      const newTotal = total - 1;
      const lastPage = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      if (page > lastPage) setPage(lastPage);
      else load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo eliminar";
      toast.error("Error al eliminar", { description: msg });
    } finally {
      setDeletingId(null);
    }
  };

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const limpiarFiltros = () => {
    setSearchInput("");
    setSearch("");
    setFilterPersonal(personalIdForzado ?? "");
    setFilterTipo("");
    setFilterDesde("");
    setFilterHasta("");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hayFiltros = hayFiltrosActivos(
    search,
    filterPersonal,
    filterTipo,
    filterDesde,
    filterHasta,
  );

  // Conteo de filtros activos (para el badge)
  const countFiltros = useMemo(() => {
    let n = 0;
    if (search) n++;
    if (filterPersonal) n++;
    if (filterTipo) n++;
    if (filterDesde) n++;
    if (filterHasta) n++;
    return n;
  }, [search, filterPersonal, filterTipo, filterDesde, filterHasta]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            {personalIdForzado
              ? "Incidencias del empleado"
              : "Incidencias registradas"}
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {total} {total === 1 ? "registro" : "registros"}
          </span>
        </CardTitle>
        <CardDescription>
          {status !== "online"
            ? "Conecta el servidor para ver las incidencias."
            : "Busca por empleado, descripción o puesto. Filtra por tipo o fecha."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Buscador principal */}
        {status === "online" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
              setPage(1);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por empleado, descripción, puesto…"
                className="pl-9 pr-9"
                autoComplete="off"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-slate-200 hover:text-foreground"
                  title="Limpiar texto"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={loading || !searchInput}
              title="Buscar ahora"
            >
              <Search className="h-4 w-4" />
              Buscar
            </Button>
          </form>
        )}

        {/* Filtros secundarios */}
        {status === "online" && (
          <div className="flex flex-wrap items-end gap-2 rounded-md bg-slate-50 p-3">
            {/* Empleado */}
            {!personalIdForzado && personalList.length > 0 && (
              <div className="flex min-w-[180px] flex-col gap-1">
                <label
                  htmlFor="filter-personal"
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground"
                >
                  <UserIcon className="h-3 w-3" />
                  Empleado
                </label>
                <select
                  id="filter-personal"
                  value={filterPersonal}
                  onChange={(e) =>
                    setFilterPersonal(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="flex h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Todos</option>
                  {personalList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.apellidos} {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tipo */}
            <div className="flex min-w-[180px] flex-col gap-1">
              <label
                htmlFor="filter-tipo"
                className="text-xs font-medium text-muted-foreground"
              >
                Tipo
              </label>
              <select
                id="filter-tipo"
                value={filterTipo}
                onChange={(e) =>
                  setFilterTipo(e.target.value as TipoIncidencia | "")
                }
                className="flex h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Todos los tipos</option>
                {(
                  Object.keys(TIPOS_INCIDENCIA_LABEL) as Array<
                    keyof typeof TIPOS_INCIDENCIA_LABEL
                  >
                ).map((k) => (
                  <option key={k} value={k}>
                    {TIPOS_INCIDENCIA_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>

            {/* Desde */}
            <div className="flex min-w-[150px] flex-col gap-1">
              <label
                htmlFor="filter-desde"
                className="text-xs font-medium text-muted-foreground"
              >
                Desde
              </label>
              <Input
                id="filter-desde"
                type="date"
                value={filterDesde}
                onChange={(e) => setFilterDesde(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Hasta */}
            <div className="flex min-w-[150px] flex-col gap-1">
              <label
                htmlFor="filter-hasta"
                className="text-xs font-medium text-muted-foreground"
              >
                Hasta
              </label>
              <Input
                id="filter-hasta"
                type="date"
                value={filterHasta}
                onChange={(e) => setFilterHasta(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Limpiar */}
            <Button
              type="button"
              variant="ghost"
              onClick={limpiarFiltros}
              disabled={loading || !hayFiltros}
              title="Limpiar todos los filtros"
              className="self-end"
            >
              <RefreshCw
                className={cn("h-4 w-4", loading && "animate-spin")}
              />
              Limpiar{countFiltros > 0 ? ` (${countFiltros})` : ""}
            </Button>
          </div>
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
            Buscando…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && status === "online" && items.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <CalendarClock className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>
              {hayFiltros
                ? "No se encontraron incidencias con esos filtros."
                : personalIdForzado
                  ? "Este empleado no tiene incidencias registradas."
                  : "Aún no hay incidencias registradas."}
            </p>
            {hayFiltros && (
              <Button
                type="button"
                variant="link"
                onClick={limpiarFiltros}
                className="mt-2"
              >
                Limpiar filtros
              </Button>
            )}
            {!hayFiltros && !personalIdForzado && (
              <p className="mt-1 text-sm">
                Usa el botón "Nueva incidencia" para registrar la primera.
              </p>
            )}
          </div>
        )}

        {/* Tabla */}
        {!loading && !error && items.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  {!personalIdForzado && <TableHead>Empleado</TableHead>}
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-28 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => {
                  const tipoStyle = TIPO_STYLES[i.tipo];
                  return (
                    <TableRow key={i.id}>
                      {!personalIdForzado && (
                        <TableCell>
                          {i.personal ? (
                            <div className="flex flex-col">
                              <span className="font-medium">
                                <Highlight
                                  text={`${i.personal.apellidos} ${i.personal.nombre}`}
                                  query={search}
                                />
                              </span>
                              <span className="text-xs text-muted-foreground">
                                <Highlight
                                  text={i.personal.puesto}
                                  query={search}
                                />
                                {" · "}
                                {TIPOS_PERSONAL_LABEL[i.personal.tipo]}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              #{i.personalId}
                            </span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            tipoStyle.classes,
                          )}
                        >
                          {TIPOS_INCIDENCIA_LABEL[i.tipo]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatFecha(i.fecha)}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        {i.descripcion ? (
                          <div className="flex items-start gap-1 text-sm text-muted-foreground">
                            <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
                            <span className="truncate" title={i.descripcion}>
                              <Highlight
                                text={i.descripcion}
                                query={search}
                              />
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(i)}
                            title="Editar"
                            className="h-8 w-8 text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <DeleteButton
                            item={i}
                            onConfirm={() => handleDelete(i)}
                            loading={deletingId === i.id}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

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
// Botón de eliminar
// =================================================================
interface DeleteButtonProps {
  item: Incidencia;
  onConfirm: () => void;
  loading: boolean;
}

function DeleteButton({ item, onConfirm, loading }: DeleteButtonProps) {
  const empName = item.personal
    ? `${item.personal.nombre} ${item.personal.apellidos}`
    : `Empleado #${item.personalId}`;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Eliminar"
          disabled={loading}
          className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Trash2 className="h-6 w-6 text-red-600" />
          </div>
          <AlertDialogTitle className="text-center">¿Eliminar incidencia?</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Vas a eliminar la{" "}
            <span className="font-semibold text-foreground">
              {TIPOS_INCIDENCIA_LABEL[item.tipo].toLowerCase()}
            </span>{" "}
            del{" "}
            <span className="font-semibold text-foreground">
              {formatFecha(item.fecha)}
            </span>{" "}
            de{" "}
            <span className="font-semibold text-foreground">{empName}</span>.
            El registro se desactivará (no se borra de la base de datos).
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
