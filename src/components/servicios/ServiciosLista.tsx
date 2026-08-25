import { useEffect, useState, lazy, Suspense } from "react";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Banknote,
  Printer,
  FileCheck,
  Trash2,
  Pencil,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

import { useServerStatus } from "@/hooks/use-server-status";
import { api, ApiError } from "@/lib/api";
import type { EstadoSolicitud, Solicitud } from "@/types/api";

import { SolicitudAcciones } from "@/components/servicios/SolicitudAcciones";

// Code splitting: los 3 dialogs (Memorandum, RegistrarPagoForm,
// CrearAutorizacionForm) son pesados y SOLO se necesitan cuando
// el usuario abre el dialog correspondiente. Cargarlos lazy reduce
// el bundle inicial del módulo de Servicios (que es grande) y
// acelera el primer render.
const Memorandum = lazy(() =>
  import("@/components/servicios/Memorandum").then((m) => ({ default: m.Memorandum })),
);
const RegistrarPagoForm = lazy(() =>
  import("@/components/servicios/RegistrarPagoForm").then((m) => ({
    default: m.RegistrarPagoForm,
  })),
);
const CrearAutorizacionForm = lazy(() =>
  import("@/components/servicios/CrearAutorizacionForm").then((m) => ({
    default: m.CrearAutorizacionForm,
  })),
);

/** Skeleton mientras se hace el chunk del dialog lazy. */
function DialogSkeleton({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">Cargando {label}…</span>
    </div>
  );
}

interface ServiciosListaProps {
  refreshTrigger?: number;
}

