import { memo } from "react";
import {
  MoreVertical,
  Printer,
  Banknote,
  FileCheck,
  Trash2,
  FileText,
  Pencil,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

import type { Solicitud } from "@/types/api";

// =================================================================
// Tipos
// =================================================================
type AccionKind = "memorandum" | "pago" | "autorizacion" | "editar-autorizacion" | "eliminar";

export interface SolicitudAccionesProps {
  solicitud: Solicitud & {
    tramite?: Partial<{
      id: number;
      codigo: string;
      nombre: string;
      categoria: string;
    }>;
    pago?: Solicitud["pago"];
    autorizacion?: Solicitud["autorizacion"];
  };
  onAccion: (kind: AccionKind) => void;
}

// =================================================================
// Componente
// =================================================================
export const SolicitudAcciones = memo(function SolicitudAcciones({ solicitud, onAccion }: SolicitudAccionesProps) {
  // Estados lógicos
  const estado = solicitud.estado;
  const tienePago = !!solicitud.pago;
  const tieneAutorizacion = !!solicitud.autorizacion;
  const puedeRegistrarPago =
    (estado === "REGISTRADA" || estado === "PENDIENTE_PAGO") && !tienePago;
  const puedeCrearAutorizacion =
    !tieneAutorizacion && (estado === "PAGADA" || estado === "EN_REVISION");

  return (
    <div className="flex items-center justify-end gap-1">
      {/* Botones de acción rápida (visibles solo si aplica) */}
      {puedeRegistrarPago && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAccion("pago")}
          className="h-8 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
        >
          <Banknote className="h-3.5 w-3.5" />
          Pagar
        </Button>
      )}
      {puedeCrearAutorizacion && (
        <Button
          size="sm"
          onClick={() => onAccion("autorizacion")}
          className="h-8 bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-sm hover:from-emerald-600 hover:to-green-700"
        >
          <FileCheck className="h-3.5 w-3.5" />
          Autorizar
        </Button>
      )}

      {/* Ver PDF de la autorización (si existe y fue generado) */}
      {tieneAutorizacion && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (solicitud.autorizacion?.id) {
              window.open(
                api.getPdfUrl(solicitud.autorizacion.id),
                "_blank",
                "noopener,noreferrer",
              );
            }
          }}
          className="h-8 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
          title="Ver PDF de la autorización"
        >
          <FileText className="h-3.5 w-3.5" />
          PDF
        </Button>
      )}

      {/* Editar autorización (si existe) — atajo rápido */}
      {tieneAutorizacion && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAccion("editar-autorizacion")}
          className="h-8 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
          title="Editar autorización y regenerar PDF"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
      )}

      {/* Menú con el resto de acciones */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", !puedeRegistrarPago && !puedeCrearAutorizacion && !tieneAutorizacion && "ml-auto")}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onAccion("memorandum")}>
            <Printer className="h-4 w-4" />
            Re-imprimir memorándum
          </DropdownMenuItem>
          {puedeRegistrarPago && (
            <DropdownMenuItem onClick={() => onAccion("pago")}>
              <Banknote className="h-4 w-4" />
              Registrar pago
            </DropdownMenuItem>
          )}
          {puedeCrearAutorizacion && (
            <DropdownMenuItem onClick={() => onAccion("autorizacion")}>
              <FileCheck className="h-4 w-4" />
              Generar autorización
            </DropdownMenuItem>
          )}
          {tieneAutorizacion && solicitud.autorizacion?.id && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  const autId = solicitud.autorizacion?.id;
                  if (autId) {
                    window.open(api.getPdfUrl(autId), "_blank", "noopener,noreferrer");
                  }
                }}
              >
                <FileText className="h-4 w-4" />
                Ver PDF de autorización
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAccion("editar-autorizacion")}>
                <Pencil className="h-4 w-4" />
                Editar autorización
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onAccion("eliminar")}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            Borrar servicio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
