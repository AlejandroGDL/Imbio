import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  Trees,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  FileText,
  Hash,
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
import { cn } from "@/lib/utils";

import { useServerStatus } from "@/hooks/use-server-status";
import { api, ApiError } from "@/lib/api";
import {
  AREAS_VERDES_OPCIONES,
  type AreaVerde,
} from "@/types/api";

interface AreasVerdesListProps {
  onEdit: (item: AreaVerde) => void;
  refreshTrigger?: number;
}

const PAGE_SIZE = 20;

function formatFecha(ymd: string): string {
  // yyyy-mm-dd → dd/mm/yyyy
  if (!ymd || ymd.length < 10) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function esFuturo(ymd: string): boolean {
  if (!ymd) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(ymd);
  return f.getTime() >= hoy.getTime();
}

export function AreasVerdesList({ onEdit, refreshTrigger = 0 }: AreasVerdesListProps) {
  const { status } = useServerStatus();
  const [items, setItems] = useState<AreaVerde[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterArea, setFilterArea] = useState<string>("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  // ID de la reserva para la que se está generando el PDF.
  const [generatingPdfId, setGeneratingPdfId] = useState<number | null>(null);

  const load = async (
    q = search,
    p = page,
    areaVerde = filterArea,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listarAreasVerdes({
        q,
        areaVerde: areaVerde || undefined,
        page: p,
        limit: PAGE_SIZE,
      });
      setItems(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Error al cargar reservas de áreas verdes",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "online") load(search, page, filterArea);
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, refreshTrigger, filterArea]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
    load(searchInput, 1, filterArea);
  };

  const handleDelete = async (a: AreaVerde) => {
    setDeletingId(a.id);
    try {
      await api.eliminarAreaVerde(a.id);
      toast.success("Reserva eliminada", {
        description: `${a.areaVerde} — ${formatFecha(a.fecha)}`,
      });
      const newTotal = total - 1;
      const lastPage = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      if (page > lastPage) setPage(lastPage);
      else load(search, page, filterArea);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo eliminar";
      toast.error("Error al eliminar", { description: msg });
    } finally {
      setDeletingId(null);
    }
  };

  /**
   * Genera y abre el PDF del permiso. Si la reserva no tiene
   * `folioPermiso`, el backend lo genera y guarda en esta primera
   * petición (lazy gen). Después se actualiza la fila local para
   * mostrar el folio CC-AV-####.
   */
  const handleGenerarPermiso = async (a: AreaVerde) => {
    setGeneratingPdfId(a.id);
    try {
      // Cache-buster para garantizar que el navegador pida un PDF
      // nuevo. Útil sobre todo cuando ya existía folio y se
      // re-imprime tras un cambio.
      const url = api.getPermisoAreaVerdePdfUrl(a.id, true);
      // Abrimos primero el PDF y luego refrescamos la fila para
      // mostrar el folio nuevo (lazy gen).
      window.open(url, "_blank", "noopener,noreferrer");
      // Si la reserva no tenía folio, ya quedó asignado en el
      // backend; refrescamos la lista para que aparezca.
      if (!a.folioPermiso) {
        toast.success("Permiso generado", {
          description: "Se asignó un nuevo folio CC-AV-####",
        });
        // Refrescar la fila para que aparezca el folio nuevo
        load(search, page, filterArea);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "No se pudo abrir el PDF del permiso";
      toast.error("Error al generar permiso", { description: msg });
    } finally {
      // Damos un pequeño delay para que no se vea raro el spinner
      setTimeout(() => setGeneratingPdfId((cur) => (cur === a.id ? null : cur)), 600);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Reservas registradas</span>
          <span className="text-sm font-normal text-muted-foreground">
            {total} {total === 1 ? "registro" : "registros"}
          </span>
        </CardTitle>
        <CardDescription>
          {status !== "online"
            ? "Conecta el servidor para ver las reservas."
            : "Busca, edita o genera el permiso oficial de cada reserva."}
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
                placeholder="Buscar por usuario, responsable, evento, folio..."
                className="pl-9"
              />
            </div>
            <select
              value={filterArea}
              onChange={(e) => {
                setFilterArea(e.target.value);
                setPage(1);
              }}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todas las áreas</option>
              {AREAS_VERDES_OPCIONES.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" disabled={loading}>
              Buscar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setFilterArea("");
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
            <Trees className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>
              {search || filterArea
                ? "No se encontraron reservas con esos filtros."
                : "Aún no hay reservas registradas."}
            </p>
            {!search && !filterArea && (
              <p className="mt-1 text-sm">
                Usa el botón "Nueva reserva" para registrar la primera.
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
                  <TableHead>Área verde</TableHead>
                  <TableHead>Usuario / Institución</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Fecha y horario</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead className="w-44 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((a) => {
                  const futuro = esFuturo(a.fecha);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <Trees className="h-3.5 w-3.5 text-lime-600" />
                            {a.areaVerde}
                          </div>
                          {a.ubicacion && (
                            <span className="ml-5 text-[10px] text-muted-foreground">
                              {a.ubicacion}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span>{a.usuario}</span>
                          {a.folioPermiso && (
                            <span className="inline-flex w-fit items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700">
                              <Hash className="h-2.5 w-2.5" />
                              {a.folioPermiso}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.tipoEvento}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="inline-flex items-center gap-1 font-medium">
                            <Calendar className="h-3 w-3" />
                            {formatFecha(a.fecha)}
                            {futuro && (
                              <span className="rounded-full bg-lime-100 px-1.5 py-0.5 text-[10px] font-semibold text-lime-700">
                                próximo
                              </span>
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {a.horaInicio} – {a.horaFin}
                          </span>
                          {(a.horaMontaje || a.horaDesmontaje) && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              Montaje {a.horaMontaje ?? "—"} · Desmontaje{" "}
                              {a.horaDesmontaje ?? "—"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span className="font-medium">{a.responsable}</span>
                          {a.telefono && (
                            <span className="font-mono text-muted-foreground">
                              {a.telefono}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleGenerarPermiso(a)}
                            disabled={generatingPdfId === a.id}
                            title={
                              a.folioPermiso
                                ? `Reimprimir permiso ${a.folioPermiso}`
                                : "Generar permiso (asignará folio CC-AV-####)"
                            }
                            className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            {generatingPdfId === a.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(a)}
                            title="Editar"
                            className="h-8 w-8 text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <DeleteButton
                            item={a}
                            onConfirm={() => handleDelete(a)}
                            loading={deletingId === a.id}
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
// Botón de eliminar con AlertDialog
// =================================================================
interface DeleteButtonProps {
  item: AreaVerde;
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
          <AlertDialogTitle className="text-center">¿Eliminar reserva?</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Vas a eliminar la reserva de{" "}
            <span className="font-semibold text-foreground">{item.areaVerde}</span>{" "}
            del día <span className="font-semibold text-foreground">{formatFecha(item.fecha)}</span>{" "}
            a nombre de{" "}
            <span className="font-semibold text-foreground">{item.usuario}</span>.
            El registro se desactivará (no se borra de la base de datos).
            {item.folioPermiso && (
              <>
                <br />
                <span className="mt-2 inline-block font-mono text-xs">
                  Folio: {item.folioPermiso}
                </span>
              </>
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
