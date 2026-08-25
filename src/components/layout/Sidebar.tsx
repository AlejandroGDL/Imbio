import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Users,
  FileText,
  Briefcase,
  Settings,
  Leaf,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Database,
  Mail,
  UserCog,
  ClipboardList,
  Package,
  ShieldCheck,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useServerStatus } from "@/hooks/use-server-status";
import { useAuth } from "@/contexts/AuthContext";
import { getMode } from "@/lib/config";
import { CambiarPasswordDialog } from "@/components/auth/CambiarPasswordDialog";
import { Button } from "@/components/ui/button";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Users;
  color: string;
  ringColor: string;
  bgActive: string;
  textActive: string;
  borderActive: string;
}

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "Principal",
    items: [
      {
        to: "/dashboard",
        label: "Inicio",
        icon: LayoutDashboard,
        color: "from-emerald-500 to-teal-600",
        ringColor: "ring-emerald-500/30",
        bgActive: "bg-emerald-50",
        textActive: "text-emerald-700",
        borderActive: "border-l-emerald-500",
      },
    ],
  },
  {
    title: "Inventario",
    items: [
      {
        to: "/requisiciones",
        label: "Requisiciones",
        icon: ClipboardList,
        color: "from-cyan-500 to-teal-600",
        ringColor: "ring-cyan-500/30",
        bgActive: "bg-cyan-50",
        textActive: "text-cyan-700",
        borderActive: "border-l-cyan-500",
      },
      {
        to: "/consumibles",
        label: "Consumibles",
        icon: Package,
        color: "from-rose-500 to-pink-600",
        ringColor: "ring-rose-500/30",
        bgActive: "bg-rose-50",
        textActive: "text-rose-700",
        borderActive: "border-l-rose-500",
      },
      {
        to: "/resguardos",
        label: "Resguardos",
        icon: ShieldCheck,
        color: "from-fuchsia-500 to-purple-600",
        ringColor: "ring-fuchsia-500/30",
        bgActive: "bg-fuchsia-50",
        textActive: "text-fuchsia-700",
        borderActive: "border-l-fuchsia-500",
      },
    ],
  },
  {
    title: "Espacios",
    items: [
      {
        to: "/areas-verdes",
        label: "Áreas Verdes",
        icon: Leaf,
        color: "from-lime-500 to-green-600",
        ringColor: "ring-lime-500/30",
        bgActive: "bg-lime-50",
        textActive: "text-lime-700",
        borderActive: "border-l-lime-500",
      },
    ],
  },
  {
    title: "Atención al ciudadano",
    items: [
      {
        to: "/ciudadanos",
        label: "Ciudadanos",
        icon: Users,
        color: "from-sky-500 to-blue-600",
        ringColor: "ring-sky-500/30",
        bgActive: "bg-sky-50",
        textActive: "text-sky-700",
        borderActive: "border-l-sky-500",
      },
      {
        to: "/tramites",
        label: "Trámites",
        icon: FileText,
        color: "from-emerald-500 to-green-600",
        ringColor: "ring-emerald-500/30",
        bgActive: "bg-emerald-50",
        textActive: "text-emerald-700",
        borderActive: "border-l-emerald-500",
      },
      {
        to: "/servicios",
        label: "Servicios",
        icon: Briefcase,
        color: "from-amber-500 to-orange-600",
        ringColor: "ring-amber-500/30",
        bgActive: "bg-amber-50",
        textActive: "text-amber-700",
        borderActive: "border-l-amber-500",
      },
    ],
  },
  {
    title: "Administración interna",
    items: [
      {
        to: "/personal",
        label: "Personal",
        icon: UserCog,
        color: "from-indigo-500 to-blue-600",
        ringColor: "ring-indigo-500/30",
        bgActive: "bg-indigo-50",
        textActive: "text-indigo-700",
        borderActive: "border-l-indigo-500",
      },
      {
        to: "/correspondencia",
        label: "Correspondencia",
        icon: Mail,
        color: "from-violet-500 to-purple-600",
        ringColor: "ring-violet-500/30",
        bgActive: "bg-violet-50",
        textActive: "text-violet-700",
        borderActive: "border-l-violet-500",
      },
    ],
  },
  {
    title: "Sistema",
    items: [
      {
        to: "/configuracion",
        label: "Configuración",
        icon: Settings,
        color: "from-slate-500 to-gray-600",
        ringColor: "ring-slate-500/30",
        bgActive: "bg-slate-100",
        textActive: "text-slate-700",
        borderActive: "border-l-slate-500",
      },
    ],
  },
];

function StatusDot({ status }: { status: "checking" | "online" | "offline" | "error" }) {
  if (status === "checking") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />;
  }
  if (status === "online") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  }
  return <XCircle className="h-3.5 w-3.5 text-red-500" />;
}

function StatusBadge({ status, message }: { status: string; database?: "up" | "down"; message?: string }) {
  if (status === "checking") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Conectando
      </span>
    );
  }
  if (status === "online") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
        <CheckCircle2 className="h-2.5 w-2.5" />
        En línea
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700"
      title={message}
    >
      <XCircle className="h-2.5 w-2.5" />
      Sin conexión
    </span>
  );
}

