import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toast } from "@heroui/react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { getDefaultRouteForRole } from "./config/navigation";
import { AuthProvider, useAuth } from "./context/AuthContext";

import "./styles.css";
import { ForbiddenPage } from "./pages/forbidden";
import { NotFoundPage } from "./pages/not-found";
import { ListagemEstudosPage } from "./pages/estudos/listagem";
import { LoginPage } from "./pages/login/login";
import { ListagemUsuariosPage } from "./pages/usuarios/listagem";

function RootRedirect() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/acesso-negado" element={<ForbiddenPage />} />

          <Route
            path="/estudos"
            element={
              <ProtectedRoute allowedRoles={["RESEARCHER"]}>
                <ListagemEstudosPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/usuarios"
            element={
              <ProtectedRoute allowedRoles={["ADMINISTRATOR"]}>
                <ListagemUsuariosPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/recrutamento"
            element={
              <ProtectedRoute allowedRoles={["COORDINATOR", "RESEARCHER"]}>
                <NotFoundPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/visitas"
            element={
              <ProtectedRoute allowedRoles={["RESEARCHER", "COORDINATOR"]}>
                <NotFoundPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute
                allowedRoles={["ADMINISTRATOR", "RESEARCHER", "COORDINATOR"]}
              >
                <NotFoundPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/relatorios"
            element={
              <ProtectedRoute
                allowedRoles={["ADMINISTRATOR", "RESEARCHER", "COORDINATOR"]}
              >
                <NotFoundPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="*"
            element={
              <ProtectedRoute
                allowedRoles={["ADMINISTRATOR", "RESEARCHER", "COORDINATOR"]}
              >
                <NotFoundPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <AuthProvider>
        <BrowserRouter>
          <App />
          <Toast.Provider placement="top end" aria-label="Notificações" />
        </BrowserRouter>
      </AuthProvider>
    </StrictMode>,
  );
}