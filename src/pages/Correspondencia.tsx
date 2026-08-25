import { useState } from "react";
import { Mail, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { CorrespondenciaForm } from "@/components/correspondencia/CorrespondenciaForm";
import { CorrespondenciasList } from "@/components/correspondencia/CorrespondenciasList";
import type { Correspondencia } from "@/types/api";

type ModalState =
  | { kind: "closed" }
  | { kind: "new" }
  | { kind: "edit"; item: Correspondencia };

export function CorrespondenciaPage() {
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [refreshKey, setRefreshKey] = useState(0);

  const close = () => setModal({ kind: "closed" });

  const handleSaved = (c: Correspondencia) => {
    setRefreshKey((k) => k + 1);
    close();
    toast.success(
      modal.kind === "edit" ? "Cambios guardados" : "Documento registrado",
      {
        description: `${c.tipoDocumento} #${c.numero} — ID #${c.id}`,
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-900">
            <Mail className="h-7 w-7 text-violet-600" />
            Correspondencia
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro de oficios y memorándums (entrada y salida). Cambia el status
            cuando se atiendan o archiven.
          </p>
        </div>
        <Button
          onClick={() => setModal({ kind: "new" })}
          className="bg-gradient-to-r from-violet-500 to-purple-600 shadow-md hover:from-violet-600 hover:to-purple-700"
          size="lg"
        >
          <Plus className="h-4 w-4" />
          Nuevo documento
        </Button>
      </div>

      {/* Lista */}
      <CorrespondenciasList
        onEdit={(c) => setModal({ kind: "edit", item: c })}
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
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
                  <Mail className="h-6 w-6" />
                </div>
                <DialogTitle>Registrar nuevo documento</DialogTitle>
                <DialogDescription>
                  Captura los datos del oficio o memorándum. El status inicia
                  siempre en <strong>Pendiente</strong>.
                </DialogDescription>
              </DialogHeader>
              <CorrespondenciaForm embedded onSaved={handleSaved} onCancel={close} />
            </>
          )}
          {modal.kind === "edit" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
                  <Mail className="h-6 w-6" />
                </div>
                <DialogTitle>Editar documento #{modal.item.id}</DialogTitle>
                <DialogDescription>
                  Modifica los datos del documento. También puedes cambiar el
                  status (Pendiente / Atendido / Archivado).
                </DialogDescription>
              </DialogHeader>
              <CorrespondenciaForm
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
