import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  Coins,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
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
  type DiaEconomico,
  type Personal,
} from "@/types/api";

interface DiasEconomicosListProps {
  personalId?: number;
  personalList?: Personal[];
  onEdit: (item: DiaEconomico) => void;
  refreshTrigger?: number;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const ANIOS_RAPIDOS = (() => {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1];
})();

/** Convierte "2026-08-19T00:00:00.000Z" → "19/08/2026" */
function formatFechaCorta(iso: string): string {
  if (!iso || iso.length < 10) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Convierte array de fechas ISO a formato compacto:
 *  - 1 fecha: "19/08/2026"
 *  - 2 fechas: "19/08/2026 y 25/08/2026"
 *  - 3+: "5 días: 19/08, 25/08, 30/08, 15/09, 20/09"
 */
function formatFechasCorto(fechas: string[]): string {
  const isoDates = fechas
    .map((f) => (f.length >= 10 ? f.slice(0, 10) : f))
    .sort();
  if (isoDates.length === 0) return "";
  const fmt = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  };
  if (isoDates.length === 1) return formatFechaCorta(isoDates[0]);
  if (isoDates.length === 2)
    return `${formatFechaCorta(isoDates[0])} y ${formatFechaCorta(isoDates[1])}`;
  return `${isoDates.length} días: ${isoDates.map(fmt).join(", ")}`;
}

export function DiasEconomicosList({
  personalId: personalIdForzado,
  personalList = [],
  onEdit,
  refreshTrigger = 0,
}: DiasEconomicosListProps) {
  const { status } = useServerStatus();
  const [items, setItems] = useState<DiaEconomico[]>([]);
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
  const [filterAnio, setFilterAnio] = useState<string>("");

  // Debounce del texto de búsqueda
  const debouncedSearch = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    setSearch(debouncedSearch);
    setPage(1);
  }, [debouncedSearch]);
  useEffect(() => {
    setPage(1);
  }, [filterPersonal, filterAnio]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const pid = personalIdForzado ?? filterPersonal;
      const anioNum = filterAnio === "" ? undefined : Number(filterAnio);
      const res = await api.listarDiasEconomicos({
        q: search || undefined,
        personalId: pid === "" ? undefined : pid,
        anio: anioNum,
        page,
        limit: PAGE_SIZE,
      });
      setItems(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Error al cargar días económicos",
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
    filterAnio,
    personalIdForzado,
  ]);

  const handleDelete = async (d: DiaEconomico) => {
    setDeletingId(d.id);
    try {
      await api.eliminarDiaEconomico(d.id);
      const empName = d.personal
        ? `${d.personal.nombre} ${d.personal.apellidos}`
        : `Empleado #${d.personalId}`;
      toast.success("Días económicos eliminados", {
        description: `${empName} — Año ${d.anio} (${d.diasSolicitados} días)`,
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
    setFilterAnio("");
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hayFiltros = Boolean(
    search || filterPersonal || filterAnio !== "",
  );

  const countFiltros = useMemo(() => {
    let n = 0;
    if (search) n++;
    if (filterPersonal) n++;
    if (filterAnio !== "") n++;
    return n;
  }, [search, filterPersonal, filterAnio]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            {personalIdForzado
              ? "Días económicos del empleado"
              : "Días económicos registrados"}
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {total} {total === 1 ? "registro" : "registros"}
          </span>
        </CardTitle>
        <CardDescription>
          {status !== "online"
            ? "Conecta el servidor para ver los días económicos."
            : "Exclusivo para empleados SINDICALIZADOS. Busca por empleado, año u observaciones."}
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

            <div className="flex min-w-[140px] flex-col gap-1">
              <label
                htmlFor="filter-anio"
                className="text-xs font-medium text-muted-foreground"
              >
                Año
              </label>
              <select
                id="filter-anio"
                value={filterAnio}
                onChange={(e) => setFilterAnio(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Todos</option>
                {ANIOS_RAPIDOS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
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
            <Coins className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>
              {hayFiltros
                ? "No se encontraron días económicos con esos filtros."
                : personalIdForzado
                  ? "Este empleado no tiene días económicos registrados."
                  : "Aún no hay días económicos registrados."}
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
                Usa el botón "Nuevo día económico" para registrar el primero.
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
                  <TableHead className="w-20">Año</TableHead>
                  <TableHead className="w-20">Cant.</TableHead>
                  <TableHead>Fechas específicas</TableHead>
                  <TableHead>Observaciones</TableHead>
                  <TableHead className="w-28 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((d) => {
                  const tieneFechas = d.fechas && d.fechas.length > 0;
                  return (
                    <TableRow key={d.id}>
                      {!personalIdForzado && (
                        <TableCell>
                          {d.personal ? (
                            <div className="flex flex-col">
                              <span className="font-medium">
                                <Highlight
                                  text={`${d.personal.apellidos} ${d.personal.nombre}`}
                                  query={search}
                                />
                              </span>
                              <span className="text-xs text-muted-foreground">
                                <Highlight
                                  text={d.personal.puesto}
                                  query={search}
                                />
                                {" · "}
                                {TIPOS_PERSONAL_LABEL[d.personal.tipo]}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              #{d.personalId}
                            </span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm font-semibold">
                          <CalendarDays className="h-3 w-3 text-muted-foreground" />
                          {d.anio}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          {d.diasSolicitados} {d.diasSolicitados === 1 ? "día" : "días"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[340px]">
                        {tieneFechas ? (
                          <div className="flex items-start gap-1.5 text-sm">
                            <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            <span
                              className="text-foreground"
                              title={d.fechas.map(formatFechaCorta).join("\n")}
                            >
                              {formatFechasCorto(d.fechas)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">
                            Sin fechas específicas (registro antiguo)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        {d.observaciones ? (
                          <div className="flex items-start gap-1 text-sm text-muted-foreground">
                            <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
                            <span className="truncate" title={d.observaciones}>
                              <Highlight
                                text={d.observaciones}
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
                            onClick={() => onEdit(d)}
                            title="Editar"
                            className="h-8 w-8 text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <DeleteButton
                            item={d}
                            onConfirm={() => handleDelete(d)}
                            loading={deletingId === d.id}
                          />
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
  item: DiaEconomico;
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
          <AlertDialogTitle className="text-center">¿Eliminar días económicos?</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Vas a eliminar el registro de{" "}
            <span className="font-semibold text-foreground">
              {item.diasSolicitados} {item.diasSolicitados === 1 ? "día" : "días"}
            </span>{" "}
            del año{" "}
            <span className="font-semibold text-foreground">{item.anio}</span> de{" "}
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
