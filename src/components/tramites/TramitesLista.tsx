import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Pencil,
  FileText,
  Tag,
  Layers,
  Power,
  PowerOff,
  CheckCircle2,
  XCircle,
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
import type { Tramite } from "@/types/api";

interface TrámitesListaProps {
  onEdit: (t: Tramite) => void;
  refreshTrigger?: number;
}

const CATEGORIA_STYLES: Record<string, { label: string; classes: string }> = {
  PERMISO: { label: "Permiso", classes: "bg-sky-100 text-sky-700" },
  SERVICIO: { label: "Servicio", classes: "bg-amber-100 text-amber-700" },
  SANCION: { label: "Sanción", classes: "bg-red-100 text-red-700" },
};

type EstadoFiltro = "todos" | "activos" | "inactivos";

export function TrámitesLista({ onEdit, refreshTrigger = 0 }: TrámitesListaProps) {
  const { status } = useServerStatus();
  const [items, setItems] = useState<Tramite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterCategoria, setFilterCategoria] = useState<string>("");
  const [filterEstado, setFilterEstado] = useState<EstadoFiltro>("todos");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Cargamos TODOS los trámites (activos e inactivos) para que el
      // admin pueda ver y gestionar el catálogo completo. El wizard de
      // "Nuevos Servicios" sí filtra por activo=true del lado del frontend.
      const data = await api.listarTramites({
        ...(filterCategoria ? { categoria: filterCategoria } : {}),
        ...(search ? { q: search } : {}),
      });
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar trámites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "online") load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, refreshTrigger, filterCategoria]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleToggleActivo = async (t: Tramite) => {
    setTogglingId(t.id);
    try {
      const nuevoEstado = !t.activo;
      await api.actualizarTramite(t.id, { activo: nuevoEstado });
      toast.success(nuevoEstado ? "Trámite activado" : "Trámite desactivado", {
        description: nuevoEstado
          ? `${t.nombre} vuelve a aparecer en Nuevos Servicios`
          : `${t.nombre} ya no aparece en Nuevos Servicios`,
      });
      load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo cambiar el estado";
      toast.error("Error al cambiar el estado", { description: msg });
    } finally {
      setTogglingId(null);
    }
  };

  // Filtrado en cliente por estado (la lista llega con todos los trámites)
  const itemsFiltrados =
    filterEstado === "todos"
      ? items
      : items.filter((t) =>
          filterEstado === "activos" ? t.activo : !t.activo,
        );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Catálogo de trámites</span>
          <span className="text-sm font-normal text-muted-foreground">
            {items.length} {items.length === 1 ? "trámite" : "trámites"}
          </span>
        </CardTitle>
        <CardDescription>
          {status !== "online"
            ? "Conecta el servidor para ver el catálogo."
            : "Busca, edita o desactiva trámites."}
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
                placeholder="Buscar por nombre o código..."
                className="pl-9"
              />
            </div>
            <select
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todas las categorías</option>
              <option value="PERMISO">Permisos</option>
              <option value="SERVICIO">Servicios</option>
              <option value="SANCION">Sanciones</option>
            </select>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value as EstadoFiltro)}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="todos">Todos los estados</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
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
                setFilterCategoria("");
                setFilterEstado("todos");
                load();
              }}
              disabled={loading}
              title="Limpiar filtros"
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
                Ve a <strong>Configuración</strong> y verifica la URL del servidor.
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando catálogo...
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>
              {search || filterCategoria
                ? "No se encontraron trámites con esos filtros."
                : "Aún no hay trámites en el catálogo."}
            </p>
          </div>
        )}

        {/* Tabla */}
        {!loading && !error && itemsFiltrados.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Trámite</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Campos</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="w-32 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsFiltrados.map((t) => {
                const style = CATEGORIA_STYLES[t.categoria] ?? CATEGORIA_STYLES.PERMISO;
                return (
                  <TableRow
                    key={t.id}
                    className={cn(!t.activo && "opacity-60")}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {t.orden}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{t.nombre}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {t.codigo}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          style.classes,
                        )}
                      >
                        <Tag className="h-3 w-3" />
                        {style.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      {t.activo ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                          <XCircle className="h-3 w-3" />
                          Inactivo
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Layers className="h-3 w-3" />
                        {t.campos.length} ({t.campos.filter((c) => c.required).length} req.)
                      </div>
                    </TableCell>
                    <TableCell>
                      {t.precioBase ? (
                        <span className="font-mono text-sm">
                          ${Number(t.precioBase).toFixed(2)}
                        </span>
                      ) : t.reglaPrecio ? (
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                          Variable
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.requierePago ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                          <Power className="h-3 w-3" />
                          Sí
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <PowerOff className="h-3 w-3" />
                          No
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(t)}
                          title="Editar"
                          className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <ToggleActivoButton
                          tramite={t}
                          onConfirm={() => handleToggleActivo(t)}
                          loading={togglingId === t.id}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!loading && !error && itemsFiltrados.length === 0 && items.length > 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <p>No hay trámites que coincidan con el filtro de estado.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =================================================================
// Botón de activar/desactivar con AlertDialog (cambia según estado)
// =================================================================
function ToggleActivoButton({
  tramite,
  onConfirm,
  loading,
}: {
  tramite: Tramite;
  onConfirm: () => void;
  loading: boolean;
}) {
  const esActivo = tramite.activo;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={esActivo ? "Desactivar" : "Activar"}
          disabled={loading}
          className={cn(
            "h-8 w-8",
            esActivo
              ? "text-red-600 hover:bg-red-50 hover:text-red-700"
              : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : esActivo ? (
            <PowerOff className="h-4 w-4" />
          ) : (
            <Power className="h-4 w-4" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div
            className={cn(
              "mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full",
              esActivo ? "bg-red-100" : "bg-emerald-100",
            )}
          >
            {esActivo ? (
              <PowerOff className="h-6 w-6 text-red-600" />
            ) : (
              <Power className="h-6 w-6 text-emerald-600" />
            )}
          </div>
          <AlertDialogTitle className="text-center">
            {esActivo ? "¿Desactivar trámite?" : "¿Activar trámite?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Vas a {esActivo ? "desactivar" : "activar"}{" "}
            <span className="font-semibold text-foreground">{tramite.nombre}</span>.
            {esActivo
              ? " No se borrará de la base de datos pero no aparecerá en Nuevos Servicios."
              : " Volverá a aparecer en el wizard de Nuevos Servicios y podrá ser usado."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              esActivo
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-emerald-600 text-white hover:bg-emerald-700",
            )}
          >
            {esActivo ? "Sí, desactivar" : "Sí, activar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
