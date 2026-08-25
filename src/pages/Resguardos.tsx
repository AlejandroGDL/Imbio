import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  ShieldCheck,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  History,
  Trash2,
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
import { ResguardoCard } from "@/components/resguardos/ResguardoCard";
import { ResguardoForm } from "@/components/resguardos/ResguardoForm";
import { AsignarResguardoDialog } from "@/components/resguardos/AsignarResguardoDialog";
import { DevolverResguardoDialog } from "@/components/resguardos/DevolverResguardoDialog";
import { BajaResguardoDialog } from "@/components/resguardos/BajaResguardoDialog";
import { HistorialResguardoDialog } from "@/components/resguardos/HistorialResguardoDialog";
import { HistorialGlobalResguardos } from "@/components/resguardos/HistorialGlobalResguardos";

import { useServerStatus } from "@/hooks/use-server-status";
import { api, ApiError } from "@/lib/api";
import type { Resguardo } from "@/types/api";

type DialogMode =
  | { kind: "none" }
  | { kind: "form"; item?: Resguardo }
  | { kind: "asignar"; item: Resguardo }
  | { kind: "devolver"; item: Resguardo }
  | { kind: "baja"; item: Resguardo }
  | { kind: "historial"; item: Resguardo };

export function ResguardosPage() {
  const { status } = useServerStatus();
  const [items, setItems] = useState<Resguardo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dialog, setDialog] = useState<DialogMode>({ kind: "none" });
  const [deleting, setDeleting] = useState<Resguardo | null>(null);

  const load = async (q = search) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listarResguardos({ q, limit: 100 });
      setItems(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Error al cargar resguardos",
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

  const handleAsignado = () => {
    load(search);
  };

  const handleEliminar = async () => {
    if (!deleting) return;
    try {
      await api.eliminarResguardo(deleting.id);
      toast.success("Resguardo eliminado", {
        description: `${deleting.tipo} ${deleting.marca} (S/N ${deleting.numeroSerie})`,
      });
      setDeleting(null);
      load(search);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "No se pudo eliminar";
      toast.error("Error al eliminar", { description: msg });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resguardos"
        description="Inventario de equipo (laptops, mouse, monitores, etc.). Asigna a personal y lleva el historial de quién lo tuvo y cuándo lo regresó."
        icon={ShieldCheck}
        gradient="from-fuchsia-500 to-purple-600"
        actions={
          <Button
            onClick={() => setDialog({ kind: "form" })}
            className="bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700"
          >
            <Plus className="h-4 w-4" />
            Nuevo equipo
          </Button>
        }
      />

      <Tabs defaultValue="inventario" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="inventario">
            <ShieldCheck className="h-3.5 w-3.5" />
            Inventario
          </TabsTrigger>
          <TabsTrigger value="historial">
            <History className="h-3.5 w-3.5" />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventario" className="space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por tipo, marca, serie..."
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
                  Ve a <strong>Configuración</strong> y verifica la URL del
                  servidor backend.
                </p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando inventario...
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && status === "online" && items.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/30 py-16 text-center">
              <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-fuchsia-300" />
              <p className="text-sm font-medium text-fuchsia-700">
                {search
                  ? "No se encontraron equipos con ese filtro."
                  : "Aún no hay equipos en el inventario."}
              </p>
              {!search && (
                <p className="mt-1 text-xs text-fuchsia-600">
                  Usa el botón "Nuevo equipo" para registrar el primero.
                </p>
              )}
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <ResguardoCard
                  key={item.id}
                  item={item}
                  onAsignar={(r) => setDialog({ kind: "asignar", item: r })}
                  onDevolver={(r) => setDialog({ kind: "devolver", item: r })}
                  onBaja={(r) => setDialog({ kind: "baja", item: r })}
                  onVerHistorial={(r) =>
                    setDialog({ kind: "historial", item: r })
                  }
                  onEditar={(r) => setDialog({ kind: "form", item: r })}
                  onEliminar={(r) => setDeleting(r)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historial">
          <HistorialGlobalResguardos />
        </TabsContent>
      </Tabs>

      {/* Dialog: Crear/Editar */}
      <Dialog
        open={dialog.kind === "form"}
        onOpenChange={(open) => !open && setDialog({ kind: "none" })}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog.kind === "form" && dialog.item
                ? "Editar equipo"
                : "Nuevo equipo"}
            </DialogTitle>
            <DialogDescription>
              {dialog.kind === "form" && dialog.item
                ? `Modifica los datos de ${dialog.item.tipo} ${dialog.item.marca}.`
                : "Registra un nuevo equipo en el inventario. Después podrás asignarlo a un empleado."}
            </DialogDescription>
          </DialogHeader>
          {dialog.kind === "form" && (
            <ResguardoForm
              initialData={dialog.item}
              onSaved={handleSaved}
              onCancel={() => setDialog({ kind: "none" })}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Asignar */}
      <Dialog
        open={dialog.kind === "asignar"}
        onOpenChange={(open) => !open && setDialog({ kind: "none" })}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Asignar equipo</DialogTitle>
            <DialogDescription>
              Registra la entrega a un empleado. Quedará en el historial y
              podrás devolverlo cuando lo regresen.
            </DialogDescription>
          </DialogHeader>
          {dialog.kind === "asignar" && (
            <AsignarResguardoDialog
              resguardo={dialog.item}
              open={true}
              onOpenChange={(open) => !open && setDialog({ kind: "none" })}
              onAsignado={handleAsignado}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Devolver */}
      <Dialog
        open={dialog.kind === "devolver"}
        onOpenChange={(open) => !open && setDialog({ kind: "none" })}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Devolver equipo a bodega</DialogTitle>
            <DialogDescription>
              El equipo volverá a estar disponible para asignar.
            </DialogDescription>
          </DialogHeader>
          {dialog.kind === "devolver" && (
            <DevolverResguardoDialog
              resguardo={dialog.item}
              open={true}
              onOpenChange={(open) => !open && setDialog({ kind: "none" })}
              onDevuelto={handleAsignado}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Historial por equipo */}
      <Dialog
        open={dialog.kind === "historial"}
        onOpenChange={(open) => !open && setDialog({ kind: "none" })}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial del equipo</DialogTitle>
            <DialogDescription>
              Asignaciones y devoluciones registradas.
            </DialogDescription>
          </DialogHeader>
          {dialog.kind === "historial" && (
            <HistorialResguardoDialog resguardo={dialog.item} />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Baja (AlertDialog con form embebido) */}
      <Dialog
        open={dialog.kind === "baja"}
        onOpenChange={(open) => !open && setDialog({ kind: "none" })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dar de baja equipo</DialogTitle>
          </DialogHeader>
          {dialog.kind === "baja" && (
            <BajaResguardoDialog
              resguardo={dialog.item}
              onClose={() => setDialog({ kind: "none" })}
              onBaja={handleAsignado}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
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
              ¿Eliminar equipo?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Vas a eliminar{" "}
              <span className="font-semibold text-foreground">
                {deleting?.tipo} {deleting?.marca} (S/N {deleting?.numeroSerie})
              </span>{" "}
              del inventario. El registro se desactivará. Su historial se
              mantiene.
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