const ESTADO_STYLES: Record<EstadoSolicitud, { label: string; classes: string; icon: any }> = {
  REGISTRADA: { label: "Registrada", classes: "bg-slate-100 text-slate-700", icon: Clock },
  PENDIENTE_PAGO: { label: "Pendiente pago", classes: "bg-amber-100 text-amber-800", icon: Banknote },
  PAGADA: { label: "Pagada", classes: "bg-blue-100 text-blue-800", icon: CheckCircle2 },
  EN_REVISION: { label: "En revisión", classes: "bg-purple-100 text-purple-800", icon: Clock },
  AUTORIZADA: { label: "Autorizada", classes: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  RECHAZADA: { label: "Rechazada", classes: "bg-red-100 text-red-800", icon: XCircle },
  CANCELADA: { label: "Cancelada", classes: "bg-slate-100 text-slate-500", icon: AlertTriangle },
};

const PAGE_SIZE = 15;

type DialogKind =
  | "closed"
  | "memorandum"
  | "pago"
  | "autorizacion"
  | "editar-autorizacion"
  | "eliminar";

export function ServiciosLista({ refreshTrigger = 0 }: ServiciosListaProps) {
  const { status } = useServerStatus();
  const [items, setItems] = useState<Solicitud[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterEstado, setFilterEstado] = useState<EstadoSolicitud | "">("");

  // Debounce del search para no pegarle al backend en cada keystroke
  const debouncedSearch = useDebounce(searchInput, 350);
  useEffect(() => {
    if (debouncedSearch !== search) {
      setSearch(debouncedSearch);
      setPage(1);
    }
  }, [debouncedSearch, search]);

  // Estado de dialogs
  const [dialog, setDialog] = useState<{ kind: DialogKind; solicitud: Solicitud | null }>({
    kind: "closed",
    solicitud: null,
  });
  const [deleting, setDeleting] = useState(false);

  const closeDialog = () => setDialog({ kind: "closed", solicitud: null });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listarSolicitudes({
        ...(filterEstado ? { estado: filterEstado } : {}),
        ...(search ? { q: search } : {}),
        page,
        limit: PAGE_SIZE,
      });
      setItems(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "online") load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, refreshTrigger, filterEstado, page, search]);

  const handleAccionSolicitud = (
    solicitud: Solicitud,
    kind: "memorandum" | "pago" | "autorizacion" | "editar-autorizacion" | "eliminar",
  ) => {
    setDialog({ kind, solicitud });
  };

  const handleEliminar = async () => {
    if (!dialog.solicitud) return;
    setDeleting(true);
    try {
      const res = await api.eliminarSolicitud(dialog.solicitud.id);
      const extras: string[] = [];
      if (res.pagoBorrado) extras.push("el pago");
      if (res.autorizacionBorrada) extras.push("la autorización");
      const desc =
        extras.length > 0
          ? `Solicitud ${dialog.solicitud.folio} borrada (también ${extras.join(" y ")})`
          : `Solicitud ${dialog.solicitud.folio} borrada`;
      toast.success("Servicio borrado", { description: desc });
      closeDialog();
      load();
    } catch (err) {
      toast.error("Error al borrar", {
        description: err instanceof ApiError ? err.message : "No se pudo borrar",
      });
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Historial de solicitudes</span>
          <span className="text-sm font-normal text-muted-foreground">
            {total} {total === 1 ? "solicitud" : "solicitudes"}
          </span>
        </CardTitle>
        <CardDescription>
          {status !== "online"
            ? "Conecta el servidor para ver el historial."
            : "Todas las solicitudes de trámites, permisos y servicios."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        {status === "online" && (
          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex flex-wrap gap-2"
          >
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por folio, nombre o CURP…"
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <select
              value={filterEstado}
              onChange={(e) => {
                setFilterEstado(e.target.value as EstadoSolicitud | "");
                setPage(1);
              }}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ESTADO_STYLES).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
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
                setFilterEstado("");
                setPage(1);
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
            Cargando solicitudes...
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <Briefcase className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>
              {search || filterEstado
                ? "No se encontraron solicitudes con esos filtros."
                : "Aún no hay solicitudes registradas."}
            </p>
            {!search && !filterEstado && (
              <p className="mt-1 text-sm">
                Toca <strong>Nueva solicitud</strong> para registrar la primera.
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
                  <TableHead>Folio</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Ciudadano</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-72 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => {
                  const estilo = ESTADO_STYLES[s.estado];
                  const IconoEstado = estilo.icon;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {s.folio}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {s.tramite?.nombre ?? `Trámite #${s.tramiteId}`}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {s.tramite?.codigo}
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.ciudadano ? (
                          <div>
                            <div className="text-sm font-medium">
                              {s.ciudadano.nombre} {s.ciudadano.apellidoPaterno}
                            </div>
                            {s.ciudadano.curp && (
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {s.ciudadano.curp}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(s.fechaSolicitud).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {s.precioFinal ? (
                          <span className="font-mono text-sm">
                            ${Number(s.precioFinal).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            estilo.classes,
                          )}
                        >
                          <IconoEstado className="h-3 w-3" />
                          {estilo.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <SolicitudAcciones
                          solicitud={s}
                          onAccion={(kind) => handleAccionSolicitud(s, kind)}
                        />
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

      {/* ===== Dialogs ===== */}

      {/* Memorandum (re-imprimir) */}
      <Dialog
        open={dialog.kind === "memorandum" && dialog.solicitud !== null}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          {dialog.solicitud && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-700">
                  <Printer className="h-5 w-5" />
                  Memorándum
                </DialogTitle>
                <DialogDescription>
                  Solicitud{" "}
                  <span className="font-mono font-semibold">
                    {dialog.solicitud.folio}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <Suspense fallback={<DialogSkeleton label="el memorándum" />}>
                <Memorandum
                  solicitudId={dialog.solicitud.id}
                  folio={dialog.solicitud.folio}
                  onClose={closeDialog}
                />
              </Suspense>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Registrar pago */}
      <Dialog
        open={dialog.kind === "pago" && dialog.solicitud !== null}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent className="max-w-xl">
          {dialog.solicitud && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-700">
                  <Banknote className="h-5 w-5" />
                  Registrar pago
                </DialogTitle>
                <DialogDescription>
                  Solicitud{" "}
                  <span className="font-mono font-semibold">
                    {dialog.solicitud.folio}
                  </span>{" "}
                  — {dialog.solicitud.tramite?.nombre}
                </DialogDescription>
              </DialogHeader>
              <Suspense fallback={<DialogSkeleton label="el formulario de pago" />}>
                <RegistrarPagoForm
                  solicitudId={dialog.solicitud.id}
                  precioSugerido={
                    dialog.solicitud.precioFinal
                      ? Number(dialog.solicitud.precioFinal)
                      : 0
                  }
                  onSaved={() => {
                    closeDialog();
                    load();
                  }}
                  onCancel={closeDialog}
                />
              </Suspense>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Generar autorización */}
      <Dialog
        open={dialog.kind === "autorizacion" && dialog.solicitud !== null}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          {dialog.solicitud && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-700">
                  <FileCheck className="h-5 w-5" />
                  Generar autorización
                </DialogTitle>
                <DialogDescription>
                  Solicitud{" "}
                  <span className="font-mono font-semibold">
                    {dialog.solicitud.folio}
                  </span>{" "}
                  — {dialog.solicitud.tramite?.nombre}
                </DialogDescription>
              </DialogHeader>
              <Suspense fallback={<DialogSkeleton label="el formulario de autorización" />}>
                <CrearAutorizacionForm
                  solicitudId={dialog.solicitud.id}
                  onSaved={() => {
                    closeDialog();
                    load();
                  }}
                  onCancel={closeDialog}
                />
              </Suspense>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Editar autorización (corregir datos + regenerar PDF) */}
      <Dialog
        open={dialog.kind === "editar-autorizacion" && dialog.solicitud !== null}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          {dialog.solicitud?.autorizacion && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-700">
                  <Pencil className="h-5 w-5" />
                  Editar autorización
                </DialogTitle>
                <DialogDescription>
                  Solicitud{" "}
                  <span className="font-mono font-semibold">
                    {dialog.solicitud.folio}
                  </span>{" "}
                  — {dialog.solicitud.tramite?.nombre} · Aut.{" "}
                  <span className="font-mono font-semibold">
                    {dialog.solicitud.autorizacion.numeroAutorizacion}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <Suspense fallback={<DialogSkeleton label="el formulario de autorización" />}>
                <CrearAutorizacionForm
                  key={`edit-aut-${dialog.solicitud.autorizacion.id}`}
                  solicitudId={dialog.solicitud.id}
                  initialAutorizacion={dialog.solicitud.autorizacion}
                  onSaved={() => {
                    closeDialog();
                    load();
                  }}
                  onCancel={closeDialog}
                />
              </Suspense>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <Dialog
        open={dialog.kind === "eliminar" && dialog.solicitud !== null}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent className="max-w-md">
          {dialog.solicitud && (() => {
            const s = dialog.solicitud!;
            const tienePago = !!s.pago;
            const tieneAutorizacion = !!s.autorizacion;
            const tieneDatosSensibles = tienePago || tieneAutorizacion;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-center text-red-700">
                    ¿Borrar el servicio?
                  </DialogTitle>
                  <DialogDescription className="text-center">
                    Vas a borrar{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {s.folio}
                    </span>{" "}
                    —{" "}
                    <span className="font-semibold text-foreground">
                      {s.tramite?.nombre}
                    </span>
                    . Esta acción no se puede deshacer.
                  </DialogDescription>
                </DialogHeader>

                {tieneDatosSensibles && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                    <p className="font-semibold">Se borrará también:</p>
                    <ul className="ml-4 mt-1 list-disc space-y-0.5">
                      {tienePago && s.pago && (
                        <li>
                          Pago folio{" "}
                          <span className="font-mono">{s.pago.folioPago}</span>{" "}
                          por{" "}
                          <span className="font-mono">
                            ${Number(s.pago.monto).toFixed(2)}
                          </span>
                        </li>
                      )}
                      {tieneAutorizacion && s.autorizacion && (
                        <li>
                          Autorización{" "}
                          <span className="font-mono">
                            {s.autorizacion.numeroAutorizacion}
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="flex justify-center gap-2 pt-2">
                  <Button variant="outline" onClick={closeDialog} disabled={deleting}>
                    No, cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleEliminar}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Borrando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Sí, borrar
                      </>
                    )}
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
