/**
 * Input de texto con autocompletado (datalist HTML5).
 *
 * El navegador muestra sugerencias de la lista mientras el usuario
 * tipea, pero también acepta texto libre. Es 100% nativo, sin
 * popovers ni dependencias.
 *
 * Uso:
 *   <DatalistInput
 *     value={...}
 *     onChange={...}
 *     options={["Toyota", "Ford", "Nissan"]}
 *     placeholder="..."
 *   />
 */

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface DatalistInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "list"> {
  /** Lista de sugerencias a mostrar en el dropdown. */
  options: string[];
}

export const DatalistInput = forwardRef<HTMLInputElement, DatalistInputProps>(
  function DatalistInput(
    { options, className, id, placeholder, ...rest },
    ref,
  ) {
    // useId garantiza IDs únicos aunque haya varias instancias en la página
    const autoId = useId();
    const listId = id ? `${id}-list` : `datalist-${autoId}`;
    const inputId = id ?? `input-${autoId}`;

    return (
      <>
        <input
          {...rest}
          ref={ref}
          id={inputId}
          list={listId}
          placeholder={placeholder}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          autoComplete="off"
        />
        {options.length > 0 && (
          <datalist id={listId}>
            {options.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        )}
      </>
    );
  },
);
