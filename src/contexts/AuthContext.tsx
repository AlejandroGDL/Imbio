/**
 * AuthContext — Estado global del usuario autenticado.
 *
 * Maneja:
 * - Usuario actual (null si no hay sesión)
 * - Estado de carga inicial
 * - Login / logout / me / changePassword
 * - Notificación a listeners cuando cambia el estado de auth
 *   (para que la app pueda redirigir al login cuando expire la sesión)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, ApiError } from "@/lib/api";
import { getServerUrl } from "@/lib/config";

// =================================================================
// Tipos
// =================================================================

export type Rol = "ADMIN" | "OPERADOR" | "TECNICO";

export interface AuthUser {
  id: number;
  username: string;
  nombre: string;
  email: string | null;
  rol: Rol;
  ultimoAcceso: string | null;
}

interface AuthState {
  /** Usuario actual o null si no hay sesión. */
  user: AuthUser | null;
  /** true mientras se está verificando /auth/me al cargar. */
  loading: boolean;
  /** true si ya terminamos de verificar /auth/me. */
  initialized: boolean;
}

export interface AuthContextValue extends AuthState {
  /** Inicia sesión. Devuelve el usuario si OK, lanza error si no. */
  login: (username: string, password: string) => Promise<AuthUser>;
  /** Cierra la sesión actual. */
  logout: () => Promise<void>;
  /** Recarga la info del usuario desde /auth/me. */
  refresh: () => Promise<void>;
  /** Cambia la contraseña del usuario actual. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Devuelve true si el usuario actual tiene el rol requerido. */
  hasRole: (...roles: Rol[]) => boolean;
}

// =================================================================
// Context
// =================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    initialized: false,
  });

  // -----------------------------------------------------------------
  // Cargar usuario al montar
  // -----------------------------------------------------------------
  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await api.me();
      setState({ user: data, loading: false, initialized: true });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.code === "UNAUTHORIZED")) {
        // No hay sesión — estado normal
        setState({ user: null, loading: false, initialized: true });
      } else {
        // Error de red u otro: no podemos saber si hay sesión.
        // Lo dejamos como null para que la app redirija al login.
        setState({ user: null, loading: false, initialized: true });
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // -----------------------------------------------------------------
  // Login
  // -----------------------------------------------------------------
  const login = useCallback(async (username: string, password: string): Promise<AuthUser> => {
    const data = await api.login(username, password);
    setState({ user: data, loading: false, initialized: true });
    return data;
  }, []);

  // -----------------------------------------------------------------
  // Logout
  // -----------------------------------------------------------------
  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Aunque falle, limpiamos el estado local
    }
    setState({ user: null, loading: false, initialized: true });
  }, []);

  // -----------------------------------------------------------------
  // Change password
  // -----------------------------------------------------------------
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.changePassword(currentPassword, newPassword);
  }, []);

  // -----------------------------------------------------------------
  // Role check
  // -----------------------------------------------------------------
  const hasRole = useCallback(
    (...roles: Rol[]): boolean => {
      if (!state.user) return false;
      return roles.includes(state.user.rol);
    },
    [state.user],
  );

  // -----------------------------------------------------------------
  // Contexto
  // -----------------------------------------------------------------
  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      refresh,
      changePassword,
      hasRole,
    }),
    [state, login, logout, refresh, changePassword, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}

/**
 * Helper para saber si el servidor configurado está disponible.
 * (Se usa en el Login para mostrar mensajes de error de red antes
 * de intentar el POST /auth/login).
 */
export function getActiveServerUrl(): string {
  return getServerUrl();
}
