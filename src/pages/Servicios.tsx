import { useState } from "react";
import { Briefcase, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ServiciosLista } from "@/components/servicios/ServiciosLista";
import { ServicioWizard } from "@/components/servicios/ServicioWizard";
import { Memorandum } from "@/components/servicios/Memorandum";

type ModalState = { kind: "closed" } | { kind: "new" };
type MemorandumState = { open: false } | { open: true; solicitudId: number; folio: string };

export function ServiciosPage() {
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [memorandum, setMemorandum] = useState<MemorandumState>({ open: false });
  const [refreshKey, setRefreshKey] = useState(0);

  const close = () => setModal({ kind: "closed" });
  const closeMemorandum = () => {
    setMemorandum({ open: false });
    setRefreshKey((k) => k + 1);
  };

  const handleSaved = (id: number, folio: string) => {
    setRefreshKey((k) => k + 1);
    close();
    // Mostramos el memorandum
    setMemorandum({ open: true, solicitudId: id, folio });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-900">
            <Briefcase className="h-7 w-7 text-amber-600" />
            Solicitudes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro y seguimiento de solicitudes de trámites, permisos y servicios
            municipales.
          </p>
        </div>
        <Button
          onClick={() => setModal({ kind: "new" })}
          className="bg-gradient-to-r from-amber-500 to-orange-600 shadow-md hover:from-amber-600 hover:to-orange-700"
          size="lg"
        >
          <Plus className="h-4 w-4" />
          Nueva solicitud
        </Button>
      </div>

      {/* Lista de solicitudes */}
      <ServiciosLista refreshTrigger={refreshKey} />

      {/* Modal del wizard */}
      <Dialog
        open={modal.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          {modal.kind === "new" && (
            <>
              <DialogHeader>
                <DialogTitle>Registrar nueva solicitud</DialogTitle>
                <DialogDescription>
                  Seguí los 4 pasos para registrar una solicitud (permiso, servicio o sanción).
                </DialogDescription>
              </DialogHeader>
              <ServicioWizard onSaved={handleSaved} onCancel={close} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal del memorandum — aparece después de guardar */}
      <Dialog
        open={memorandum.open}
        onOpenChange={(open) => {
          if (!open) closeMemorandum();
        }}
      >
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          {memorandum.open && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-700">
                  <Briefcase className="h-5 w-5" />
                  Memorándum generado
                </DialogTitle>
                <DialogDescription>
                  Solicitud <span className="font-mono font-semibold">{memorandum.folio}</span>{" "}
                  registrada. Imprimí este memorándum para que el ciudadano lo lleve a
                  pagar.
                </DialogDescription>
              </DialogHeader>
              <Memorandum
                solicitudId={memorandum.solicitudId}
                folio={memorandum.folio}
                onClose={closeMemorandum}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
