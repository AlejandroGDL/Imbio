import { Navigate, Route, Routes } from "react-router-dom";

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

function App() {
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
