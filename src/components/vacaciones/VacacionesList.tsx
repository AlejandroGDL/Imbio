import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  Palmtree,
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
  TIPOS_PERSONAL_LABEL,
  type Personal,
  type Vacacion,
} from "@/types/api";

interface VacacionesListProps {
  personalId?: number;
  personalList?: Personal[];
  onEdit: (item: Vacacion) => void;
  refreshTrigger?: number;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

function formatFecha(ymd: string): string {
  if (!ymd || ymd.length < 10) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function VacacionesList({
  personalId: personalIdForzado,
  personalList = [],
  onEdit,
  refreshTrigger = 0,
}: VacacionesListProps) {
  const { status } = useServerStatus();
  const [items, setItems] = useState<Vacacion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // --- Filtros ---
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterPersonal, setFilterPersonal] = useState<number | "">(
    personalIdForzado ?? "",
  );
  const [filterDesde, setFilterDesde] = useState("");
  const [filterHasta, setFilterHasta] = useState("");

  // Debounce del texto de búsqueda
  const debouncedSearch = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    setSearch(debouncedSearch);
    setPage(1);
  }, [debouncedSearch]);
  useEffect(() => {
    setPage(1);
  }, [filterPersonal, filterDesde, filterHasta]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const pid = personalIdForzado ?? filterPersonal;
      const res = await api.listarVacaciones({
        q: search || undefined,
        personalId: pid === "" ? undefined : pid,
        desde: filterDesde || undefined,
        hasta: filterHasta || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setItems(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Error al cargar vacaciones",
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
    search,
    filterPersonal,
    filterDesde,
    filterHasta,
    personalIdForzado,
  ]);

  const handleDelete = async (v: Vacacion) => {
    setDeletingId(v.id);
    try {
      await api.eliminarVacacion(v.id);
      const empName = v.personal
        ? `${v.personal.nombre} ${v.personal.apellidos}`
        : `Empleado #${v.personalId}`;
      toast.success("Vacaciones eliminadas", {
        description: `${empName} — ${formatFecha(v.fechaInicio)} al ${formatFecha(v.fechaFin)} (${v.diasSolicitados} días)`,
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

  const limpiarFiltros = () => {
    setSearchInput("");
    setSearch("");
    setFilterPersonal(personalIdForzado ?? "");
    setFilterDesde("");
    setFilterHasta("");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hayFiltros = Boolean(
    search || filterPersonal || filterDesde || filterHasta,
  );

  const countFiltros = useMemo(() => {
    let n = 0;
    if (search) n++;
    if (filterPersonal) n++;
    if (filterDesde) n++;
    if (filterHasta) n++;
    return n;
  }, [search, filterPersonal, filterDesde, filterHasta]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            {personalIdForzado
              ? "Vacaciones del empleado"
              : "Vacaciones registradas"}
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {total} {total === 1 ? "registro" : "registros"}
          </span>
        </CardTitle>
        <CardDescription>
          {status !== "online"
            ? "Conecta el servidor para ver las vacaciones."
            : "Busca por empleado u observaciones. Filtra por rango de fechas."}
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
                placeholder="Buscar por empleado, puesto, observaciones…"
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
            <Palmtree className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>
              {hayFiltros
                ? "No se encontraron vacaciones con esos filtros."
                : personalIdForzado
                  ? "Este empleado no tiene vacaciones registradas."
                  : "Aún no hay vacaciones registradas."}
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
                Usa el botón "Nueva vacación" para registrar la primera.
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
                  <TableHead>Período</TableHead>
                  <TableHead className="w-24">Días</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead className="w-28 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((v) => (
                  <TableRow key={v.id}>
                    {!personalIdForzado && (
                      <TableCell>
                        {v.personal ? (
                          <div className="flex flex-col">
                            <span className="font-medium">
                              <Highlight
                                text={`${v.personal.apellidos} ${v.personal.nombre}`}
                                query={search}
                              />
                            </span>
                            <span className="text-xs text-muted-foreground">
                              <Highlight
                                text={v.personal.puesto}
                                query={search}
                              />
                              {" · "}
                              {TIPOS_PERSONAL_LABEL[v.personal.tipo]}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            #{v.personalId}
                          </span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-sm">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatFecha(v.fechaInicio)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          al {formatFecha(v.fechaFin)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        {v.diasSolicitados} {v.diasSolicitados === 1 ? "día" : "días"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      {v.observaciones ? (
                        <div className="flex items-start gap-1 text-sm text-muted-foreground">
                          <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="truncate" title={v.observaciones}>
                            <Highlight
                              text={v.observaciones}
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
                          onClick={() => onEdit(v)}
                          title="Editar"
                          className="h-8 w-8 text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton
                          item={v}
                          onConfirm={() => handleDelete(v)}
                          loading={deletingId === v.id}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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

interface DeleteButtonProps {
  item: Vacacion;
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
          <AlertDialogTitle className="text-center">¿Eliminar vacaciones?</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Vas a eliminar las vacaciones de{" "}
            <span className="font-semibold text-foreground">
              {formatFecha(item.fechaInicio)} al {formatFecha(item.fechaFin)}
            </span>{" "}
            ({item.diasSolicitados} {item.diasSolicitados === 1 ? "día" : "días"}) de{" "}
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
