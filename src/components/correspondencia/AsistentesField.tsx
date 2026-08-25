/**
 * Campo multi-select para asignar el personal que debe asistir a un
 * evento. Usa un Combobox para buscar/agregar y muestra los
 * seleccionados como chips con X para eliminar.
 */

import { useEffect, useState } from "react";
import { Loader2, User, X } from "lucide-react";
import { toast } from "sonner";

import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PersonalOption {
  id: number;
  nombre: string;
  apellidos: string;
  puesto: string;
}

interface AsistentesFieldProps {
  value: number[];
  onChange: (ids: number[]) => void;
  /** Deshabilita toda la interacción (loading) */
  disabled?: boolean;
}

export function AsistentesField({
  value,
  onChange,
  disabled = false,
}: AsistentesFieldProps) {
  const [personal, setPersonal] = useState<PersonalOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .listarPersonal({ activo: true, limit: 200 })
      .then((res) =>
        setPersonal(
          res.data.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            apellidos: p.apellidos,
            puesto: p.puesto,
          })),
        ),
      )
      .catch(() => toast.error("No se pudo cargar el personal"))
      .finally(() => setLoading(false));
  }, []);

  const options = personal.map((p) => ({
    value: p.id,
    label: `${p.nombre} ${p.apellidos}`,
    sublabel: p.puesto,
  }));

  // Excluir los ya seleccionados de las opciones
  const availableOptions = options.filter(
    (o) => !value.includes(o.value as number),
  );

  const handleAdd = (id: number | string | null) => {
    if (id === null) return;
    const numId = typeof id === "string" ? parseInt(id, 10) : id;
    if (!Number.isFinite(numId) || value.includes(numId)) return;
    onChange([...value, numId]);
  };

  const handleRemove = (id: number) => {
    onChange(value.filter((v) => v !== id));
  };

  const getNombreCompleto = (id: number) => {
    const p = personal.find((x) => x.id === id);
    return p ? `${p.nombre} ${p.apellidos}` : `ID ${id}`;
  };

  const getPuesto = (id: number) => {
    const p = personal.find((x) => x.id === id);
    return p?.puesto ?? "";
  };

  return (
    <div className="space-y-2">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando personal...
        </div>
      ) : availableOptions.length === 0 && value.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No hay personal activo disponible
        </p>
      ) : (
        <Combobox
          value={null}
          onChange={handleAdd}
          options={availableOptions}
          placeholder="Busca un empleado para agregar..."
          emptyMessage={
            value.length === personal.length
              ? "Todos los empleados ya están en la lista"
              : "No hay empleados disponibles"
          }
          disabled={disabled}
        />
      )}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span
              key={id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900",
              )}
            >
              <User className="h-3 w-3" />
              <span>{getNombreCompleto(id)}</span>
              {getPuesto(id) && (
                <span className="text-sky-600">· {getPuesto(id)}</span>
              )}
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(id)}
                  className="ml-0.5 h-5 w-5 rounded-full p-0 hover:bg-sky-200"
                  title="Quitar"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
