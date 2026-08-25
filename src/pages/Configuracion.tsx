import { useEffect, useState } from "react";
import {
  Server,
  Save,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  Building2,
  Zap,
  Calculator,
  Network,
  Copy,
  Check,
  Wifi,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { useServerStatus } from "@/hooks/use-server-status";
import { setServerUrl, getServerUrl, getMode, setMode } from "@/lib/config";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Configuracion, ServerInfo, NetworkInfo } from "@/types/api";
import { UsuariosAdmin } from "@/components/usuarios/UsuariosAdmin";

export function ConfiguracionPage() {
  const { status, database, message, serverUrl, refresh, lastChecked } = useServerStatus();

  const [draft, setDraft] = useState(serverUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  // Estado de configuración del sistema (vvuma, etc.)
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [vvumaDraft, setVvumaDraft] = useState<string>("117.31");
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingVvuma, setSavingVvuma] = useState(false);

  // Estado de red LAN
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [loadingNetwork, setLoadingNetwork] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    setDraft(serverUrl);
  }, [serverUrl]);

  // Carga info del server cuando está online
  useEffect(() => {
    if (status !== "online") {
      setInfo(null);
      return;
    }
    setLoadingInfo(true);
    setInfoError(null);
    api
      .info()
      .then(setInfo)
      .catch((err) => {
        setInfoError(err instanceof ApiError ? err.message : "Error al cargar info");
      })
      .finally(() => setLoadingInfo(false));
  }, [status, serverUrl]);

  // Carga info de red cuando está online
  const loadNetwork = () => {
    if (status !== "online") {
      setNetwork(null);
      return;
    }
    setLoadingNetwork(true);
    api
      .network()
      .then(setNetwork)
      .catch(() => setNetwork(null))
      .finally(() => setLoadingNetwork(false));
  };

  useEffect(() => {
    loadNetwork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, serverUrl]);

  // Carga la configuración del sistema (incluye vvuma)
  const loadConfig = () => {
    if (status !== "online") {
      setConfig(null);
      return;
    }
    setLoadingConfig(true);
    api
      .getConfiguracion()
      .then((c) => {
        setConfig(c);
        setVvumaDraft(c.vvuma ?? "117.31");
      })
      .catch(() => {
        setConfig(null);
      })
      .finally(() => setLoadingConfig(false));
  };

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, serverUrl]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(text);
      toast.success("URL copiada al portapapeles", { description: text });
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedUrl(text);
      toast.success("URL copiada", { description: text });
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  };

  const useUrl = (url: string) => {
    setDraft(url);
    setServerUrl(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setTimeout(refresh, 100);
    toast.success("URL del servidor actualizada", { description: url });
  };

  const handleSaveVvuma = async () => {
    const parsed = Number(vvumaDraft.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Valor inválido", {
        description: "VVUMA debe ser un número mayor o igual a 0",
      });
      return;
    }
    setSavingVvuma(true);
    try {
      const updated = await api.updateConfiguracion({ vvuma: parsed });
      setConfig(updated);
      setVvumaDraft(updated.vvuma ?? String(parsed));
      toast.success("VVUMA actualizado", {
        description: `Nuevo valor: $${parsed.toFixed(2)}`,
      });
    } catch (err) {
      toast.error("No se pudo guardar", {
        description: err instanceof ApiError ? err.message : "Error desconocido",
      });
    } finally {
      setSavingVvuma(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      setServerUrl(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // Re-checkea inmediatamente
      setTimeout(refresh, 100);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft("http://localhost:3000");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conexión al servidor, parámetros del sistema y datos institucionales.
        </p>
      </div>

      {/* ============================================================ */}
      {/* Modo de operación */}
      {/* ============================================================ */}
      <ModoOperacionCard />

      {/* ============================================================ */}
      {/* Conexión al servidor */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-imbio-green-700" />
                Servidor Backend
              </CardTitle>
              <CardDescription className="mt-1.5">
                URL del servidor Fastify donde está la base de datos PostgreSQL.
                Las PCs clientes deben apuntar a la IP de la PC servidor.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estado actual */}
          <div className="flex items-center justify-between rounded-lg border bg-slate-50/50 p-3">
            <div className="flex items-center gap-3">
              {status === "checking" && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
              {status === "online" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              {status === "offline" && <XCircle className="h-5 w-5 text-red-500" />}
              <div>
                <div className="text-sm font-medium">
                  {status === "checking" && "Conectando..."}
                  {status === "online" && "Conectado al servidor"}
                  {status === "offline" && "Sin conexión"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {status === "online" && database === "up" && "✓ Base de datos respondiendo"}
                  {status === "online" && database === "down" && "⚠ Server responde pero la DB está caída"}
                  {status === "offline" && (message || "Verifica la URL y que el server esté corriendo")}
                  {lastChecked && (
                    <span className="ml-2">
                      · Última verificación: {lastChecked.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={async () => {
                const lines: string[] = [];
                lines.push(`URL configurada: ${serverUrl}`);
                try {
                  const h = await api.health();
                  lines.push(`✓ /health: ${JSON.stringify(h)}`);
                } catch (err) {
                  lines.push(
                    `✗ /health: ${err instanceof ApiError ? `${err.code} - ${err.message}` : String(err)}`,
                  );
                }
                try {
                  const db = await api.healthDb();
                  lines.push(`✓ /health/db: ${JSON.stringify(db)}`);
                } catch (err) {
                  lines.push(
                    `✗ /health/db: ${err instanceof ApiError ? `${err.code} - ${err.message}` : String(err)}`,
                  );
                }
                try {
                  const t = await api.listarTramites({ activo: true });
                  lines.push(`✓ /tramites: ${t.length} trámites`);
                } catch (err) {
                  lines.push(
                    `✗ /tramites: ${err instanceof ApiError ? `${err.code} (${err.status}) - ${err.message}` : String(err)}`,
                  );
                }
                const summary = lines.join("\n");
                console.log("=== Diagnóstico IMBIO ===\n" + summary);
                toast.info("Diagnóstico completo (ver consola del navegador)", {
                  description: "F12 → Console para ver el detalle",
                  duration: 6000,
                });
              }}
            >
              <Zap className="h-4 w-4" />
              Probar
            </Button>
          </div>

          {/* Editor de URL */}
          <div className="space-y-2">
            <Label htmlFor="server-url">URL del Servidor</Label>
            <div className="flex gap-2">
              <Input
                id="server-url"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="http://192.168.1.50:3000"
                className="font-mono"
              />
              <Button variant="outline" onClick={handleReset} title="Restablecer a localhost">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button onClick={handleSave} disabled={saving || draft === serverUrl}>
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : saved ? "¡Guardado!" : "Guardar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <Info className="mr-1 inline h-3 w-3" />
              Ejemplos:
              <code className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">
                http://localhost:3000
              </code>
              <code className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">
                http://192.168.1.50:3000
              </code>
              <code className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">
                http://servidor.imbio.local:3000
              </code>
            </p>
            {saved && (
              <p className="text-xs font-medium text-emerald-600">
                ✓ Configuración guardada. Reconectando...
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Acceso desde otras PCs (LAN) */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-imbio-green-700" />
            Acceso desde otras PCs (LAN)
          </CardTitle>
          <CardDescription>
            Las IPs detectadas en la PC servidor. Comparte cualquiera con las
            PCs clientes para que apunten aquí. La PC cliente también debe
            abrir el frontend (Tauri o navegador) en su misma IP/puerto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status !== "online" ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-muted-foreground">
              <Wifi className="mr-1 inline h-4 w-4" />
              Conéctate al servidor para ver las IPs disponibles.
            </div>
          ) : loadingNetwork ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Detectando interfaces de red...
            </div>
          ) : !network ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              No se pudo obtener la información de red del servidor.
            </div>
          ) : network.lanIps.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="mr-1 inline h-4 w-4" />
              El servidor no detectó ninguna IP de LAN. Verifica que la PC esté
              conectada a la red y que el firewall permita el puerto{" "}
              <span className="font-mono font-semibold">{network.port}</span>.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {network.lanIps.map((ip) => {
                  const url = `http://${ip}:${network.port}`;
                  const isCurrent = getServerUrl() === url;
                  return (
                    <div
                      key={ip}
                      className={`flex items-center gap-2 rounded-lg border p-2.5 ${
                        isCurrent
                          ? "border-emerald-300 bg-emerald-50/60"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-imbio-green-100 text-imbio-green-700">
                        <Wifi className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">
                            {ip}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-600">
                            LAN
                          </span>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                              <Check className="h-2.5 w-2.5" />
                              en uso
                            </span>
                          )}
                        </div>
                        <code className="block truncate text-xs text-muted-foreground">
                          {url}
                        </code>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(url)}
                        title="Copiar URL al portapapeles"
                      >
                        {copiedUrl === url ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      {!isCurrent && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => useUrl(url)}
                          title="Usar esta URL como servidor"
                          className="bg-gradient-to-r from-imbio-green-600 to-imbio-green-700"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                          Usar
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3 text-xs text-sky-900">
                <p className="font-semibold">
                  ℹ️ Pasos para abrir el IMBIO desde otra PC:
                </p>
                <ol className="ml-4 mt-1.5 list-decimal space-y-1">
                  <li>
                    En la PC servidor:{" "}
                    <span className="font-mono">npm run dev:lan</span> (en vez de{" "}
                    <span className="font-mono">npm run dev</span>) para exponer
                    Vite a la LAN.
                  </li>
                  <li>
                    Comparte la URL de arriba con la PC cliente.
                  </li>
                  <li>
                    En la PC cliente: abre esa URL en el navegador{" "}
                    <em>o</em> instala Tauri y configura la misma URL en
                    Configuración.
                  </li>
                </ol>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Info del servidor */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-imbio-green-700" />
            Información del Servidor
          </CardTitle>
          <CardDescription>
            Datos que devuelve el backend cuando la conexión es exitosa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingInfo && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando información...
            </div>
          )}
          {infoError && !loadingInfo && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {infoError}
            </div>
          )}
          {info && !loadingInfo && (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Institución</dt>
                <dd className="font-semibold">{info.institucion}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Versión del servidor</dt>
                <dd className="font-mono">v{info.version}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Trámites activos</dt>
                <dd className="font-semibold">{info.tramitesActivos}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ciudadanos registrados</dt>
                <dd className="font-semibold">{info.ciudadanosRegistrados}</dd>
              </div>
            </dl>
          )}
          {!loadingInfo && !info && !infoError && (
            <p className="text-sm text-muted-foreground">
              Sin datos — el servidor no está conectado.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Parámetros del Sistema */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-imbio-green-700" />
            Parámetros del Sistema
          </CardTitle>
          <CardDescription>
            Variables globales que afectan al cálculo de precios. El valor de
            VVUMA se actualiza manualmente cada año.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingConfig ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando parámetros...
            </div>
          ) : status !== "online" ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-muted-foreground">
              Sin conexión al servidor. Conectate para editar los parámetros.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="vvuma" className="flex items-center gap-2">
                  <span>VVUMA</span>
                  <span className="text-xs text-muted-foreground">
                    (Valor de la UMA para cálculo de precios)
                  </span>
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="vvuma"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={vvumaDraft}
                      onChange={(e) => setVvumaDraft(e.target.value)}
                      className="pl-7 font-mono"
                      placeholder="117.31"
                    />
                  </div>
                  <Button
                    onClick={handleSaveVvuma}
                    disabled={
                      savingVvuma ||
                      !Number.isFinite(Number(vvumaDraft.replace(",", "."))) ||
                      Number(vvumaDraft.replace(",", ".")) < 0
                    }
                  >
                    {savingVvuma ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {savingVvuma ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  <Info className="mr-1 inline h-3 w-3" />
                  Ejemplo: si VVUMA = 117.31, una poda de árbol mayor o igual a
                  3m cuesta{" "}
                  <span className="font-mono font-semibold">
                    ${(117.31 * 1.5).toFixed(2)}
                  </span>{" "}
                  y una menor a 3m cuesta{" "}
                  <span className="font-mono font-semibold">
                    ${(117.31 * 0.5).toFixed(2)}
                  </span>
                  . Actualizar este valor afecta únicamente a las solicitudes
                  nuevas y a las recalculadas por cambio de altura.
                </p>
              </div>

              {config && (
                <div className="rounded-lg border bg-slate-50/50 p-3 text-xs text-slate-700">
                  <p>
                    <strong>Último valor guardado:</strong>{" "}
                    <span className="font-mono">
                      {config.vvuma
                        ? `$${Number(config.vvuma).toFixed(4)}`
                        : "—"}
                    </span>
                    {config.updatedAt && (
                      <span className="ml-2 text-muted-foreground">
                        (actualizado:{" "}
                        {new Date(config.updatedAt).toLocaleString("es-MX")})
                      </span>
                    )}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Acerca de */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <CardTitle>Acerca de IMBIO</CardTitle>
          <CardDescription>
            Sistema de Gestión de Trámites y Servicios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Aplicación</dt>
              <dd className="font-semibold">IMBIO Desktop</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Versión</dt>
              <dd className="font-mono">v0.1.0</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Frontend</dt>
              <dd className="text-xs">Tauri 2 + React 19 + TypeScript</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Backend</dt>
              <dd className="text-xs">Fastify 5 + Prisma 6 + PostgreSQL</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Gestión de Usuarios (solo ADMIN) */}
      {/* ============================================================ */}
      <UsuariosAdmin />
    </div>
  );
}

// =================================================================
// Modo de operación (Servidor / Cliente)
// =================================================================
function ModoOperacionCard() {
  const [mode, setModeState] = useState<"server" | "client">(() => getMode());
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const handleChange = (next: "server" | "client") => {
    if (next === mode) return;
    setMode(next);
    setModeState(next);
    setSavedAt(new Date());
    toast.success(
      next === "client"
        ? "Modo Cliente activado"
        : "Modo Servidor activado",
      {
        description:
          next === "client"
            ? "El login escaneará la LAN para encontrar el servidor IMBIO."
            : "Esta PC corre el backend. El login apunta a localhost por defecto.",
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5 text-imbio-green-700" />
          Modo de operación
        </CardTitle>
        <CardDescription>
          Define si esta PC corre el backend (servidor) o solo se conecta a
          un servidor remoto (cliente). Esto cambia lo que muestra el login
          y reduce la confusión cuando se instala en varias PCs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Modo Servidor */}
          <button
            type="button"
            onClick={() => handleChange("server")}
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-all",
              mode === "server"
                ? "border-imbio-green-500 bg-imbio-green-50/50 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-imbio-green-700" />
                <span className="font-semibold">Servidor</span>
              </div>
              {mode === "server" && (
                <CheckCircle2 className="h-5 w-5 text-imbio-green-600" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Esta PC <strong>sí corre el backend</strong>. Úsalo en la PC principal
              donde está la base de datos PostgreSQL. El login es simple:
              apunta a <span className="font-mono">localhost:3000</span> por defecto.
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
              <li>• URL por defecto: localhost:3000</li>
              <li>• Sin escaneo de LAN (no necesita buscar el server)</li>
              <li>• El backend debe estar corriendo en esta PC</li>
            </ul>
          </button>

          {/* Modo Cliente */}
          <button
            type="button"
            onClick={() => handleChange("client")}
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-all",
              mode === "client"
                ? "border-sky-500 bg-sky-50/50 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 text-sky-700" />
                <span className="font-semibold">Cliente</span>
              </div>
              {mode === "client" && (
                <CheckCircle2 className="h-5 w-5 text-sky-600" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Esta PC <strong>NO corre el backend</strong>. Se conecta a un
              servidor IMBIO remoto. El login incluye <strong>escaneo completo
              de LAN</strong> para encontrar el server automáticamente.
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
              <li>• Detección de IPs LAN vía WebRTC</li>
              <li>• Escaneo de subredes (172.16, 192.168, 10.0)</li>
              <li>• Probe manual de IPs remotas</li>
            </ul>
          </button>
        </div>

        {mode === "client" && (
          <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Estás en modo Cliente</p>
              <p className="mt-1 text-xs">
                Para iniciar el backend en la PC servidor, ejecuta en su
                terminal:
                <code className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 font-mono text-[11px]">
                  cd server && npm run dev
                </code>
              </p>
            </div>
          </div>
        )}

        {savedAt && (
          <p className="text-xs text-muted-foreground">
            Guardado: {savedAt.toLocaleTimeString("es-MX")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
