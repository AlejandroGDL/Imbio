/**
 * LoginPage — Pantalla de inicio de sesión.
 *
 * Flujo:
 * 1. El usuario VE primero el server selector (URL del backend).
 *    Si ya está guardado, se salta este paso.
 * 2. Luego el form de login (username + password).
 * 3. Al hacer POST /auth/login correctamente, redirige a ?next= o
 *    /dashboard por defecto.
 *
 * Si el usuario es ADMIN, después de iniciar sesión puede gestionar
 * otros usuarios desde la página de Configuración.
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  Server,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Leaf,
  Lock,
  User as UserIcon,
  Wifi,
  RefreshCw,
  Network,
  Globe,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { getServerUrl, setServerUrl, getMode } from "@/lib/config";
import {
  detectLocalIps,
  candidateSubnetsFromClient,
  ipsFromSubnets,
  parseSubnet,
  probeHealth,
  scanSubnetForServer,
  type DetectedIp,
} from "@/lib/lan-detect";
import type { NetworkInfo } from "@/types/api";

// =================================================================
// Validación
// =================================================================
const loginSchema = z.object({
  username: z.string().trim().min(1, "Usuario requerido").max(50),
  password: z.string().min(1, "Contraseña requerida").max(200),
});

type LoginForm = z.infer<typeof loginSchema>;

// =================================================================
// Subcomponente: ServerSelector
// =================================================================
interface ServerSelectorProps {
  initialUrl: string;
  onConnected: () => void;
}

function ServerSelector({ initialUrl, onConnected }: ServerSelectorProps) {
  // En modo cliente, NO mostramos detección de LAN ni escaneo.
  // Solo el input manual de IP.
  const mode = getMode();
  const isClient = mode === "client";

  const [url, setUrl] = useState(initialUrl);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "ok" | "fail"
  >("idle");
  const [message, setMessage] = useState<string>("");

  // IPs detectadas del cliente (WebRTC) + lista de servidores encontrados
  const [clientIps, setClientIps] = useState<DetectedIp[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    checked: number;
    total: number;
  } | null>(null);
  const [foundServers, setFoundServers] = useState<string[]>([]);
  const [manualIp, setManualIp] = useState("");
  const [probingManual, setProbingManual] = useState(false);
  // Subredes adicionales que el usuario quiere escanear
  const [customSubnets, setCustomSubnets] = useState<string[]>([]);
  const [newSubnet, setNewSubnet] = useState("");

  // URLs reportadas por el servidor (/network)
  const [serverLanUrls, setServerLanUrls] = useState<string[]>([]);
  const [loadingNetwork, setLoadingNetwork] = useState(false);

  // Detectar IPs locales al montar (solo en modo cliente — el
  // server ya sabe su URL porque corre en la misma PC)
  useEffect(() => {
    if (!isClient) return;
    let cancelled = false;
    void (async () => {
      const ips = await detectLocalIps();
      if (!cancelled) setClientIps(ips);
    })();
    return () => {
      cancelled = true;
    };
  }, [isClient]);

  const fetchServerNetwork = async (baseUrl: string) => {
    setLoadingNetwork(true);
    try {
      // api.network() lee getServerUrl(), así que lo seteamos primero
      setServerUrl(baseUrl);
      const info: NetworkInfo = await api.network();
      setServerLanUrls(info.urls || []);
    } catch {
      setServerLanUrls([]);
    } finally {
      setLoadingNetwork(false);
    }
  };

  const checkServer = async (): Promise<boolean> => {
    const normalized = normalizeUrl(url);
    setChecking(true);
    setStatus("idle");
    setMessage("");
    setServerUrl(normalized);
    try {
      const info = await api.health();
      setStatus("ok");
      setMessage(`Conectado a ${info.service} · ${info.timestamp}`);
      // Aprovechamos para pedir las URLs LAN del servidor
      void fetchServerNetwork(normalized);
      return true;
    } catch (err) {
      setStatus("fail");
      setMessage(
        err instanceof ApiError
          ? `No se pudo conectar: ${err.message}`
          : "No se pudo conectar con el servidor",
      );
      setServerLanUrls([]);
      return false;
    } finally {
      setChecking(false);
    }
  };

  const handleContinue = () => {
    if (status !== "ok") {
      toast.error("Verifica la conexión primero");
      return;
    }
    onConnected();
  };

  // Escanear IPs candidatas en múltiples subredes
  const scanSubnet = async (mode: "fast" | "full" = "full") => {
    setScanning(true);
    setFoundServers([]);
    setScanProgress(null);
    const port = getPortFromUrl(url) || 3000;
    // IPs del cliente que sean LAN
    const lanClients = clientIps.filter(
      (i) => i.family === "IPv4" && i.isLan,
    );
    if (lanClients.length === 0) {
      toast.error("No se detectaron IPs de LAN en tu PC", {
        description:
          "El navegador no expuso tu IP local. Usa el input manual para escribir la IP del servidor.",
      });
      setScanning(false);
      return;
    }
    // Generar lista de subredes a escanear
    const subnets = candidateSubnetsFromClient(
      lanClients[0].ip,
      customSubnets,
    );
    const ips = ipsFromSubnets(subnets, mode);
    const totalSubnets = subnets.length;
    const startMsg = mode === "fast"
      ? `Escaneando IPs comunes en ${totalSubnets} subred(es): ${subnets.slice(0, 3).join(", ")}${totalSubnets > 3 ? "..." : ""}`
      : `Escaneando ${ips.length} IPs en ${totalSubnets} subred(es) (~${Math.ceil(ips.length / 30)}s)...`;
    toast.info("Escaneando red local", { description: startMsg });

    const found = await scanSubnetForServer(
      ips,
      port,
      30,
      (checked, total, foundSoFar) => {
        setScanProgress({ checked, total });
        setFoundServers(foundSoFar);
      },
    );
    setScanning(false);
    setScanProgress(null);
    if (found.length === 0) {
      toast.error("No se encontró ningún servidor IMBIO", {
        description: `Probamos ${ips.length} IPs en ${totalSubnets} subred(es) con puerto ${port}.${
          customSubnets.length === 0
            ? " Agrega subredes manualmente abajo si tu server está en otro segmento."
            : ""
        }`,
      });
    } else {
      toast.success(`Encontramos ${found.length} servidor(es)`, {
        description: "Haz clic en una URL para usarla.",
      });
    }
  };

  const useServer = async (serverUrl: string) => {
    setUrl(serverUrl);
    setStatus("idle");
    setMessage("");
    // checkServer usa el state actual `url` para probar, pero como
    // acabamos de setearlo, esperamos un microtask antes de llamarlo.
    await Promise.resolve();
    const ok = await checkServer();
    if (ok) onConnected();
  };

  const lanClients = clientIps.filter(
    (i) => i.family === "IPv4" && i.isLan,
  );

  // Agregar una subred custom a la lista de escaneo
  const addSubnet = () => {
    const parsed = parseSubnet(newSubnet);
    if (!parsed) {
      toast.error("Subred inválida", {
        description: "Usa el formato X.X.X (ej. 10.0.0, 192.168.5)",
      });
      return;
    }
    if (customSubnets.includes(parsed)) {
      toast.info("Esa subred ya está en la lista");
      return;
    }
    setCustomSubnets((subs) => [...subs, parsed]);
    setNewSubnet("");
    toast.success(`Subred ${parsed}.x agregada al escaneo`);
  };

  // Probar una IP específica (manual, cuando WebRTC no detecta)
  const probeManualIp = async () => {
    const trimmed = manualIp.trim();
    if (!trimmed) {
      toast.error("Escribe una IP o hostname");
      return;
    }
    const port = getPortFromUrl(url) || 3000;
    // Si parece un hostname (contiene letras), no le agregamos :port
    const hasLetters = /[a-zA-Z]/.test(trimmed);
    const urlToTest = hasLetters
      ? (trimmed.startsWith("http") ? trimmed : `http://${trimmed}`)
      : (trimmed.startsWith("http") ? trimmed : `http://${trimmed}:${port}`);
    setProbingManual(true);
    try {
      const ok = await probeHealth(urlToTest);
      if (ok) {
        toast.success("¡Servidor encontrado!", { description: urlToTest });
        await useServer(urlToTest);
      } else {
        toast.error("No responde", {
          description: `${urlToTest} no devolvió un servidor IMBIO válido.`,
        });
      }
    } catch (err) {
      toast.error("Error al probar", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setProbingManual(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="serverUrl">URL del servidor backend</Label>
        <div className="relative">
          <Server className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="serverUrl"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setStatus("idle");
              setMessage("");
            }}
            placeholder="http://192.168.0.100:3000"
            className="pl-9 font-mono text-sm"
            disabled={checking}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void checkServer();
              }
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Escribe la IP o hostname del servidor IMBIO. Si lo corres en
          tu misma PC, usa <span className="font-mono">localhost</span>.
        </p>
      </div>

      {/* IPs detectadas en el cliente (solo modo cliente — el
          server no necesita escanear su propia red) */}
      {isClient && clientIps.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Wifi className="h-3.5 w-3.5" />
            Tu PC en la LAN
            {lanClients.length === 0 && (
              <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-normal text-amber-700">
                sin IP privada
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {clientIps
              .filter((i) => i.family === "IPv4")
              .map((ip) => (
                <button
                  key={ip.ip}
                  type="button"
                  onClick={() =>
                    void useServer(
                      `http://${ip.ip}:${getPortFromUrl(url) || 3000}`,
                    )
                  }
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                    ip.isLan
                      ? "border-slate-200 bg-white text-slate-700 hover:border-imbio-green-400 hover:bg-imbio-green-50 hover:text-imbio-green-700"
                      : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100",
                  )}
                  title={
                    ip.isLan
                      ? "Click para probar y usar esta IP"
                      : "IP no es privada (LAN). Probá igual por si el server está aquí."
                  }
                >
                  <Network className="h-2.5 w-2.5" />
                  {ip.ip}
                </button>
              ))}
          </div>
        </div>
      )}


      {/* Progreso del escaneo */}
      {scanning && scanProgress && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-sky-800">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Escaneando…
            </span>
            <span className="font-mono text-[11px] text-sky-700">
              {scanProgress.checked}/{scanProgress.total} ({Math.round((scanProgress.checked / scanProgress.total) * 100)}%)
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-sky-100">
            <div
              className="h-full bg-sky-500 transition-all duration-200"
              style={{
                width: `${(scanProgress.checked / scanProgress.total) * 100}%`,
              }}
            />
          </div>
          {foundServers.length > 0 && (
            <p className="mt-1.5 text-[10px] text-sky-700">
              ¡{foundServers.length} servidor(es) encontrado(s) hasta ahora!
            </p>
          )}
        </div>
      )}

      {/* Servidores encontrados al escanear (solo modo cliente) */}
      {isClient && foundServers.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Servidores IMBIO encontrados ({foundServers.length})
          </div>
          <div className="space-y-1.5">
            {foundServers.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void useServer(s)}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-emerald-300 bg-white px-2.5 py-1.5 text-left font-mono text-[11px] text-slate-700 transition-colors hover:border-emerald-500 hover:bg-emerald-100"
              >
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3 w-3 text-emerald-600" />
                  {s}
                </span>
                <span className="text-[10px] font-semibold text-emerald-700">
                  Usar →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* URLs reportadas por el servidor actual */}
      {(serverLanUrls.length > 0 || loadingNetwork) && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-sky-800">
            <Server className="h-3.5 w-3.5" />
            Este servidor también responde en
            {loadingNetwork && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          {serverLanUrls.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {serverLanUrls.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void useServer(s)}
                  className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-white px-2 py-1 font-mono text-[11px] text-sky-700 transition-colors hover:border-sky-500 hover:bg-sky-100"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-sky-700/70">
              No se detectaron otras IPs de LAN en este servidor.
            </p>
          )}
        </div>
      )}

      {status === "ok" && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {status === "fail" && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span>{message}</span>
        </div>
      )}

      {/* Subredes adicionales a escanear (solo modo cliente) */}
      {isClient && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-violet-800">
          <Network className="h-3.5 w-3.5" />
          Subredes a escanear
          {customSubnets.length > 0 && (
            <span className="ml-1 rounded-full bg-violet-200 px-1.5 py-0.5 text-[9px] font-normal text-violet-700">
              +{customSubnets.length} personalizada(s)
            </span>
          )}
        </div>
        {customSubnets.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {customSubnets.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-md border border-violet-300 bg-white px-2 py-0.5 font-mono text-[11px] text-violet-700"
              >
                {s}.x
                <button
                  type="button"
                  onClick={() =>
                    setCustomSubnets((subs) => subs.filter((x) => x !== s))
                  }
                  className="ml-0.5 rounded p-0.5 text-violet-400 hover:bg-violet-100 hover:text-violet-700"
                  title="Quitar"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={newSubnet}
            onChange={(e) => setNewSubnet(e.target.value)}
            placeholder="Ej. 10.0.0, 172.20.0, 192.168.5"
            className="h-8 flex-1 font-mono text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSubnet();
              }
            }}
          />
          <Button
            type="button"
            onClick={addSubnet}
            disabled={!newSubnet.trim()}
            size="sm"
            variant="outline"
            className="h-8"
          >
            Agregar
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-violet-700">
          Por defecto: tu subred + adyacentes + 10.0.0-1, 192.168.0-2,
          172.16.0/4/8/16, 172.17-18. Agrega las que falten.
        </p>
      </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={checkServer}
          disabled={checking || !url.trim()}
          variant="outline"
          className="flex-1"
        >
          {checking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Probando…
            </>
          ) : (
            <>
              <Server className="h-4 w-4" />
              Probar conexión
            </>
          )}
        </Button>
        {isClient && (
          <>
            <Button
              type="button"
              onClick={() => void scanSubnet("fast")}
              disabled={scanning}
              variant="outline"
              title="Buscar servidores IMBIO en IPs comunes de la subred (~30 IPs, rápido)"
            >
              {scanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Escaneando…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Escaneo rápido
                </>
              )}
            </Button>
            <Button
              type="button"
              onClick={() => void scanSubnet("full")}
              disabled={scanning}
              variant="ghost"
              title="Escanear toda la subred /24 (254 IPs, ~15s)"
              className="text-xs"
            >
              {scanning ? null : "Escanear 254 IPs (~15s)"}
            </Button>
          </>
        )}
        <Button
          type="button"
          onClick={handleContinue}
          disabled={status !== "ok"}
          className="flex-1 bg-gradient-to-r from-imbio-green-500 to-imbio-green-700 hover:from-imbio-green-600 hover:to-imbio-green-800"
        >
          Continuar
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// =================================================================
// Helpers
// =================================================================
function getPortFromUrl(url: string): number | null {
  try {
    const m = url.match(/:(\d+)(?:\/|$)/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

// =================================================================
// Subcomponente: LoginForm
// =================================================================
interface LoginFormSectionProps {
  serverUrl: string;
  onChangeServer: () => void;
  onSuccess: () => void;
}

function LoginFormSection({ serverUrl, onChangeServer, onSuccess }: LoginFormSectionProps) {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    setSubmitting(true);
    try {
      await login(data.username, data.password);
      toast.success("Sesión iniciada", {
        description: `Bienvenido, ${data.username}`,
      });
      onSuccess();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "No se pudo iniciar sesión";
      toast.error("Error de inicio de sesión", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="username">Usuario</Label>
        <div className="relative">
          <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="username"
            autoComplete="username"
            autoFocus
            placeholder="admin"
            className={cn(
              "pl-9",
              errors.username && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("username")}
          />
        </div>
        {errors.username && (
          <p className="text-xs text-red-600">{errors.username.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className={cn(
              "pl-9 pr-9",
              errors.password && "border-red-500 focus-visible:ring-red-500",
            )}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
            title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-600">{errors.password.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className="w-full bg-gradient-to-r from-imbio-green-500 to-imbio-green-700 hover:from-imbio-green-600 hover:to-imbio-green-800"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Iniciando sesión…
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" />
            Iniciar sesión
          </>
        )}
      </Button>

      <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span className="truncate font-mono" title={serverUrl}>
          {serverUrl}
        </span>
        <button
          type="button"
          onClick={onChangeServer}
          className="font-medium text-imbio-green-700 hover:underline"
        >
          Cambiar servidor
        </button>
      </div>
    </form>
  );
}

// =================================================================
// Página principal
// =================================================================
export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, initialized } = useAuth();
  const [serverUrl, setServerUrlState] = useState<string>(() => getServerUrl());
  const [step, setStep] = useState<"server" | "login">(() => {
    // Si ya hay un server configurado, vamos directo al login.
    return getServerUrl() ? "login" : "server";
  });

  // Si ya hay sesión activa, salimos del login
  useEffect(() => {
    if (initialized && user) {
      const next = params.get("next") || "/dashboard";
      navigate(next, { replace: true });
    }
  }, [initialized, user, navigate, params]);

  const handleServerOk = () => {
    setServerUrlState(getServerUrl());
    setStep("login");
  };

  const handleLoginSuccess = () => {
    const next = params.get("next") || "/dashboard";
    navigate(next, { replace: true });
  };

  const handleChangeServer = () => {
    setStep("server");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-imbio-green-50 via-white to-slate-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo / brand */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-imbio-green-500 to-imbio-green-700 text-white shadow-lg">
            <Leaf className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">IMBIO</h1>
          <p className="text-sm text-slate-600">
            Sistema de Gestión · Pabellón de Arteaga
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          {getMode() === "client" && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] text-sky-800">
              <Network className="h-3.5 w-3.5" />
              <span className="font-semibold">Modo Cliente</span>

            </div>
          )}
          {getMode() === "server" && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-imbio-green-200 bg-imbio-green-50 px-3 py-1.5 text-[11px] text-imbio-green-800">
              <Server className="h-3.5 w-3.5" />
              <span className="font-semibold">Modo Servidor</span>
            </div>
          )}
          {step === "server" ? (
            <>
              <h2 className="mb-1 text-lg font-semibold text-slate-900">
                Conectar al servidor
              </h2>
              <p className="mb-5 text-sm text-slate-600">
                Primero indícale a la app dónde está el servidor backend.
              </p>
              <ServerSelector
                initialUrl={serverUrl}
                onConnected={handleServerOk}
              />
            </>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-semibold text-slate-900">
                Iniciar sesión
              </h2>
              <p className="mb-5 text-sm text-slate-600">
                Ingresa tus credenciales para acceder al sistema.
              </p>
              <LoginFormSection
                serverUrl={serverUrl}
                onChangeServer={handleChangeServer}
                onSuccess={handleLoginSuccess}
              />
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Acceso restringido al personal autorizado del IMBIO.
        </p>
      </div>
    </div>
  );
}

// =================================================================
// Helper
// =================================================================
function normalizeUrl(url: string): string {
  let trimmed = url.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = "http://" + trimmed;
  }
  return trimmed.replace(/\/+$/, "");
}
