import { useState } from "react";
import { Trees, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { AreaVerdeForm } from "@/components/areas-verdes/AreaVerdeForm";
import { AreasVerdesList } from "@/components/areas-verdes/AreasVerdesList";
import type { AreaVerde } from "@/types/api";

type ModalState =
  | { kind: "closed" }
  | { kind: "new" }
  | { kind: "edit"; item: AreaVerde };

export function AreasVerdesPage() {
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [refreshKey, setRefreshKey] = useState(0);

  const close = () => setModal({ kind: "closed" });

  const handleSaved = (a: AreaVerde) => {
    setRefreshKey((k) => k + 1);
    close();
    toast.success(
      modal.kind === "edit" ? "Cambios guardados" : "Reserva registrada",
      {
        description: `${a.areaVerde} — ID #${a.id}`,
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-900">
            <Trees className="h-7 w-7 text-lime-600" />
            Áreas Verdes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro de reservas de parques y jardines para eventos.
          </p>
        </div>
        <Button
          onClick={() => setModal({ kind: "new" })}
          className="bg-gradient-to-r from-lime-500 to-green-600 shadow-md hover:from-lime-600 hover:to-green-700"
          size="lg"
        >
          <Plus className="h-4 w-4" />
          Nueva reserva
        </Button>
      </div>

      {/* Lista */}
      <AreasVerdesList
        onEdit={(a) => setModal({ kind: "edit", item: a })}
        refreshTrigger={refreshKey}
      />

      {/* Modal único: nuevo o edición */}
      <Dialog
        open={modal.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent className="max-w-3xl">
          {modal.kind === "new" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-lime-500 to-green-600 text-white shadow-md">
                  <Trees className="h-6 w-6" />
                </div>
                <DialogTitle>Registrar nueva reserva</DialogTitle>
                <DialogDescription>
                  Completa los datos del evento. Los campos con * son obligatorios.
                </DialogDescription>
              </DialogHeader>
              <AreaVerdeForm embedded onSaved={handleSaved} onCancel={close} />
            </>
          )}
          {modal.kind === "edit" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-lime-500 to-green-600 text-white shadow-md">
                  <Trees className="h-6 w-6" />
                </div>
                <DialogTitle>Editar reserva #{modal.item.id}</DialogTitle>
                <DialogDescription>
                  Modifica los datos de la reserva. Los cambios se guardan al tocar
                  "Guardar cambios".
                </DialogDescription>
              </DialogHeader>
              <AreaVerdeForm
                key={modal.item.id}
                initialData={modal.item}
                embedded
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
