import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";

interface TimePickerProps {
  id?: string;
  value: string; // formato "HH:MM" o ""
  onChange: (v: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  /** Intervalo en minutos (default 30) */
  step?: 15 | 30 | 60;
  /** Rango de horas permitidas (default 0-23) */
  horaMin?: number;
  horaMax?: number;
}

/**
 * Selector de hora con dropdown de opciones cada N minutos.
 * Más fácil de usar en mouse que el input time nativo.
 */
export function TimePicker({
  id,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  className,
  step = 30,
  horaMin = 0,
  horaMax = 23,
}: TimePickerProps) {
  // Genera las opciones
  const opciones: { value: string; label: string }[] = [];
  for (let h = horaMin; h <= horaMax; h++) {
    for (let m = 0; m < 60; m += step) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      opciones.push({
        value: `${hh}:${mm}`,
        label: `${hh}:${mm}`,
      });
    }
  }

  const isDisabled = disabled || readOnly;
  const isReadOnlyValue = !value;

  return (
    <div className={cn("relative", className)}>
      <Clock
        className={cn(
          "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
          isReadOnlyValue ? "text-muted-foreground/50" : "text-muted-foreground",
        )}
      />
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={isDisabled}
        aria-invalid={undefined}
        className={cn(
          "flex h-9 w-full appearance-none rounded-md border border-input bg-transparent pl-9 pr-8 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          isReadOnlyValue && "text-muted-foreground",
          isDisabled && "cursor-not-allowed bg-slate-100 text-slate-600",
        )}
      >
        <option value="">Seleccionar hora...</option>
        {opciones.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {/* Chevron */}
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
