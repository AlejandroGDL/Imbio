/**
 * Combobox buscable (typeahead / autocomplete).
 *
 * Reemplaza al <select> nativo cuando hay muchas opciones o cuando
 * se quiere buscar por texto. Custom (sin Radix Popover ni cmdk)
 * para no sumar dependencias.
 *
 * API:
 *   <Combobox
 *     value={id}                       // number | string | null
 *     onChange={(v) => …}
 *     options={[{ value, label, sublabel?, disabled? }]}
 *     placeholder="Selecciona…"
 *     emptyMessage="No hay coincidencias"
 *     disabled={false}
 *   />
 *
 * Features:
 *  - Búsqueda por texto (case-insensitive, match en label o sublabel)
 *  - Resaltado del match con <mark>
 *  - Navegación por teclado (↑ ↓ Enter Escape)
 *  - Click fuera cierra
 *  - Empty state si no hay resultados
 *  - Muestra sublabel en gris (puesto, tipo, etc.)
 *  - Estado seleccionado se muestra en el botón trigger
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Highlight } from "@/components/ui/highlight";

export interface ComboboxOption {
  value: number | string;
  label: string;
  sublabel?: string;
  /** Para deshabilitar visualmente ciertas opciones. */
  disabled?: boolean;
}

interface ComboboxProps {
  value: number | string | null;
  onChange: (v: number | string | null) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyMessage?: ReactNode;
  disabled?: boolean;
  /** Si el valor es required (muestra * rojo en el trigger). */
  required?: boolean;
  /** className extra para el trigger. */
  className?: string;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Selecciona…",
  emptyMessage = "Sin coincidencias",
  disabled = false,
  required = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Encontrar la opción seleccionada (para mostrarla en el trigger)
  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)) ?? null,
    [options, value],
  );

  // Filtrar opciones por query (busca en label y sublabel)
  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  // Reset highlighted cuando cambia la lista filtrada
  useEffect(() => {
    setHighlightedIdx(0);
  }, [query]);

  // Click fuera cierra
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Cuando se abre, focus al input y resetea query
  useEffect(() => {
    if (open) {
      // Esperar al siguiente frame para que el input esté montado
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        setQuery("");
        setHighlightedIdx(0);
      });
    }
  }, [open]);

  function selectOption(opt: ComboboxOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlightedIdx];
      if (opt) selectOption(opt);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "ring-1 ring-ring",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={cn(
            "truncate text-left",
            !selected && "text-muted-foreground",
          )}
        >
          {selected ? (
            <span className="flex flex-col">
              <span className="font-medium">{selected.label}</span>
              {selected.sublabel && (
                <span className="text-xs text-muted-foreground">
                  {selected.sublabel}
                </span>
              )}
            </span>
          ) : (
            <span>
              {placeholder}
              {required && <span className="ml-1 text-red-500">*</span>}
            </span>
          )}
        </span>
        <span className="ml-2 flex items-center gap-0.5">
          {selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-slate-200 hover:text-foreground"
              title="Limpiar selección"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg",
            "animate-in fade-in-0 zoom-in-95",
          )}
        >
          {/* Buscador interno */}
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Buscar…"
              className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="off"
            />
          </div>

          {/* Lista */}
          <ul
            id={listId}
            role="listbox"
            className="max-h-[260px] overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </li>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === highlightedIdx;
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled}
                    onClick={() => selectOption(opt)}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm",
                      isHighlighted && "bg-slate-100",
                      opt.disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="flex-1 truncate">
                      <span className="block font-medium">
                        <Highlight text={opt.label} query={query} />
                      </span>
                      {opt.sublabel && (
                        <span className="block text-xs text-muted-foreground">
                          <Highlight text={opt.sublabel} query={query} />
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-sky-600" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
