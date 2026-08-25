import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Package,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  ImageOff,
  Trash2,
  History,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConsumibleCard } from "@/components/consumibles/ConsumibleCard";
import { ConsumibleForm } from "@/components/consumibles/ConsumibleForm";
import { EntregarConsumibleDialog } from "@/components/consumibles/EntregarConsumibleDialog";
import { ReponerConsumibleDialog } from "@/components/consumibles/ReponerConsumibleDialog";
import { HistorialConsumibleDialog } from "@/components/consumibles/HistorialConsumibleDialog";
import { HistorialGlobalConsumibles } from "@/components/consumibles/HistorialGlobalConsumibles";

import { useServerStatus } from "@/hooks/use-server-status";
import { api, ApiError } from "@/lib/api";
import type { Consumible } from "@/types/api";

type DialogMode =
  | { kind: "none" }
  | { kind: "form"; item?: Consumible }
  | { kind: "entregar"; item: Consumible }
  | { kind: "reponer"; item: Consumible }
  | { kind: "historial"; item: Consumible };

export function ConsumiblesPage() {
  const { status } = useServerStatus();
  const [items, setItems] = useState<Consumible[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dialog, setDialog] = useState<DialogMode>({ kind: "none" });
  const [deleting, setDeleting] = useState<Consumible | null>(null);

  const load = async (q = search) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listarConsumibles({ q, limit: 100 });
      setItems(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Error al cargar consumibles",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "online") load(search);
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleSaved = () => {
    load(search);
    setDialog({ kind: "none" });
  };

  const handleEntregado = () => {
    load(search);
  };

  const handleEliminar = async () => {
    if (!deleting) return;
    try {
      await api.eliminarConsumible(deleting.id);
      toast.success("Consumible eliminado", {
        description: deleting.concepto,
      });
      setDeleting(null);
      load(search);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo eliminar";
      toast.error("Error al eliminar", { description: msg });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consumibles"
        description="Catálogo de productos con stock. Crea requisiciones marcadas como 'Es Consumible' para sumar al stock automáticamente, o entrega a empleados para descontar."
        icon={Package}
        gradient="from-rose-500 to-pink-600"
        actions={
          <Button
            onClick={() => setDialog({ kind: "form" })}
            className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700"
          >
            <Plus className="h-4 w-4" />
            Nuevo consumible
          </Button>
        }
      />

      <Tabs defaultValue="catalogo" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="catalogo">
            <Package className="h-3.5 w-3.5" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="historial">
            <History className="h-3.5 w-3.5" />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="space-y-4">
          {/* Búsqueda */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por concepto u observación..."
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
                load("");
              }}
              disabled={loading}
              title="Limpiar"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </form>

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
              Cargando consumibles...
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && status === "online" && items.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-rose-200 bg-rose-50/30 py-16 text-center">
              <ImageOff className="mx-auto mb-3 h-12 w-12 text-rose-300" />
              <p className="text-sm font-medium text-rose-700">
                {search
                  ? "No se encontraron consumibles con ese filtro."
                  : "Aún no hay consumibles en el catálogo."}
              </p>
              {!search && (
                <p className="mt-1 text-xs text-rose-600">
                  Crea requisiciones marcadas como "Es Consumible" y se agregarán
                  aquí automáticamente.
                </p>
              )}
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <ConsumibleCard
                  key={item.id}
                  item={item}
                  onEntregar={(c) => setDialog({ kind: "entregar", item: c })}
                  onReponer={(c) => setDialog({ kind: "reponer", item: c })}
                  onVerHistorial={(c) =>
                    setDialog({ kind: "historial", item: c })
                  }
                  onEditar={(c) => setDialog({ kind: "form", item: c })}
                  onEliminar={(c) => setDeleting(c)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historial">
          <HistorialGlobalConsumibles />
        </TabsContent>
      </Tabs>

      {/* Dialog: Crear/Editar */}
      <Dialog
        open={dialog.kind === "form"}
        onOpenChange={(open) =>
          !open && setDialog({ kind: "none" })
        }
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog.kind === "form" && dialog.item
                ? "Editar consumible"
                : "Nuevo consumible"}
            </DialogTitle>
            <DialogDescription>
              {dialog.kind === "form" && dialog.item
                ? `Modifica los datos de "${dialog.item.concepto}".`
                : "Agrega un nuevo producto al catálogo. El stock se modifica con las requisiciones surtidas y las entregas a personal."}
            </DialogDescription>
          </DialogHeader>
          {dialog.kind === "form" && (
            <ConsumibleForm
              initialData={dialog.item}
              onSaved={handleSaved}
              onCancel={() => setDialog({ kind: "none" })}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Entregar */}
      <Dialog
        open={dialog.kind === "entregar"}
        onOpenChange={(open) =>
          !open && setDialog({ kind: "none" })
        }
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Entregar consumible</DialogTitle>
            <DialogDescription>
              Registra la entrega a un empleado. El stock se descontará
              automáticamente.
            </DialogDescription>
          </DialogHeader>
          {dialog.kind === "entregar" && (
            <EntregarConsumibleDialog
              consumible={dialog.item}
              open={true}
              onOpenChange={(open) =>
                !open && setDialog({ kind: "none" })
              }
              onEntregado={handleEntregado}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Reponer stock */}
      <Dialog
        open={dialog.kind === "reponer"}
        onOpenChange={(open) =>
          !open && setDialog({ kind: "none" })
        }
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Reponer stock</DialogTitle>
            <DialogDescription>
              Suma unidades al stock actual (entrada manual sin requisición).
            </DialogDescription>
          </DialogHeader>
          {dialog.kind === "reponer" && (
            <ReponerConsumibleDialog
              consumible={dialog.item}
              open={true}
              onOpenChange={(open) =>
                !open && setDialog({ kind: "none" })
              }
              onRepuesto={handleEntregado}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Historial */}
      <Dialog
        open={dialog.kind === "historial"}
        onOpenChange={(open) =>
          !open && setDialog({ kind: "none" })
        }
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial del consumible</DialogTitle>
            <DialogDescription>
              Entradas y salidas registradas para este producto.
            </DialogDescription>
          </DialogHeader>
          {dialog.kind === "historial" && (
            <HistorialConsumibleDialog consumible={dialog.item} />
          )}
        </DialogContent>
      </Dialog>

      {/* Alert: Confirmar eliminación */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-center">
              ¿Eliminar consumible?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Vas a eliminar{" "}
              <span className="font-semibold text-foreground">
                {deleting?.concepto}
              </span>{" "}
              del catálogo. El registro se desactivará (no se borra de la base
              de datos). Su historial de movimientos se mantiene.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminar}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
