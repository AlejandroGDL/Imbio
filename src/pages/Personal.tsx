import { useEffect, useState } from "react";
import { Users, UserPlus, CalendarClock, Palmtree, Coins, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { PersonalForm } from "@/components/personal/PersonalForm";
import { PersonalList } from "@/components/personal/PersonalList";
import { IncidenciaForm } from "@/components/incidencias/IncidenciaForm";
import { IncidenciasList } from "@/components/incidencias/IncidenciasList";
import { VacacionForm } from "@/components/vacaciones/VacacionForm";
import { VacacionesList } from "@/components/vacaciones/VacacionesList";
import { DiaEconomicoForm } from "@/components/dias-economicos/DiaEconomicoForm";
import { DiasEconomicosList } from "@/components/dias-economicos/DiasEconomicosList";
import { InjustificanteForm } from "@/components/injustificantes/InjustificanteForm";
import { InjustificantesList } from "@/components/injustificantes/InjustificantesList";
import { useServerStatus } from "@/hooks/use-server-status";
import { api, ApiError } from "@/lib/api";
import type {
  DiaEconomico,
  Incidencia,
  Injustificante,
  Personal,
  Vacacion,
} from "@/types/api";

type ModalState =
  | { kind: "closed" }
  | { kind: "new-personal" }
  | { kind: "edit-personal"; item: Personal }
  | { kind: "new-incidencia" }
  | { kind: "edit-incidencia"; item: Incidencia }
  | { kind: "new-vacacion" }
  | { kind: "edit-vacacion"; item: Vacacion }
  | { kind: "new-dia-economico" }
  | { kind: "edit-dia-economico"; item: DiaEconomico }
  | { kind: "new-injustificante" }
  | { kind: "edit-injustificante"; item: Injustificante };

export function PersonalPage() {
  const { status } = useServerStatus();
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [refreshPersonal, setRefreshPersonal] = useState(0);
  const [refreshIncidencias, setRefreshIncidencias] = useState(0);
  const [refreshVacaciones, setRefreshVacaciones] = useState(0);
  const [refreshDiasEconomicos, setRefreshDiasEconomicos] = useState(0);
  const [refreshInjustificantes, setRefreshInjustificantes] = useState(0);
  // Lista de personal activo (para selects de Incidencia y Vacación)
  const [personalActivo, setPersonalActivo] = useState<Personal[]>([]);
  // Lista de personal SINDICALIZADO activo (para el select de Días Económicos)
  const [personalSindicalizado, setPersonalSindicalizado] = useState<Personal[]>([]);

  const close = () => setModal({ kind: "closed" });

  // Cargar lista de personal activo
  useEffect(() => {
    if (status !== "online") return;
    let cancel = false;
    (async () => {
      try {
        const res = await api.listarPersonal({ activo: true, limit: 200 });
        if (!cancel) {
          const sorted = [...res.data].sort((a, b) =>
            `${a.apellidos} ${a.nombre}`.localeCompare(
              `${b.apellidos} ${b.nombre}`,
            ),
          );
          setPersonalActivo(sorted);
          // Filtrar sindicalizados para Días Económicos
          setPersonalSindicalizado(
            sorted.filter((p) => p.tipo === "SINDICALIZADO"),
          );
        }
      } catch (err) {
        if (!cancel) {
          toast.error("No se pudo cargar la lista de personal", {
            description:
              err instanceof ApiError ? err.message : "Error desconocido",
          });
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [status, refreshPersonal]);

  // Helper para toast + cerrar + refrescar
  const handleSaved = (
    saved: Personal | Incidencia | Vacacion | DiaEconomico | Injustificante,
    kind: ModalState["kind"],
  ) => {
    if ("curp" in saved || "puesto" in saved) {
      setRefreshPersonal((k) => k + 1);
    } else if ("fecha" in saved && "tipo" in saved) {
      setRefreshIncidencias((k) => k + 1);
    } else if ("fechaInicio" in saved) {
      setRefreshVacaciones((k) => k + 1);
    } else if ("anio" in saved) {
      setRefreshDiasEconomicos((k) => k + 1);
    } else if ("razon" in saved) {
      setRefreshInjustificantes((k) => k + 1);
    }

    const isEdit =
      kind === "edit-personal" ||
      kind === "edit-incidencia" ||
      kind === "edit-vacacion" ||
      kind === "edit-dia-economico" ||
      kind === "edit-injustificante";
    close();

    if (kind === "new-personal" || kind === "edit-personal") {
      const p = saved as Personal;
      toast.success(
        isEdit ? "Cambios guardados" : "Personal registrado",
        {
          description: `${p.nombre} ${p.apellidos} — ${p.puesto} #${p.id}`,
        },
      );
    } else if (kind === "new-incidencia" || kind === "edit-incidencia") {
      const i = saved as Incidencia;
      toast.success(
        isEdit ? "Cambios guardados" : "Incidencia registrada",
        {
          description: i.personal
            ? `${i.personal.nombre} ${i.personal.apellidos} — #${i.id}`
            : `#${i.id}`,
        },
      );
    } else if (kind === "new-vacacion" || kind === "edit-vacacion") {
      const v = saved as Vacacion;
      toast.success(
        isEdit ? "Cambios guardados" : "Vacaciones registradas",
        {
          description: v.personal
            ? `${v.personal.nombre} ${v.personal.apellidos} — ${v.diasSolicitados} días #${v.id}`
            : `#${v.id}`,
        },
      );
    } else if (kind === "new-dia-economico" || kind === "edit-dia-economico") {
      const d = saved as DiaEconomico;
      toast.success(
        isEdit ? "Cambios guardados" : "Días económicos registrados",
        {
          description: d.personal
            ? `${d.personal.nombre} ${d.personal.apellidos} — Año ${d.anio} (${d.diasSolicitados} ${d.diasSolicitados === 1 ? "día" : "días"}) #${d.id}`
            : `#${d.id}`,
        },
      );
    } else {
      const i = saved as Injustificante;
      toast.success(
        isEdit ? "Cambios guardados" : "Injustificante registrado",
        {
          description: i.personal
            ? `${i.personal.nombre} ${i.personal.apellidos} — ${new Date(i.fecha).toLocaleDateString("es-MX")} #${i.id}`
            : `#${i.id}`,
        },
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-900">
            <Users className="h-7 w-7 text-sky-600" />
            Personal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro del personal del IMBIO, control de incidencias y
            vacaciones.
          </p>
        </div>
      </div>

      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full max-w-4xl grid-cols-5">
          <TabsTrigger value="personal">
            <Users className="h-4 w-4" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="incidencias">
            <CalendarClock className="h-4 w-4" />
            Incidencias
          </TabsTrigger>
          <TabsTrigger value="vacaciones">
            <Palmtree className="h-4 w-4" />
            Vacaciones
          </TabsTrigger>
          <TabsTrigger value="dias-economicos">
            <Coins className="h-4 w-4" />
            Días Económicos
          </TabsTrigger>
          <TabsTrigger value="injustificantes">
            <AlertTriangle className="h-4 w-4" />
            Injustificantes
          </TabsTrigger>
        </TabsList>

        {/* =========================================== */}
        {/* TAB 1: Personal                             */}
        {/* =========================================== */}
        <TabsContent value="personal" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setModal({ kind: "new-personal" })}
              className="bg-gradient-to-r from-sky-500 to-blue-600 shadow-md hover:from-sky-600 hover:to-blue-700"
            >
              <UserPlus className="h-4 w-4" />
              Nuevo personal
            </Button>
          </div>
          <PersonalList
            onEdit={(p) => setModal({ kind: "edit-personal", item: p })}
            refreshTrigger={refreshPersonal}
          />
        </TabsContent>

        {/* =========================================== */}
        {/* TAB 2: Incidencias                          */}
        {/* =========================================== */}
        <TabsContent value="incidencias" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setModal({ kind: "new-incidencia" })}
              className="bg-gradient-to-r from-rose-500 to-pink-600 shadow-md hover:from-rose-600 hover:to-pink-700"
              disabled={personalActivo.length === 0}
              title={
                personalActivo.length === 0
                  ? "Primero registra personal en el otro tab"
                  : undefined
              }
            >
              <CalendarClock className="h-4 w-4" />
              Nueva incidencia
            </Button>
          </div>
          <IncidenciasList
            personalList={personalActivo}
            onEdit={(i) => setModal({ kind: "edit-incidencia", item: i })}
            refreshTrigger={refreshIncidencias}
          />
        </TabsContent>

        {/* =========================================== */}
        {/* TAB 3: Vacaciones                           */}
        {/* =========================================== */}
        <TabsContent value="vacaciones" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setModal({ kind: "new-vacacion" })}
              className="bg-gradient-to-r from-amber-500 to-orange-600 shadow-md hover:from-amber-600 hover:to-orange-700"
              disabled={personalActivo.length === 0}
              title={
                personalActivo.length === 0
                  ? "Primero registra personal en el otro tab"
                  : undefined
              }
            >
              <Palmtree className="h-4 w-4" />
              Nueva vacación
            </Button>
          </div>
          <VacacionesList
            personalList={personalActivo}
            onEdit={(v) => setModal({ kind: "edit-vacacion", item: v })}
            refreshTrigger={refreshVacaciones}
          />
        </TabsContent>

        {/* =========================================== */}
        {/* TAB 4: Días Económicos                      */}
        {/* =========================================== */}
        <TabsContent value="dias-economicos" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setModal({ kind: "new-dia-economico" })}
              className="bg-gradient-to-r from-emerald-500 to-green-600 shadow-md hover:from-emerald-600 hover:to-green-700"
              disabled={personalSindicalizado.length === 0}
              title={
                personalSindicalizado.length === 0
                  ? "No hay empleados SINDICALIZADOS activos. Registrá uno en el tab Personal."
                  : undefined
              }
            >
              <Coins className="h-4 w-4" />
              Nuevo día económico
            </Button>
          </div>
          <DiasEconomicosList
            personalList={personalSindicalizado}
            onEdit={(d) => setModal({ kind: "edit-dia-economico", item: d })}
            refreshTrigger={refreshDiasEconomicos}
          />
        </TabsContent>

        {/* =========================================== */}
        {/* TAB 5: Injustificantes                      */}
        {/* =========================================== */}
        <TabsContent value="injustificantes" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setModal({ kind: "new-injustificante" })}
              className="bg-gradient-to-r from-red-500 to-rose-600 shadow-md hover:from-red-600 hover:to-rose-700"
              disabled={personalActivo.length === 0}
              title={
                personalActivo.length === 0
                  ? "Primero registra personal en el tab Personal."
                  : undefined
              }
            >
              <AlertTriangle className="h-4 w-4" />
              Nuevo injustificante
            </Button>
          </div>
          <InjustificantesList
            personalList={personalActivo}
            onEdit={(i) => setModal({ kind: "edit-injustificante", item: i })}
            refreshTrigger={refreshInjustificantes}
          />
        </TabsContent>
      </Tabs>

      {/* Modal único: nuevo o edición (personal / incidencia / vacación) */}
      <Dialog
        open={modal.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent className={modalClassFor(modal)}>
          {modal.kind === "new-personal" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md">
                  <UserPlus className="h-6 w-6" />
                </div>
                <DialogTitle>Registrar nuevo personal</DialogTitle>
                <DialogDescription>
                  Completa los datos por pestaña. Los campos con * son obligatorios.
                </DialogDescription>
              </DialogHeader>
              <PersonalForm
                embedded
                onSaved={(s) => handleSaved(s, modal.kind)}
                onCancel={close}
              />
            </>
          )}
          {modal.kind === "edit-personal" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md">
                  <Users className="h-6 w-6" />
                </div>
                <DialogTitle>
                  Editar personal #{modal.item.id}
                </DialogTitle>
                <DialogDescription>
                  Modifica los datos de {modal.item.nombre} {modal.item.apellidos}.
                </DialogDescription>
              </DialogHeader>
              <PersonalForm
                key={`personal-${modal.item.id}`}
                initialData={modal.item}
                embedded
                onSaved={(s) => handleSaved(s, modal.kind)}
                onCancel={close}
              />
            </>
          )}
          {modal.kind === "new-incidencia" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md">
                  <CalendarClock className="h-6 w-6" />
                </div>
                <DialogTitle>Registrar nueva incidencia</DialogTitle>
                <DialogDescription>
                  Selecciona el empleado, el tipo y la fecha. La descripción es opcional.
                </DialogDescription>
              </DialogHeader>
              <IncidenciaForm
                embedded
                personalList={personalActivo}
                onSaved={(s) => handleSaved(s, modal.kind)}
                onCancel={close}
              />
            </>
          )}
          {modal.kind === "edit-incidencia" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md">
                  <CalendarClock className="h-6 w-6" />
                </div>
                <DialogTitle>
                  Editar incidencia #{modal.item.id}
                </DialogTitle>
                <DialogDescription>
                  Modifica los datos de la incidencia.
                </DialogDescription>
              </DialogHeader>
              <IncidenciaForm
                key={`incidencia-${modal.item.id}`}
                initialData={modal.item}
                personalList={personalActivo}
                embedded
                onSaved={(s) => handleSaved(s, modal.kind)}
                onCancel={close}
              />
            </>
          )}
          {modal.kind === "new-vacacion" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
                  <Palmtree className="h-6 w-6" />
                </div>
                <DialogTitle>Registrar nuevas vacaciones</DialogTitle>
                <DialogDescription>
                  Captura el rango de fechas. Los días se calculan automáticamente.
                </DialogDescription>
              </DialogHeader>
              <VacacionForm
                embedded
                personalList={personalActivo}
                onSaved={(s) => handleSaved(s, modal.kind)}
                onCancel={close}
              />
            </>
          )}
          {modal.kind === "edit-vacacion" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
                  <Palmtree className="h-6 w-6" />
                </div>
                <DialogTitle>
                  Editar vacaciones #{modal.item.id}
                </DialogTitle>
                <DialogDescription>
                  Modifica el rango de fechas o las observaciones.
                </DialogDescription>
              </DialogHeader>
              <VacacionForm
                key={`vacacion-${modal.item.id}`}
                initialData={modal.item}
                personalList={personalActivo}
                embedded
                onSaved={(s) => handleSaved(s, modal.kind)}
                onCancel={close}
              />
            </>
          )}
          {modal.kind === "new-dia-economico" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md">
                  <Coins className="h-6 w-6" />
                </div>
                <DialogTitle>Registrar días económicos</DialogTitle>
                <DialogDescription>
                  Solo para empleados <strong>sindicalizados</strong>. Captura
                  el año y los días solicitados.
                </DialogDescription>
              </DialogHeader>
              <DiaEconomicoForm
                embedded
                personalList={personalSindicalizado}
                onSaved={(s) => handleSaved(s, modal.kind)}
                onCancel={close}
              />
            </>
          )}
          {modal.kind === "edit-dia-economico" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md">
                  <Coins className="h-6 w-6" />
                </div>
                <DialogTitle>
                  Editar días económicos #{modal.item.id}
                </DialogTitle>
                <DialogDescription>
                  Modifica el año, los días o las observaciones.
                </DialogDescription>
              </DialogHeader>
              <DiaEconomicoForm
                key={`dia-economico-${modal.item.id}`}
                initialData={modal.item}
                personalList={personalSindicalizado}
                embedded
                onSaved={(s) => handleSaved(s, modal.kind)}
                onCancel={close}
              />
            </>
          )}
          {modal.kind === "new-injustificante" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <DialogTitle>Registrar injustificante</DialogTitle>
                <DialogDescription>
                  Captura el empleado, la fecha y la razón por la que la
                  ausencia se considera injustificada.
                </DialogDescription>
              </DialogHeader>
              <InjustificanteForm
                embedded
                personalList={personalActivo}
                onSaved={(s) => handleSaved(s, modal.kind)}
                onCancel={close}
              />
            </>
          )}
          {modal.kind === "edit-injustificante" && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <DialogTitle>
                  Editar injustificante #{modal.item.id}
                </DialogTitle>
                <DialogDescription>
                  Modifica la fecha o la razón.
                </DialogDescription>
              </DialogHeader>
              <InjustificanteForm
                key={`injustificante-${modal.item.id}`}
                initialData={modal.item}
                personalList={personalActivo}
                embedded
                onSaved={(s) => handleSaved(s, modal.kind)}
                onCancel={close}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function modalClassFor(modal: ModalState): string {
  if (
    modal.kind === "new-incidencia" ||
    modal.kind === "edit-incidencia" ||
    modal.kind === "new-vacacion" ||
    modal.kind === "edit-vacacion" ||
    modal.kind === "new-dia-economico" ||
    modal.kind === "edit-dia-economico" ||
    modal.kind === "new-injustificante" ||
    modal.kind === "edit-injustificante"
  ) {
    return "max-w-xl";
  }
  return "max-w-3xl";
}
