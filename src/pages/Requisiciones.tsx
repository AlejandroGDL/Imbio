import { useState } from "react";
import { Plus, ClipboardList } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { RequisicionForm } from "@/components/requisiciones/RequisicionForm";
import { RequisicionesList } from "@/components/requisiciones/RequisicionesList";
import type { Requisicion } from "@/types/api";

export function RequisicionesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Requisicion | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleNew = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (item: Requisicion) => {
    setEditing(item);
    setDialogOpen(true);
  };

  const handleSaved = (_item: Requisicion) => {
    setRefreshTrigger((n) => n + 1);
    setDialogOpen(false);
    setEditing(undefined);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requisiciones"
        description="Pedidos al área de compras. Si están surtidos y son consumibles, se registran automáticamente en el catálogo."
        icon={ClipboardList}
        gradient="from-cyan-500 to-teal-600"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={handleNew}
                className="bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700"
              >
                <Plus className="h-4 w-4" />
                Nueva requisición
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Editar requisición" : "Nueva requisición"}
                </DialogTitle>
                <DialogDescription>
                  {editing
                    ? `Modifica los datos de la requisición #${editing.numero}.`
                    : "Registra un nuevo pedido al área de compras."}
                </DialogDescription>
              </DialogHeader>
              <RequisicionForm
                initialData={editing}
                onSaved={handleSaved}
                onCancel={() => setDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <RequisicionesList
        onEdit={handleEdit}
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
}
