/**
 * Setup Wizard de IMBIO
 *
 * Se muestra la primera vez que se abre la app, cuando no hay
 * config.json en %ProgramData%\IMBIO\.
 *
 * El usuario elige:
 * - SERVIDOR: instala Node + PostgreSQL + backend, configura servicios
 * - CLIENTE: solo guarda la URL del servidor remoto
 */

import { useState } from "react";
import { Server, Monitor, Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invoke } from "@tauri-apps/api/core";

type SetupMode = "server" | "client";
type SetupStatus = "idle" | "running" | "success" | "error";

export function SetupPage() {
  const [mode, setMode] = useState<SetupMode>("server");
  const [serverUrl, setServerUrl] = useState("http://");
  const [status, setStatus] = useState<SetupStatus>("idle");
  const [message, setMessage] = useState<string>("");

  const runSetup = async () => {
    setStatus("running");
    setMessage("Iniciando configuración...");
    try {
      const result = await invoke<{ success: boolean; exitCode: number; stderr: string }>(
        "run_setup",
        {
          mode,
          serverUrl: mode === "client" ? serverUrl : null,
        }
      );

      if (result.success) {
        setStatus("success");
        setMessage(
          mode === "server"
            ? "Servidor instalado correctamente. Reiniciando..."
            : "Cliente configurado. Reiniciando..."
        );
        // Recargar después de 2 segundos
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setStatus("error");
        setMessage(
          `La instalación falló (código ${result.exitCode}). ${
            result.stderr || "Revisa la ventana de PowerShell que se abrió."
          }`
        );
      }
    } catch (err) {
      setStatus("error");
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-2">
            <span className="text-3xl">🌳</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Bienvenido a IMBIO</h1>
          <p className="text-slate-600">
            Esta es la primera vez que abres IMBIO en esta PC.
            <br />
            Selecciona cómo se usará esta computadora:
          </p>
        </div>

        {/* Status actual */}
        {status === "idle" && (
          <>
            {/* Selección de modo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SERVIDOR */}
              <button
                type="button"
                onClick={() => setMode("server")}
                className={`p-6 rounded-xl border-2 text-left transition-all ${
                  mode === "server"
                    ? "border-emerald-500 bg-emerald-50 shadow-md"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Server
                    className={`h-6 w-6 mt-1 ${
                      mode === "server" ? "text-emerald-600" : "text-slate-400"
                    }`}
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">Servidor</h3>
                    <p className="text-sm text-slate-600">
                      Instala Node.js, PostgreSQL y el backend. Esta PC será la que tenga
                      la base de datos. Las demás PCs se conectarán aquí.
                    </p>
                    <p className="text-xs text-amber-600 mt-2">
                      ⚠ Requiere internet para descargar dependencias
                    </p>
                  </div>
                </div>
              </button>

              {/* CLIENTE */}
              <button
                type="button"
                onClick={() => setMode("client")}
                className={`p-6 rounded-xl border-2 text-left transition-all ${
                  mode === "client"
                    ? "border-blue-500 bg-blue-50 shadow-md"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Monitor
                    className={`h-6 w-6 mt-1 ${
                      mode === "client" ? "text-blue-600" : "text-slate-400"
                    }`}
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">Cliente</h3>
                    <p className="text-sm text-slate-600">
                      Solo configura la URL del servidor. Las demás PCs ya tendrán su
                      servidor configurado.
                    </p>
                    <p className="text-xs text-blue-600 mt-2">
                      No requiere internet (solo acceso a la LAN)
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* URL del servidor (solo cliente) */}
            {mode === "client" && (
              <div className="space-y-2 p-4 bg-slate-50 rounded-lg">
                <Label htmlFor="serverUrl" className="text-base">
                  URL del servidor IMBIO
                </Label>
                <Input
                  id="serverUrl"
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://192.168.0.10:3000"
                  className="font-mono"
                />
                <p className="text-xs text-slate-500">
                  Pide esta URL al administrador de la PC servidor
                </p>
              </div>
            )}

            {/* Botón de ejecutar */}
            <Button
              onClick={runSetup}
              disabled={mode === "client" && !serverUrl.startsWith("http")}
              size="lg"
              className="w-full"
            >
              {mode === "server" ? (
                <>
                  <Server className="h-5 w-5" />
                  Instalar como Servidor
                </>
              ) : (
                <>
                  <Monitor className="h-5 w-5" />
                  Configurar como Cliente
                </>
              )}
            </Button>
          </>
        )}

        {/* Status: running */}
        {status === "running" && (
          <div className="text-center space-y-4 py-8">
            <Loader2 className="h-12 w-12 mx-auto text-blue-600 animate-spin" />
            <p className="text-slate-700 font-medium">{message}</p>
            <p className="text-sm text-slate-500">
              Se abrió una ventana de PowerShell con el progreso.
              <br />
              No la cierres hasta que termine.
            </p>
          </div>
        )}

        {/* Status: success */}
        {status === "success" && (
          <div className="text-center space-y-4 py-8">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600" />
            <p className="text-slate-900 font-medium">{message}</p>
            <p className="text-sm text-slate-500">La página se va a recargar automáticamente.</p>
          </div>
        )}

        {/* Status: error */}
        {status === "error" && (
          <div className="space-y-4">
            <div className="text-center space-y-4 py-4">
              <XCircle className="h-12 w-12 mx-auto text-red-600" />
              <p className="text-slate-900 font-medium">Error en la instalación</p>
              <p className="text-sm text-slate-600 bg-red-50 p-3 rounded border border-red-200 text-left">
                {message}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={runSetup} variant="outline" className="flex-1">
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </Button>
              <Button
                onClick={() => setStatus("idle")}
                variant="ghost"
                className="flex-1"
              >
                Volver
              </Button>
            </div>
            <p className="text-xs text-slate-500 text-center">
              Log completo en: <code className="bg-slate-100 px-1 rounded">C:\ProgramData\IMBIO\logs\install.log</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SetupPage;
