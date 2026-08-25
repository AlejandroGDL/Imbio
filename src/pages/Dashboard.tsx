/**
 * Dashboard — página principal de la app.
 * Muestra un resumen con:
 *   - Stats (contadores por módulo)
 *   - Cumpleaños próximos del personal (30 días)
 *   - Correspondencia con respuesta próxima o vencida
 *   - Áreas verdes próximas a ser utilizadas (30 días)
 *   - Accesos rápidos a módulos principales
 */

import { useEffect, useState } from "react";
import {
  Cake,
  Mail,
  UserCog,
  ClipboardList,
  Package,
  ShieldCheck,
  Leaf,
  AlertCircle,
  RefreshCw,
  Loader2,
  ArrowRight,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { CumpleanosList } from "@/components/dashboard/CumpleanosList";
import { CorrespondenciaAlertasList } from "@/components/dashboard/CorrespondenciaAlertasList";
import { AreasVerdesProximasList } from "@/components/dashboard/AreasVerdesProximasList";
import { EventosCorrespondenciaList } from "@/components/dashboard/EventosCorrespondenciaList";

import { useServerStatus } from "@/hooks/use-server-status";
import { api, ApiError } from "@/lib/api";
import type { DashboardData } from "@/types/api";

function getSaludo(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function formatFechaCompleta(): string {
  const d = new Date();
  const dias = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]}`;
}

export function DashboardPage() {
  const { status } = useServerStatus();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.obtenerDashboard();
      setData(res);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Error al cargar el dashboard",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "online") {
      load();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const stats = data?.stats;
  const cumpleanos = data?.cumpleanosProximos ?? [];
  const correspondencia = data?.correspondenciaPendiente ?? [];
  const areasVerdes = data?.areasVerdesProximas ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inicio"
        description={`${getSaludo()}, hoy es ${formatFechaCompleta()}. Aquí tienes el resumen del IMBIO.`}
        icon={ArrowRight}
        gradient="from-emerald-500 to-teal-600"
        actions={
          <Button
            variant="outline"
            onClick={load}
            disabled={loading}
            title="Recargar"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Actualizar
          </Button>
        }
      />

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
          <div>
            <p className="font-medium text-red-900">No se pudo cargar el dashboard</p>
            <p className="mt-1 text-red-800">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={load}
              className="mt-2"
            >
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {status === "offline" && !error && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-900">Servidor desconectado</p>
            <p className="mt-1 text-amber-800">
              Ve a <strong>Configuración</strong> y verifica la URL del servidor.
            </p>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          Cargando resumen…
        </div>
      )}

      {data && (
        <>
          {/* ===== Stats (grid 2x4 en lg) ===== */}
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Resumen general
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Personal"
                value={stats?.personal ?? 0}
                icon={UserCog}
                gradient="from-indigo-500 to-blue-600"
              />
              <StatCard
                label="Requisiciones"
                value={stats?.requisiciones.total ?? 0}
                extra={`${stats?.requisiciones.pendientes ?? 0} pendientes de surtir`}
                icon={ClipboardList}
                gradient="from-cyan-500 to-teal-600"
                alert={
                  (stats?.requisiciones.pendientes ?? 0) > 0
                    ? {
                        count: stats!.requisiciones.pendientes,
                        label: "pendientes",
                      }
                    : undefined
                }
              />
              <StatCard
                label="Consumibles"
                value={stats?.consumibles.total ?? 0}
                extra={`${stats?.consumibles.sinStock ?? 0} sin stock · ${stats?.consumibles.stockBajo ?? 0} stock bajo`}
                icon={Package}
                gradient="from-rose-500 to-pink-600"
                alert={
                  (stats?.consumibles.sinStock ?? 0) + (stats?.consumibles.stockBajo ?? 0) > 0
                    ? {
                        count:
                          stats!.consumibles.sinStock +
                          stats!.consumibles.stockBajo,
                        label: "alertas",
                      }
                    : undefined
                }
              />
              <StatCard
                label="Resguardos"
                value={stats?.resguardos.total ?? 0}
                extra={`${stats?.resguardos.asignados ?? 0} asignados · ${stats?.resguardos.enBodega ?? 0} en bodega`}
                icon={ShieldCheck}
                gradient="from-fuchsia-500 to-purple-600"
              />
            </div>
          </div>

          {/* ===== Listas detalladas (2 columnas en lg) ===== */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cake className="h-4 w-4 text-pink-600" />
                  Próximos cumpleaños
                  {cumpleanos.length > 0 && (
                    <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-pink-100 px-1.5 text-[11px] font-bold text-pink-700">
                      {cumpleanos.length}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Personal que cumple años en los próximos 30 días
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CumpleanosList items={cumpleanos} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4 text-violet-600" />
                  Eventos de correspondencia
                  {data?.eventosCorrespondencia &&
                    data.eventosCorrespondencia.length > 0 && (
                      <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-violet-100 px-1.5 text-[11px] font-bold text-violet-700">
                        {data.eventosCorrespondencia.length}
                      </span>
                    )}
                </CardTitle>
                <CardDescription>
                  Reuniones/juntas marcadas en correspondencia con personal asignado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventosCorrespondenciaList
                  items={data?.eventosCorrespondencia ?? []}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Leaf className="h-4 w-4 text-lime-600" />
                  Áreas Verdes próximas
                  {areasVerdes.length > 0 && (
                    <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-lime-100 px-1.5 text-[11px] font-bold text-lime-700">
                      {areasVerdes.length}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Espacios reservados en los próximos 30 días
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AreasVerdesProximasList items={areasVerdes} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4 text-amber-600" />
                  Correspondencia con respuesta pendiente
                  {correspondencia.length > 0 && (
                    <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[11px] font-bold text-amber-700">
                      {correspondencia.length}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Documentos que requieren seguimiento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CorrespondenciaAlertasList items={correspondencia} />
              </CardContent>
            </Card>
          </div>

          {/* Pie de página */}
          <div className="flex items-center justify-center gap-1.5 pb-2 pt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Actualizado al{" "}
            {new Date().toLocaleString("es-MX", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </>
      )}
    </div>
  );
}
