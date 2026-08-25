/**
 * Card de un Consumible (catálogo).
 * Muestra imagen (o placeholder), concepto, unidad, stock y acciones.
 * Click en "Entregar" abre el dialog de entrega.
 * Click en el cuerpo o "Ver historial" abre el dialog de detalle.
 */

import { Package, Send, History, Pencil, Trash2, ArrowDownToLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getServerUrl } from "@/lib/config";

import type { Consumible, Unidad } from "@/types/api";
import { UNIDADES_LABEL } from "@/types/api";

interface ConsumibleCardProps {
  item: Consumible;
  onEntregar: (item: Consumible) => void;
  onReponer: (item: Consumible) => void;
  onVerHistorial: (item: Consumible) => void;
  onEditar?: (item: Consumible) => void;
  onEliminar?: (item: Consumible) => void;
}

function formatCantidad(cantidad: string, unidad: Unidad): string {
  const n = parseFloat(cantidad);
  if (!Number.isFinite(n)) return "—";
  return `${Number.isInteger(n) ? n.toString() : n.toFixed(2)} ${UNIDADES_LABEL[unidad]}`;
}

/** Construye URL absoluta para imágenes guardadas como "/uploads/..." */
function absoluteImageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${getServerUrl()}${path}`;
}

export function ConsumibleCard({
  item,
  onEntregar,
  onReponer,
  onVerHistorial,
  onEditar,
  onEliminar,
}: ConsumibleCardProps) {
  const stock = parseFloat(item.cantidadActual);
  const sinStock = !Number.isFinite(stock) || stock <= 0;
  const stockBajo = stock > 0 && stock < 5;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all",
        "hover:shadow-md",
        sinStock
          ? "border-slate-200 opacity-75"
          : stockBajo
            ? "border-amber-200"
            : "border-rose-200",
      )}
    >
      {/* Imagen / placeholder (más compacta) */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-rose-50 to-pink-100">
        {absoluteImageUrl(item.imagen) ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={absoluteImageUrl(item.imagen) ?? ""}
            alt={`Imagen de ${item.concepto}`}
            className="h-full w-full object-contain p-1"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-10 w-10 text-rose-300" />
          </div>
        )}
        {sinStock && (
          <div className="absolute right-2 top-2 rounded-full bg-slate-700/80 px-2 py-0.5 text-[10px] font-medium text-white">
            Sin stock
          </div>
        )}
        {stockBajo && !sinStock && (
          <div className="absolute right-2 top-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
            Stock bajo
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col p-3.5">
        <h3
          className="line-clamp-2 text-sm font-semibold text-foreground"
          title={item.concepto}
        >
          {item.concepto}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.observaciones || "Sin observaciones"}
        </p>

        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Stock
            </p>
            <p
              className={cn(
                "text-lg font-bold",
                sinStock
                  ? "text-slate-400"
                  : stockBajo
                    ? "text-amber-600"
                    : "text-rose-700",
              )}
            >
              {formatCantidad(item.cantidadActual, item.unidad)}
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            onClick={() => onEntregar(item)}
            disabled={sinStock}
            className="h-8 flex-1 bg-gradient-to-r from-rose-500 to-pink-600 text-xs hover:from-rose-600 hover:to-pink-700"
          >
            <Send className="h-3.5 w-3.5" />
            Entregar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onReponer(item)}
            className="h-8 flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-xs text-white hover:from-emerald-600 hover:to-green-700"
            title="Sumar stock manualmente"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Reponer
          </Button>
        </div>
        <div className="mt-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onVerHistorial(item)}
            className="h-7 w-full text-xs"
            title="Ver historial de movimientos"
          >
            <History className="h-3.5 w-3.5" />
            Ver historial
          </Button>
        </div>
        {(onEditar || onEliminar) && (
          <div className="mt-1.5 flex items-center justify-end gap-0.5 border-t pt-1.5">
            {onEditar && (
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
            {onEliminar && (
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
        )}
      </div>
    </div>
  );
}
