/**
 * Historial global de movimientos de Resguardos.
 * Muestra TODAS las asignaciones/devoluciones de todos los equipos,
 * con filtros por empleado y fechas.
 */

import { useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  ArrowRightToLine,
  History,
  User,
  ShieldCheck,
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
import type { ResguardoHistorial } from "@/types/api";
import { getServerUrl } from "@/lib/config";

const PAGE_SIZE = 20;

function formatFecha(ymd: string | null): string {
  if (!ymd || ymd.length < 10) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function absoluteImageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${getServerUrl()}${path}`;
}

export function HistorialGlobalResguardos() {
  const { status } = useServerStatus();
  const [items, setItems] = useState<ResguardoHistorial[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = async (q = search, p = page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.historialGlobalResguardos({
        page: p,
        limit: PAGE_SIZE,
      });
      // Filtro client-side básico por texto (el backend no tiene q en este endpoint)
      let filtered = res.data;
      if (q) {
        const ql = q.toLowerCase();
        filtered = res.data.filter((h) => {
          if (h.resguardo?.tipo.toLowerCase().includes(ql)) return true;
          if (h.resguardo?.marca.toLowerCase().includes(ql)) return true;
          if (h.resguardo?.numeroSerie.toLowerCase().includes(ql)) return true;
          if (
            h.personal &&
            `${h.personal.nombre} ${h.personal.apellidos}`
              .toLowerCase()
              .includes(ql)
          )
            return true;
          if (h.motivo?.toLowerCase().includes(ql)) return true;
          return false;
        });
      }
      setItems(filtered);
      setTotal(filtered.length);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Error al cargar movimientos",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "online") load(search, page);
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <History className="h-4 w-4 text-fuchsia-700" />
            Historial global de resguardos
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {total} {total === 1 ? "movimiento" : "movimientos"}
          </span>
        </CardTitle>
        <CardDescription>
          Todas las asignaciones y devoluciones de cualquier equipo. Quién lo
          tuvo, cuándo lo recibió y cuándo lo regresó.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "online" && (
          <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por tipo, marca, serie, empleado..."
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
                setPage(1);
                load("", 1);
              }}
              disabled={loading}
              title="Limpiar"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </form>
        )}

        {status === "offline" && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">Servidor desconectado</p>
              <p className="mt-1 text-amber-800">
                Ve a <strong>Configuración</strong> y verifica la URL del
                servidor backend.
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
              {search
                ? "No hay movimientos con ese filtro."
                : "Aún no se han registrado asignaciones o devoluciones."}
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Asignación</TableHead>
                  <TableHead className="w-28">Devolución</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead>Personal</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((h) => {
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatFecha(h.fechaAsignacion)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {h.fechaDevolucion ? (
                          <span className="text-muted-foreground">
                            {formatFecha(h.fechaDevolucion)}
                          </span>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            <ArrowRightToLine className="mr-1 h-3 w-3" />
                            En uso
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {h.resguardo && (
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-fuchsia-200 bg-fuchsia-50">
                              {absoluteImageUrl(h.resguardo.imagen) ? (
                                // eslint-disable-next-line jsx-a11y/img-redundant-alt
                                <img
                                  src={absoluteImageUrl(h.resguardo.imagen) ?? ""}
                                  alt=""
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <ShieldCheck className="h-3.5 w-3.5 text-fuchsia-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {h.resguardo.tipo} {h.resguardo.marca}
                              </p>
                              <p
                                className="truncate font-mono text-[10px] text-muted-foreground"
                                title={h.resguardo.numeroSerie}
                              >
                                S/N: {h.resguardo.numeroSerie}
                              </p>
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {h.personal && (
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-foreground">
                              {h.personal.nombre} {h.personal.apellidos}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              — {h.personal.puesto}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {h.motivo || h.observaciones ? (
                          <div className="flex flex-col gap-0.5">
                            {h.motivo && (
                              <span className="text-xs">{h.motivo}</span>
                            )}
                            {h.observaciones && (
                              <span
                                className="flex items-start gap-1 text-xs italic text-muted-foreground"
                                title={h.observaciones}
                              >
                                <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
                                <span className="line-clamp-2">
                                  {h.observaciones}
                                </span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
