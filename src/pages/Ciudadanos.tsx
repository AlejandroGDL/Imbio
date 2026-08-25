import { useState } from "react";
import { Users, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { CiudadanoForm } from "@/components/ciudadanos/CiudadanoForm";
import { CiudadanosList } from "@/components/ciudadanos/CiudadanosList";
import type { Ciudadano } from "@/types/api";

type ModalState =
  | { kind: "closed" }
  | { kind: "new" }
  | { kind: "edit"; ciudadano: Ciudadano };

export function CiudadanosPage() {
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [refreshKey, setRefreshKey] = useState(0);

  const close = () => setModal({ kind: "closed" });

  const handleSaved = (c: Ciudadano) => {
    setRefreshKey((k) => k + 1);
    close();
    // El toast ya se muestra en el form, pero confirmamos también desde acá
    toast.success(
      modal.kind === "edit" ? "Cambios guardados" : "Ciudadano registrado",
      {
        description: `${c.nombre} ${c.apellidoPaterno} — ID #${c.id}`,
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-900">
            <Users className="h-7 w-7 text-sky-600" />
            Ciudadanos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro y administración de ciudadanos que realizan trámites y solicitudes.
          </p>
        </div>
        <Button
          onClick={() => setModal({ kind: "new" })}
          className="bg-gradient-to-r from-sky-500 to-blue-600 shadow-md hover:from-sky-600 hover:to-blue-700"
          size="lg"
        >
          <UserPlus className="h-4 w-4" />
          Nuevo ciudadano
        </Button>
      </div>

      {/* Lista */}
      <CiudadanosList
        onEdit={(c) => setModal({ kind: "edit", ciudadano: c })}
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
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md">
                  <UserPlus className="h-6 w-6" />
                </div>
                <DialogTitle>Registrar nuevo ciudadano</DialogTitle>
                <DialogDescription>
                  Completa los datos del ciudadano. Solo nombre y apellido paterno son obligatorios.
                </DialogDescription>
              </DialogHeader>
              <CiudadanoForm embedded onSaved={handleSaved} onCancel={close} />
            </>
          )}
          {modal.kind === "edit" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md">
                  <Users className="h-6 w-6" />
                </div>
                <DialogTitle>Editar ciudadano #{modal.ciudadano.id}</DialogTitle>
                <DialogDescription>
                  Modificá los datos del ciudadano. Los cambios se guardan al tocar
                  "Guardar cambios".
                </DialogDescription>
              </DialogHeader>
              <CiudadanoForm
                key={modal.ciudadano.id}
                initialData={modal.ciudadano}
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
