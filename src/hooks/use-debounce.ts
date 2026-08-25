/**
 * Hook que devuelve un valor "debounced" — espera `delay` ms después
 * del último cambio antes de actualizar el valor retornado.
 * Útil para inputs de búsqueda que disparan queries a la API.
 */

import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
