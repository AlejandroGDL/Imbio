/**
 * Historial global de movimientos de Consumibles.
 * Muestra TODAS las entregas (SALIDA) y entradas (ENTRADA) de la BD,
 * con filtros por tipo, empleado, fechas y búsqueda libre.
 * No afecta al historial por consumible individual (que sigue dentro
 * del dialog de cada card).
 */

import { useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  User,
  FileText,
  Package,
  StickyNote,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { useServerStatus } from "@/hooks/use-server-status";
import { api, ApiError } from "@/lib/api";
import type {
  ConsumibleMovimiento,
  TipoMovimientoConsumible,
  Unidad,
} from "@/types/api";
import { UNIDADES_LABEL } from "@/types/api";

const PAGE_SIZE = 20;

function formatFecha(ymd: string): string {
  if (!ymd || ymd.length < 10) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function formatCantidad(cantidad: string, unidad: Unidad): string {
  const n = parseFloat(cantidad);
  if (!Number.isFinite(n)) return "—";
  return `${Number.isInteger(n) ? n.toString() : n.toFixed(2)} ${UNIDADES_LABEL[unidad]}`;
}

export function HistorialGlobalConsumibles() {
  const { status } = useServerStatus();
  const [items, setItems] = useState<ConsumibleMovimiento[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterTipo, setFilterTipo] = useState<"" | TipoMovimientoConsumible>("");

  const load = async (
    q = search,
    p = page,
    tipo = filterTipo,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listarMovimientosConsumibles({
        q,
        tipo: tipo || undefined,
        page: p,
        limit: PAGE_SIZE,
      });
      setItems(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Error al cargar movimientos",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "online") load(search, page, filterTipo);
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, filterTipo]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
    load(searchInput, 1, filterTipo);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <History className="h-4 w-4 text-rose-700" />
            Historial global de movimientos
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {total} {total === 1 ? "movimiento" : "movimientos"}
          </span>
        </CardTitle>
        <CardDescription>
          Todas las entregas (SALIDA) y entradas (ENTRADA) de cualquier
          consumible. Usa los filtros para ver entregas a un empleado
          específico o por rango de fechas.
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
                placeholder="Buscar por concepto, empleado u observación..."
                className="pl-9"
              />
            </div>
            <select
              value={filterTipo}
              onChange={(e) => {
                setFilterTipo(e.target.value as "" | TipoMovimientoConsumible);
                setPage(1);
              }}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos los movimientos</option>
              <option value="SALIDA">📤 Solo entregas (SALIDA)</option>
              <option value="ENTRADA">📥 Solo entradas (ENTRADA)</option>
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
                setPage(1);
                load("", 1, "");
              }}
              disabled={loading}
              title="Limpiar"
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
                Ve a <strong>Configuración</strong> y verifica la URL del servidor
                backend.
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando movimientos...
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && status === "online" && items.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <History className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>
              {search || filterTipo
                ? "No hay movimientos con esos filtros."
                : "Aún no se han registrado movimientos."}
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Fecha</TableHead>
                  <TableHead className="w-24">Tipo</TableHead>
                  <TableHead>Consumible</TableHead>
                  <TableHead className="w-32">Cantidad</TableHead>
                  <TableHead>Personal / Origen</TableHead>
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatFecha(m.fecha)}
                    </TableCell>
                    <TableCell>
                      {m.tipo === "ENTRADA" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          <ArrowDownToLine className="mr-1 h-3 w-3" />
                          Entrada
                        </Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                          <ArrowUpFromLine className="mr-1 h-3 w-3" />
                          Salida
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.consumible ? (
                        <div className="flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-rose-500" />
                          <span className="text-sm font-medium">
                            {m.consumible.concepto}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-sm font-bold",
                        m.tipo === "ENTRADA"
                          ? "text-emerald-700"
                          : "text-orange-700",
                      )}
                    >
                      {m.tipo === "ENTRADA" ? "+" : "−"}
                      {m.consumible
                        ? formatCantidad(m.cantidad, m.consumible.unidad)
                        : m.cantidad}
                    </TableCell>
                    <TableCell className="text-xs">
                      {m.tipo === "SALIDA" && m.personal && (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium text-foreground">
                            {m.personal.nombre} {m.personal.apellidos}
                          </span>
                          <span className="text-muted-foreground">
                            — {m.personal.puesto}
                          </span>
                        </div>
                      )}
                      {m.tipo === "ENTRADA" && m.requisicion && (
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Requisición</span>
                          <span className="font-mono text-foreground">
                            #{m.requisicion.numero}
                          </span>
                        </div>
                      )}
                      {m.tipo === "ENTRADA" && !m.requisicion && (
                        <span className="text-muted-foreground">Manual</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {m.observaciones ? (
                        <span
                          className="flex items-start gap-1 text-xs italic text-muted-foreground"
                          title={m.observaciones}
                        >
                          <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="line-clamp-2">{m.observaciones}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
