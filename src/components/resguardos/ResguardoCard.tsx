/**
 * Card de un Resguardo (equipo del inventario).
 * Muestra imagen, tipo, marca, modelo, serie, estado (badge) y
 * el personal actual si está asignado. Acciones según estado:
 *   - EN_BODEGA     → Asignar · Ver historial · Editar · Eliminar
 *   - ASIGNADO      → Devolver · Ver historial · Editar
 *   - REPARACION    → Asignar (al terminar) · Ver historial · Editar
 *   - BAJA          → Ver historial (solo)
 */

import {
  ShieldCheck,
  Send,
  ArrowDownToLine,
  History,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getServerUrl } from "@/lib/config";

import type { Resguardo } from "@/types/api";
import { ESTADO_RESGUARDO_CLASSES, ESTADO_RESGUARDO_LABEL } from "@/types/api";

interface ResguardoCardProps {
  item: Resguardo;
  onAsignar: (item: Resguardo) => void;
  onDevolver: (item: Resguardo) => void;
  onBaja: (item: Resguardo) => void;
  onVerHistorial: (item: Resguardo) => void;
  onEditar?: (item: Resguardo) => void;
  onEliminar?: (item: Resguardo) => void;
}

/** Construye URL absoluta para imágenes guardadas como "/uploads/..." */
function absoluteImageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${getServerUrl()}${path}`;
}

function formatFecha(ymd: string | null): string {
  if (!ymd || ymd.length < 10) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function ResguardoCard({
  item,
  onAsignar,
  onDevolver,
  onBaja,
  onVerHistorial,
  onEditar,
  onEliminar,
}: ResguardoCardProps) {
  const cfg = ESTADO_RESGUARDO_CLASSES[item.estado];
  const img = absoluteImageUrl(item.imagen);
  const puedeAsignar = item.estado === "EN_BODEGA" || item.estado === "REPARACION";
  const puedeDevolver = item.estado === "ASIGNADO";

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:shadow-md",
        item.estado === "BAJA" ? "border-red-200 opacity-80" : "border-slate-200",
      )}
    >
      {/* Imagen / placeholder */}
      <div className="relative h-28 w-full overflow-hidden bg-gradient-to-br from-fuchsia-50 to-purple-100">
        {img ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={img}
            alt={`Imagen de ${item.tipo} ${item.marca}`}
            className="h-full w-full object-contain p-1"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ShieldCheck className="h-10 w-10 text-fuchsia-300" />
          </div>
        )}
        <div
          className={cn(
            "absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            cfg.bg,
            cfg.text,
            cfg.border,
          )}
        >
          {ESTADO_RESGUARDO_LABEL[item.estado]}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="line-clamp-1 text-sm font-semibold text-foreground"
            title={item.tipo}
          >
            {item.tipo}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{item.marca}</span>
          {item.modelo && <span> · {item.modelo}</span>}
        </p>
        <p
          className="mt-0.5 font-mono text-[11px] text-muted-foreground"
          title={item.numeroSerie}
        >
          S/N: {item.numeroSerie}
        </p>
        {item.descripcion && (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground" title={item.descripcion}>
            {item.descripcion}
          </p>
        )}

        {/* Asignado a */}
        {item.estado === "ASIGNADO" && item.personalActual && (
          <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/50 px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              Asignado a
            </p>
            <p className="truncate text-xs font-medium text-emerald-900">
              {item.personalActual.nombre} {item.personalActual.apellidos}
            </p>
            <p className="truncate text-[10px] text-emerald-700">
              {item.personalActual.puesto} · desde{" "}
              {formatFecha(item.fechaAsignacionActual)}
            </p>
          </div>
        )}

        {/* Acciones */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {puedeAsignar && (
            <Button
              type="button"
              size="sm"
              onClick={() => onAsignar(item)}
              className="h-8 flex-1 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-xs text-white hover:from-fuchsia-600 hover:to-purple-700"
            >
              <Send className="h-3.5 w-3.5" />
              Asignar
            </Button>
          )}
          {puedeDevolver && (
            <Button
              type="button"
              size="sm"
              onClick={() => onDevolver(item)}
              className="h-8 flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-xs text-white hover:from-emerald-600 hover:to-green-700"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Devolver
            </Button>
          )}
          {item.estado !== "BAJA" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onBaja(item)}
              className="h-8 flex-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
              title="Dar de baja el equipo"
            >
              <XCircle className="h-3.5 w-3.5" />
              Baja
            </Button>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onVerHistorial(item)}
            className="h-7 flex-1 text-xs"
            title="Ver historial de asignaciones"
          >
            <History className="h-3.5 w-3.5" />
            Historial
          </Button>
          {onEditar && item.estado !== "BAJA" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onEditar(item)}
              className="h-7 w-7 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {onEliminar && item.estado === "EN_BODEGA" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onEliminar(item)}
              className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-700"
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
