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
import { cn } from "@/lib/utils";

import { useServerStatus } from "@/hooks/use-server-status";
import { api, ApiError } from "@/lib/api";
import type { Ciudadano } from "@/types/api";

interface CiudadanosListProps {
  /** Callback cuando el usuario quiere editar un ciudadano */
  onEdit: (ciudadano: Ciudadano) => void;
  /** Refrescar trigger — cuando cambia, recarga la lista */
  refreshTrigger?: number;
}

const PAGE_SIZE = 20;

export function CiudadanosList({ onEdit, refreshTrigger = 0 }: CiudadanosListProps) {
  const { status } = useServerStatus();
  const [items, setItems] = useState<Ciudadano[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async (q = search, p = page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listarCiudadanos({ q, page: p, limit: PAGE_SIZE });
      setItems(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar ciudadanos");
    } finally {
      setLoading(false);
    }
  };

  // Recarga cuando cambia el server status, la página o el trigger
  useEffect(() => {
    if (status === "online") load(search, page);
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, refreshTrigger]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
    load(searchInput, 1);
  };

  const handleDelete = async (c: Ciudadano) => {
    setDeletingId(c.id);
    try {
      await api.eliminarCiudadano(c.id);
      toast.success("Ciudadano eliminado", {
        description: `${c.nombre} ${c.apellidoPaterno} — desactivado del sistema`,
      });
      // Recarga la lista (puede haber cambiado de página si era el último)
      const newTotal = total - 1;
      const lastPage = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      if (page > lastPage) setPage(lastPage);
      else load(search, page);
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
          <span>Ciudadanos registrados</span>
          <span className="text-sm font-normal text-muted-foreground">
            {total} {total === 1 ? "registro" : "registros"}
          </span>
        </CardTitle>
        <CardDescription>
          {status !== "online"
            ? "Conecta el servidor para ver los ciudadanos."
            : "Busca, edita o elimina registros."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Buscador */}
        {status === "online" && (
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por nombre, apellido o CURP..."
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
              {search
                ? `No se encontraron ciudadanos con "${search}".`
                : "Aún no hay ciudadanos registrados."}
            </p>
            {!search && (
              <p className="mt-1 text-sm">
                Usa el formulario de arriba para registrar el primero.
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
                  <TableHead>Nombre completo</TableHead>
                  <TableHead>CURP</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Registrado</TableHead>
                  <TableHead className="w-32 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.apellidoPaterno} {c.apellidoMaterno ?? ""} {c.nombre}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {c.curp || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {c.telefono || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
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
                          ciudadano={c}
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

interface DeleteButtonProps {
  ciudadano: Ciudadano;
  onConfirm: () => void;
  loading: boolean;
}

function DeleteButton({ ciudadano, onConfirm, loading }: DeleteButtonProps) {
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
            ¿Eliminar ciudadano?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Vas a eliminar a{" "}
            <span className="font-semibold text-foreground">
              {ciudadano.nombre} {ciudadano.apellidoPaterno} {ciudadano.apellidoMaterno ?? ""}
            </span>
            . El registro se desactivará (no se borra de la base de datos) y no
            aparecerá en los listados.
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
