import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  Mail,
  ChevronLeft,
  ChevronRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  StickyNote,
  Bell,
  Calendar,
  CalendarDays,
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
import type {
  Correspondencia,
  StatusCorrespondencia,
  TipoCorrespondencia,
  TipoDocumentoCorrespondencia,
} from "@/types/api";

import { StatusDropdown } from "./StatusDropdown";

interface CorrespondenciasListProps {
  onEdit: (item: Correspondencia) => void;
  refreshTrigger?: number;
}

const PAGE_SIZE = 20;

function formatFecha(ymd: string): string {
  if (!ymd || ymd.length < 10) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Formatea una lista de días del evento.
 * - 1 día  → "DD/MM/YY"
 * - 2 días → "DD/MM y DD/MM/YY"
 * - 3+     → "N días: DD/MM, DD/MM, …" (truncado si son muchos)
 */
function formatFechasEvento(fechas: string[]): string {
  if (!fechas || fechas.length === 0) return "";
  const ordenadas = [...fechas].sort();
  if (ordenadas.length === 1) return formatFecha(ordenadas[0]);
  if (ordenadas.length === 2) {
    return `${formatFecha(ordenadas[0])} y ${formatFecha(ordenadas[1])}`;
  }
  return `${ordenadas.length} días: ${ordenadas.map(formatFecha).join(", ")}`;
}

/** Lista completa de fechas formateadas (para sub-línea y title) */
function formatFechasDetalle(fechas: string[]): string {
  return [...fechas].sort().map(formatFecha).join(", ");
}

const TIPO_DOC_LABEL: Record<TipoDocumentoCorrespondencia, string> = {
  OFICIO: "Oficio",
  MEMORANDUM: "Memorándum",
};

export function CorrespondenciasList({
  onEdit,
  refreshTrigger = 0,
}: CorrespondenciasListProps) {
  const { status } = useServerStatus();
  const [items, setItems] = useState<Correspondencia[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterTipo, setFilterTipo] = useState<TipoCorrespondencia | "">("");
  const [filterStatus, setFilterStatus] = useState<StatusCorrespondencia | "">("");
  const [filterOcupa, setFilterOcupa] = useState<"" | "true" | "false">("");
  const [filterAsiste, setFilterAsiste] = useState<"" | "true" | "false">("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async (
    q = search,
    p = page,
    tipo = filterTipo,
    st = filterStatus,
    ocupa = filterOcupa,
    asiste = filterAsiste,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listarCorrespondencias({
        q,
        tipo: tipo || undefined,
        status: st || undefined,
        ocupaRespuesta: ocupa ? ocupa === "true" : undefined,
        asisteAEvento: asiste ? asiste === "true" : undefined,
        page: p,
        limit: PAGE_SIZE,
      });
      setItems(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Error al cargar correspondencia",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "online")
      load(search, page, filterTipo, filterStatus, filterOcupa, filterAsiste);
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    status,
    page,
    refreshTrigger,
    filterTipo,
    filterStatus,
    filterOcupa,
    filterAsiste,
  ]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
    load(searchInput, 1, filterTipo, filterStatus, filterOcupa, filterAsiste);
  };

  const activeFilterCount = [
    filterOcupa !== "",
    filterAsiste !== "",
  ].filter(Boolean).length;

  const handleDelete = async (c: Correspondencia) => {
    setDeletingId(c.id);
    try {
      await api.eliminarCorrespondencia(c.id);
      toast.success("Correspondencia eliminada", {
        description: `${TIPO_DOC_LABEL[c.tipoDocumento]} #${c.numero}`,
      });
      const newTotal = total - 1;
      const lastPage = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      if (page > lastPage) setPage(lastPage);
      else
        load(
          search,
          page,
          filterTipo,
          filterStatus,
          filterOcupa,
          filterAsiste,
        );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo eliminar";
      toast.error("Error al eliminar", { description: msg });
    } finally {
      setDeletingId(null);
    }
  };

  /** Actualiza un item en el state local cuando cambia su status inline */
  const handleStatusUpdated = (updated: Correspondencia) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Correspondencia registrada</span>
          <span className="text-sm font-normal text-muted-foreground">
            {total} {total === 1 ? "registro" : "registros"}
          </span>
        </CardTitle>
        <CardDescription>
          {status !== "online"
            ? "Conecta el servidor para ver la correspondencia."
            : "Busca, edita o elimina documentos. Filtra por tipo o status."}
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
                placeholder="Buscar por número, remitente, asunto..."
                className="pl-9"
              />
            </div>
            <select
              value={filterTipo}
              onChange={(e) => {
                setFilterTipo(e.target.value as TipoCorrespondencia | "");
                setPage(1);
              }}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos los tipos</option>
              <option value="ENTRADA">📥 Entrada</option>
              <option value="SALIDA">📤 Salida</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value as StatusCorrespondencia | "");
                setPage(1);
              }}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos los status</option>
              <option value="PENDIENTE">⏳ Pendiente</option>
              <option value="ATENDIDO">✅ Atendido</option>
              <option value="ARCHIVADO">📁 Archivado</option>
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
                setFilterTipo("");
                setFilterStatus("");
                setFilterOcupa("");
                setFilterAsiste("");
                setPage(1);
                load("", 1, "", "", "", "");
              }}
              disabled={loading}
              title="Limpiar búsqueda"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </form>
        )}

        {/* Sub-banda de filtros de notificación */}
        {status === "online" && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-100 bg-sky-50/30 px-3 py-2 text-xs">
            <span className="font-semibold text-sky-900">Notificación:</span>

            <div className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-sky-600" />
              <span className="text-muted-foreground">Ocupa respuesta:</span>
              <select
                value={filterOcupa}
                onChange={(e) => {
                  setFilterOcupa(e.target.value as "" | "true" | "false");
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
              <Calendar className="h-3.5 w-3.5 text-sky-600" />
              <span className="text-muted-foreground">Asiste a evento:</span>
              <select
                value={filterAsiste}
                onChange={(e) => {
                  setFilterAsiste(e.target.value as "" | "true" | "false");
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
                  setFilterOcupa("");
                  setFilterAsiste("");
                  setPage(1);
                  load(search, 1, filterTipo, filterStatus, "", "");
                }}
                className="ml-auto text-xs font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                Limpiar ({activeFilterCount})
              </button>
            )}
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
            <Mail className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>
              {search || filterTipo || filterStatus
                ? "No se encontraron documentos con esos filtros."
                : "Aún no hay correspondencia registrada."}
            </p>
            {!search && !filterTipo && !filterStatus && (
              <p className="mt-1 text-sm">
                Usa el botón "Nuevo documento" para registrar el primero.
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
                  <TableHead className="w-24">Tipo</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Remitente → Destinatario</TableHead>
                  <TableHead className="w-32">Fecha</TableHead>
                  <TableHead className="min-w-[180px]">Notificación</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-28 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {c.tipo === "ENTRADA" ? (
                          <ArrowDownToLine className="h-3.5 w-3.5 text-sky-600" />
                        ) : (
                          <ArrowUpFromLine className="h-3.5 w-3.5 text-orange-600" />
                        )}
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="font-medium">
                            {c.tipo === "ENTRADA" ? "Entrada" : "Salida"}
                          </span>
                          <span className="text-muted-foreground">
                            {TIPO_DOC_LABEL[c.tipoDocumento]}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium">
                      {c.numero}
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">
                          {c.asunto}
                        </span>
                        {c.observaciones && (
                          <span
                            className="flex items-center gap-1 truncate text-xs text-muted-foreground"
                            title={c.observaciones}
                          >
                            <StickyNote className="h-2.5 w-2.5 shrink-0" />
                            {c.observaciones}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate font-medium" title={c.remitente}>
                          {c.remitente}
                        </span>
                        <span
                          className="truncate text-muted-foreground"
                          title={c.destinatario}
                        >
                          → {c.destinatario}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        {formatFecha(c.fecha)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {c.ocupaRespuesta && (
                          <span
                            className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                            title={`Fecha máxima: ${formatFecha(c.fechaMaximaRespuesta ?? "")}`}
                          >
                            <Bell className="h-3 w-3" />
                            Respuesta: {formatFecha(c.fechaMaximaRespuesta ?? "")}
                          </span>
                        )}
                        {c.asisteAEvento && c.fechasEvento.length > 0 && (
                          <EventoBadge fechas={c.fechasEvento} />
                        )}
                        {!c.ocupaRespuesta &&
                          (!c.asisteAEvento || c.fechasEvento.length === 0) && (
                            <span className="text-[11px] text-muted-foreground">
                              —
                            </span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusDropdown
                        item={c}
                        onUpdated={handleStatusUpdated}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(c)}
                          title="Editar"
                          className="h-8 w-8 text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton
                          item={c}
                          onConfirm={() => handleDelete(c)}
                          loading={deletingId === c.id}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
  item: Correspondencia;
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
          <AlertDialogTitle className="text-center">¿Eliminar documento?</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Vas a eliminar el{" "}
            <span className="font-semibold text-foreground">
              {TIPO_DOC_LABEL[item.tipoDocumento]} #{item.numero}
            </span>{" "}
            ({item.tipo === "ENTRADA" ? "Entrada" : "Salida"}) de{" "}
            <span className="font-semibold text-foreground">{item.remitente}</span>.
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

// =================================================================
// Badge del evento: layout de 1 o 2 líneas según la cantidad
// de fechas, para evitar que se vea raro cuando hay muchas.
// =================================================================
function EventoBadge({ fechas }: { fechas: string[] }) {
  const detalle = formatFechasDetalle(fechas);
  const title = `Días del evento: ${detalle}`;

  // 1 ó 2 días → una sola línea, todo en el badge
  if (fechas.length <= 2) {
    return (
      <span
        className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800"
        title={title}
      >
        <CalendarDays className="h-3 w-3" />
        {formatFechasEvento(fechas)}
      </span>
    );
  }

  // 3+ días → badge con el conteo + sub-línea con la lista completa
  return (
    <div
      className="flex flex-col gap-0.5"
      title={title}
    >
      <span className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
        <CalendarDays className="h-3 w-3" />
        {fechas.length} días
      </span>
      <span className="text-[10.5px] leading-tight text-muted-foreground">
        {detalle}
      </span>
    </div>
  );
}