export function Sidebar() {
  const { status, database, serverUrl, message, refresh } = useServerStatus();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    // Default: colapsado si la pantalla es < lg (1024px)
    return window.matchMedia("(max-width: 1023px)").matches;
  });
  // Si el usuario hace toggle manual, guardar preferencia y dejar de auto-colapsar
  const [userOverride, setUserOverride] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 1023px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (!userOverride) {
        setCollapsed(e.matches);
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [userOverride]);

  const toggleCollapsed = () => {
    setCollapsed((c) => !c);
    setUserOverride(true);
  };

  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-white shadow-sm transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex items-center border-b border-border",
          collapsed ? "justify-center px-2 py-4" : "gap-2.5 px-4 py-4",
        )}
        title={collapsed ? "IMBIO — Sistema de Gestión" : undefined}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-imbio-green-500 to-imbio-green-700 text-white shadow-md">
          <Leaf className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-bold text-imbio-green-700">IMBIO</span>
            <span className="text-[10px] font-medium text-muted-foreground">
              Sistema de Gestión
            </span>
          </div>
        )}
      </div>

      {/* Toggle colapsar/expandir */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        className={cn(
          "absolute -right-3 top-20 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700",
        )}
        aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Nav agrupado por secciones */}
      <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {navGroups.map((group, groupIdx) => (
          <div key={group.title} className="space-y-1">
            {!collapsed && (
              <p
                className={cn(
                  "px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                  groupIdx > 0 && "pt-2",
                )}
              >
                {group.title}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center rounded-lg border-l-4 border-transparent text-sm font-medium transition-all",
                      collapsed
                        ? "justify-center px-2 py-2.5"
                        : "gap-3 px-3 py-2.5",
                      "text-muted-foreground hover:bg-slate-50",
                      isActive && [
                        item.bgActive,
                        item.textActive,
                        item.borderActive,
                        "shadow-sm",
                      ],
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-all",
                          isActive
                            ? `bg-gradient-to-br ${item.color} text-white shadow-sm`
                            : "bg-slate-100 text-slate-500 group-hover:scale-105",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      {!collapsed && (
                        <>
                          <span className="flex-1">{item.label}</span>
                          {isActive && (
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full bg-gradient-to-br",
                                item.color,
                              )}
                            />
                          )}
                        </>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Server status footer */}
      <div
        className={cn(
          "border-t border-border bg-slate-50/50",
          collapsed ? "px-2 py-3" : "px-4 py-3",
        )}
      >
        {!collapsed && (
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Servidor
            </span>
            <button
              type="button"
              onClick={refresh}
              title="Reintentar conexión"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-slate-200 hover:text-foreground"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        )}
        <div
          className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "gap-2",
          )}
          title={collapsed ? `${serverUrl || "—"} (${status})` : undefined}
        >
          <StatusDot status={status} />
          {!collapsed && (
            <span
              className="truncate font-mono text-[10px] text-muted-foreground"
              title={serverUrl}
            >
              {serverUrl || "—"}
            </span>
          )}
        </div>
        {!collapsed && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <StatusBadge status={status} database={database} message={message} />
            {status === "online" && database === "down" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                <Database className="h-2.5 w-2.5" />
                DB caída
              </span>
            )}
          </div>
        )}
        {collapsed && (
          <div className="mt-1.5 flex justify-center">
            <StatusBadge status={status} database={database} message={message} />
          </div>
        )}
      </div>

      {/* User info + logout */}
      {user && (
        <div
          className={cn(
            "border-t border-border bg-white",
            collapsed ? "px-2 py-3" : "px-4 py-3",
          )}
        >
          <div
            className={cn(
              "flex items-center",
              collapsed ? "justify-center" : "gap-2.5",
            )}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-imbio-green-500 to-imbio-green-700 text-sm font-semibold text-white shadow-sm"
              title={user.nombre}
            >
              {user.nombre
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-semibold text-foreground"
                  title={user.nombre}
                >
                  {user.nombre}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    @{user.username}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                      user.rol === "ADMIN"
                        ? "bg-purple-100 text-purple-700"
                        : user.rol === "TECNICO"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-slate-100 text-slate-700",
                    )}
                  >
                    {user.rol}
                  </span>
                  {getMode() === "client" && (
                    <span
                      className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700"
                      title="Modo Cliente: el login escanea la LAN para encontrar el servidor"
                    >
                      Cliente
                    </span>
                  )}
                  {getMode() === "server" && (
                    <span
                      className="rounded-full bg-imbio-green-100 px-1.5 py-0.5 text-[9px] font-semibold text-imbio-green-700"
                      title="Modo Servidor: esta PC corre el backend"
                    >
                      Servidor
                    </span>
                  )}
                </div>
              </div>
            )}
            {!collapsed && (
              <div className="flex items-center gap-1">
                <CambiarPasswordDialog />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    void logout();
                  }}
                  title="Cerrar sesión"
                  className="h-8 w-8 shrink-0 text-slate-500 hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          {collapsed && (
            <div className="mt-2 flex flex-col items-center gap-1">
              <CambiarPasswordDialog />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  void logout();
                }}
                title="Cerrar sesión"
                className="h-8 w-8 text-slate-500 hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
