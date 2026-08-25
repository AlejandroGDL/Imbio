/**
 * ProtectedRoute — envuelve las rutas que requieren autenticación.
 *
 * Comportamiento:
 * - Si todavía estamos verificando /auth/me, muestra un spinner.
 * - Si NO hay usuario, redirige a /login (guardando la URL original
 *   en ?next= para volver después del login).
 * - Si hay usuario pero NO tiene el rol requerido, muestra un 403.
 * - Si todo OK, renderiza el children.
 */

import { Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";

import { useAuth, type Rol } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Si se pasan roles, solo usuarios con alguno de esos roles pasan. */
  roles?: Rol[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, loading, initialized } = useAuth();
  const location = useLocation();

  // Mientras verificamos la sesión al cargar la app
  if (!initialized || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-imbio-green-600" />
          <p className="text-sm font-medium text-slate-600">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  // No autenticado → al login (con returnUrl)
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // Autenticado pero sin el rol requerido
  if (roles && roles.length > 0 && !roles.includes(user.rol)) {
    return <ForbiddenView userRol={user.rol} requiredRoles={roles} />;
  }

  return <>{children}</>;
}

function ForbiddenView({
  userRol,
  requiredRoles,
}: {
  userRol: Rol;
  requiredRoles: Rol[];
}) {
  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <ShieldAlert className="h-7 w-7 text-amber-600" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-slate-900">Acceso denegado</h1>
        <p className="mb-1 text-sm text-slate-600">
          Tu rol actual (<span className="font-mono font-semibold">{userRol}</span>) no
          tiene permisos para acceder a esta sección.
        </p>
        <p className="mb-6 text-xs text-slate-500">
          Se requiere alguno de:{" "}
          <span className="font-mono font-semibold">
            {requiredRoles.join(", ")}
          </span>
        </p>
        <div className="flex justify-center gap-2">
          <Button asChild variant="outline">
            <a href="/dashboard">Ir al inicio</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
