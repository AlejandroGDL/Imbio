import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { initConfig } from "@/lib/config";
import { invoke } from "@tauri-apps/api/core";

import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import LoginPage from "@/pages/Login";
import { CiudadanosPage } from "@/pages/Ciudadanos";
import { PersonalPage } from "@/pages/Personal";
import { TramitesPage } from "@/pages/Tramites";
import { ServiciosPage } from "@/pages/Servicios";
import { AreasVerdesPage } from "@/pages/AreasVerdes";
import { CorrespondenciaPage } from "@/pages/Correspondencia";
import { ConfiguracionPage } from "@/pages/Configuracion";
import { RequisicionesPage } from "@/pages/Requisiciones";
import { ConsumiblesPage } from "@/pages/Consumibles";
import { ResguardosPage } from "@/pages/Resguardos";
import { DashboardPage } from "@/pages/Dashboard";
import SetupPage from "@/pages/Setup";

type BootState = "loading" | "needs-setup" | "ready";

function App() {
  const [bootState, setBootState] = useState<BootState>("loading");

  // Al montar: pre-cargar config del instalador y detectar si
  // necesitamos mostrar el Setup Wizard.
  useEffect(() => {
    void (async () => {
      try {
        // ¿Estamos dentro de Tauri? (no en el navegador)
        const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
        if (w.__TAURI_INTERNALS__) {
          // Dentro de Tauri: chequear si hay config en disco
          const needs = await invoke<boolean>("needs_setup");
          if (needs) {
            setBootState("needs-setup");
            return;
          }
        }
        // Cargar config normalmente (localStorage o disco)
        await initConfig();
        setBootState("ready");
      } catch (err) {
        console.error("Error en boot:", err);
        // En caso de error, intentar continuar
        await initConfig();
        setBootState("ready");
      }
    })();
  }, []);

  // Mientras carga, mostrar nada (o un spinner)
  if (bootState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Cargando...</div>
      </div>
    );
  }

  // Si necesita setup, mostrar el wizard
  if (bootState === "needs-setup") {
    return <SetupPage />;
  }

  // Boot normal
  return (
    <AuthProvider>
      <Routes>
        {/* Login (público) */}
        <Route path="/login" element={<LoginPage />} />

        {/* App protegida */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ciudadanos" element={<CiudadanosPage />} />
          <Route path="/personal" element={<PersonalPage />} />
          <Route path="/tramites" element={<TramitesPage />} />
          <Route path="/requisiciones" element={<RequisicionesPage />} />
          <Route path="/consumibles" element={<ConsumiblesPage />} />
          <Route path="/resguardos" element={<ResguardosPage />} />
          <Route path="/servicios" element={<ServiciosPage />} />
          <Route path="/areas-verdes" element={<AreasVerdesPage />} />
          <Route path="/correspondencia" element={<CorrespondenciaPage />} />
          <Route
            path="/configuracion"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <ConfiguracionPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
