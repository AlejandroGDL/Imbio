import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Package,
  CheckCircle2,
  StickyNote,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

import { useServerStatus } from "@/hooks/use-server-status";
import { api, ApiError } from "@/lib/api";
import type { Requisicion, Unidad } from "@/types/api";
import { UNIDADES_LABEL } from "@/types/api";
import { RequisicionStatusDropdown } from "./RequisicionStatusDropdown";

interface RequisicionesListProps {
  onEdit: (item: Requisicion) => void;
  refreshTrigger?: number;
}

const PAGE_SIZE = 20;

function formatFecha(ymd: string): string {
  if (!ymd || ymd.length < 10) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function formatCantidad(cantidad: string, unidad: Unidad): string {
  const n = parseFloat(cantidad);
  if (!Number.isFinite(n)) return "—";
  // Sin decimales si es entero
  const formatted = Number.isInteger(n) ? n.toString() : n.toFixed(2);
  return `${formatted} ${UNIDADES_LABEL[unidad]}`;
}

export function RequisicionesList({
  onEdit,
  refreshTrigger = 0,
}: RequisicionesListProps) {
  const { status } = useServerStatus();
  const [items, setItems] = useState<Requisicion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterSurtido, setFilterSurtido] = useState<"" | "true" | "false">("");
  const [filterConsumible, setFilterConsumible] = useState<"" | "true" | "false">("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async (
    q = search,
    p = page,
    surtido = filterSurtido,
    consumible = filterConsumible,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listarRequisiciones({
        q,
        surtido: surtido ? surtido === "true" : undefined,
        esConsumible: consumible ? consumible === "true" : undefined,
        page: p,
        limit: PAGE_SIZE,
      });
      setItems(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Error al cargar requisiciones",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "online")
      load(search, page, filterSurtido, filterConsumible);
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, refreshTrigger, filterSurtido, filterConsumible]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
    load(searchInput, 1, filterSurtido, filterConsumible);
  };

  const handleDelete = async (r: Requisicion) => {
    setDeletingId(r.id);
    try {
      await api.eliminarRequisicion(r.id);
      toast.success("Requisición eliminada", {
        description: `#${r.numero} — ${r.concepto}`,
      });
      const newTotal = total - 1;
      const lastPage = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      if (page > lastPage) setPage(lastPage);
      else load(search, page, filterSurtido, filterConsumible);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo eliminar";
      toast.error("Error al eliminar", { description: msg });
    } finally {
      setDeletingId(null);
    }
  };

  /** Actualiza un item en el state local cuando cambia su status inline */
  const handleStatusUpdated = (updated: Requisicion) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilterCount = [filterSurtido, filterConsumible].filter(
    (f) => f !== "",
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Requisiciones registradas</span>
          <span className="text-sm font-normal text-muted-foreground">
            {total} {total === 1 ? "registro" : "registros"}
          </span>
        </CardTitle>
        <CardDescription>
          {status !== "online"
            ? "Conecta el servidor para ver las requisiciones."
            : "Busca, edita o elimina requisiciones. Marca 'Es Consumible' al surtir para que se cree automáticamente en el catálogo."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        {status === "online" && (
          <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por N°, concepto, partida..."
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="outline" disabled={loading}>
              Buscar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setFilterSurtido("");
                setFilterConsumible("");
                setPage(1);
                load("", 1, "", "");
              }}
              disabled={loading}
              title="Limpiar búsqueda"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </form>
        )}

        {/* Sub-banda de filtros de estado */}
        {status === "online" && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-cyan-100 bg-cyan-50/30 px-3 py-2 text-xs">
            <span className="font-semibold text-cyan-900">Filtros:</span>

            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-cyan-600" />
              <span className="text-muted-foreground">Surtido:</span>
              <select
                value={filterSurtido}
                onChange={(e) => {
                  setFilterSurtido(e.target.value as "" | "true" | "false");
                  setPage(1);
                }}
                className="h-7 rounded-md border border-input bg-white px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Todos</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-cyan-600" />
              <span className="text-muted-foreground">Es consumible:</span>
              <select
                value={filterConsumible}
                onChange={(e) => {
                  setFilterConsumible(e.target.value as "" | "true" | "false");
                  setPage(1);
                }}
                className="h-7 rounded-md border border-input bg-white px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Todos</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFilterSurtido("");
                  setFilterConsumible("");
                  setPage(1);
                  load(search, 1, "", "");
                }}
                className="ml-auto text-xs font-medium text-cyan-700 underline-offset-2 hover:underline"
              >
                Limpiar ({activeFilterCount})
              </button>
            )}
          </div>
        )}

        {status === "offline" && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">Servidor desconectado</p>
              <p className="mt-1 text-amber-800">
                Ve a <strong>Configuración</strong> y verifica la URL del servidor
                backend.
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
            <ClipboardList className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>
              {search || filterSurtido || filterConsumible
                ? "No se encontraron requisiciones con esos filtros."
                : "Aún no hay requisiciones registradas."}
            </p>
            {!search && !filterSurtido && !filterConsumible && (
              <p className="mt-1 text-sm">
                Usa el botón "Nueva requisición" para registrar la primera.
              </p>
            )}
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">N° Requisición</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="w-36">Cantidad</TableHead>
                  <TableHead>Partida</TableHead>
                  <TableHead className="w-28">F. Solicitud</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-28 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {r.numero}
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">
                          {r.concepto}
                        </span>
                        {r.observaciones && (
                          <span
                            className="flex items-center gap-1 truncate text-xs text-muted-foreground"
                            title={r.observaciones}
                          >
                            <StickyNote className="h-2.5 w-2.5 shrink-0" />
                            {r.observaciones}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatCantidad(r.cantidad, r.unidad)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.partida}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatFecha(r.fechaSolicitud)}
                    </TableCell>
                    <TableCell>
                      <RequisicionStatusDropdown
                        item={r}
                        onUpdated={handleStatusUpdated}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(r)}
                          title="Editar"
                          className="h-8 w-8 text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton
                          item={r}
                          onConfirm={() => handleDelete(r)}
                          loading={deletingId === r.id}
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
  item: Requisicion;
  onConfirm: () => void;
  loading: boolean;
}

function DeleteButton({ item, onConfirm, loading }: DeleteButtonProps) {
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
          <AlertDialogTitle className="text-center">
            ¿Eliminar requisición?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Vas a eliminar la requisición{" "}
            <span className="font-semibold text-foreground">#{item.numero}</span>{" "}
            ({item.concepto}). El registro se desactivará.
            {item.esConsumible && item.surtido && item.consumibleMovimientoId && (
              <span className="mt-2 block rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                ⚠ Esta requisición ya creó una entrada en Consumibles. La entrada
                en el catálogo <strong>no se eliminará</strong>; tendrás que
                ajustarla manualmente si es necesario.
              </span>
            )}
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
