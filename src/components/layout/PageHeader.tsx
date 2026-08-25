import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  /** Tailwind gradient classes, ej. "from-cyan-500 to-teal-600" */
  gradient: string;
  actions?: React.ReactNode;
}

/**
 * Header estándar para todas las páginas del módulo.
 * Mantiene coherencia visual y evita repetir el bloque en cada page.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  gradient,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
            gradient,
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 sm:justify-self-end">
          {actions}
        </div>
      )}
    </div>
  );
}
