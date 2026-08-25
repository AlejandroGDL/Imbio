import { useEffect, useState } from "react";
import { FileText, Plus, Loader2, AlertCircle, Layers, Tag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { useServerStatus } from "@/hooks/use-server-status";
import { api } from "@/lib/api";
import type { Tramite } from "@/types/api";

import { TrámitesLista } from "@/components/tramites/TramitesLista";
import { TramiteForm } from "@/components/tramites/TramiteForm";

type ModalState =
  | { kind: "closed" }
  | { kind: "new" }
  | { kind: "edit"; tramite: Tramite };

const CATEGORIA_STYLES: Record<string, { label: string; classes: string; gradient: string }> = {
  PERMISO: { label: "Permiso", classes: "bg-sky-100 text-sky-700", gradient: "from-sky-500 to-blue-600" },
  SERVICIO: { label: "Servicio", classes: "bg-amber-100 text-amber-700", gradient: "from-amber-500 to-orange-600" },
  SANCION: { label: "Sanción", classes: "bg-red-100 text-red-700", gradient: "from-red-500 to-rose-600" },
};

export function TramitesPage() {
  const { status } = useServerStatus();
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [allItems, setAllItems] = useState<Tramite[]>([]);
  const [loadingResumen, setLoadingResumen] = useState(true);

  const close = () => setModal({ kind: "closed" });

  // Carga todos los trámites activos para el resumen
  useEffect(() => {
    if (status !== "online") {
      setLoadingResumen(false);
      return;
    }
    setLoadingResumen(true);
    api
      .listarTramites({ activo: true })
      .then(setAllItems)
      .catch(() => setAllItems([]))
      .finally(() => setLoadingResumen(false));
  }, [status, refreshKey]);

  const handleSaved = (t: Tramite) => {
    setRefreshKey((k) => k + 1);
    close();
    toast.success(modal.kind === "edit" ? "Trámite actualizado" : "Trámite creado", {
      description: `${t.nombre} (${t.codigo})`,
    });
  };

  // Agrupa por categoría
  const porCategoria = allItems.reduce<Record<string, Tramite[]>>((acc, t) => {
    (acc[t.categoria] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-900">
            <FileText className="h-7 w-7 text-emerald-600" />
            Trámites
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo de los {allItems.length} trámites disponibles. Cada trámite tiene
            sus propios campos configurables.
          </p>
        </div>
        <Button
          onClick={() => setModal({ kind: "new" })}
          className="bg-gradient-to-r from-emerald-500 to-green-600 shadow-md hover:from-emerald-600 hover:to-green-700"
          size="lg"
          disabled={status !== "online"}
        >
          <Plus className="h-4 w-4" />
          Nuevo trámite
        </Button>
      </div>

      {/* Resumen por categoría */}
      {status === "online" && !loadingResumen && allItems.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(porCategoria).map(([cat, list]) => {
            const style = CATEGORIA_STYLES[cat] ?? CATEGORIA_STYLES.PERMISO;
            return (
              <Card key={cat}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow",
                      style.gradient,
                    )}
                  >
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{list.length}</p>
                    <p className="text-xs text-muted-foreground">{style.label}s</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {status === "online" && loadingResumen && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando resumen...
        </div>
      )}

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

      {/* Lista */}
      <TrámitesLista
        onEdit={(t) => setModal({ kind: "edit", tramite: t })}
        refreshTrigger={refreshKey}
      />

      {/* Modal único: nuevo o edición */}
      <Dialog
        open={modal.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          {modal.kind === "new" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md">
                  <Plus className="h-6 w-6" />
                </div>
                <DialogTitle>Nuevo trámite</DialogTitle>
                <DialogDescription>
                  Definí los datos básicos y los campos dinámicos del formulario.
                </DialogDescription>
              </DialogHeader>
              <TramiteForm onSaved={handleSaved} onCancel={close} />
            </>
          )}
          {modal.kind === "edit" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md">
                  <Tag className="h-6 w-6" />
                </div>
                <DialogTitle>Editar trámite #{modal.tramite.id}</DialogTitle>
                <DialogDescription>
                  Modificá los datos del trámite. Los cambios se guardan al tocar
                  "Guardar cambios".
                </DialogDescription>
              </DialogHeader>
              <TramiteForm
                key={modal.tramite.id}
                initialData={modal.tramite}
                onSaved={handleSaved}
                onCancel={close}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
