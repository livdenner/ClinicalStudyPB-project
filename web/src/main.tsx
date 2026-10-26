import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toast } from "@heroui/react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components";
import { AuthProvider, useAuth } from "./context/AuthContext";

import "./styles.css";
import { NotFoundPage } from "./pages/not-found";
import { ListagemEstudosPage } from "./pages/estudos/listagem";
import { VisualizarEstudoPage } from "./pages/estudos/visualizar";
import { LoginPage } from "./pages/login/login";
import { ListagemUsuariosPage } from "./pages/usuarios/listagem";

function RootRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? "/estudos" : "/login"} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route path="/estudos" element={<ListagemEstudosPage />} />
        <Route path="/estudos/:id" element={<VisualizarEstudoPage />} />
        <Route path="/usuarios" element={<ListagemUsuariosPage />} />
        <Route path="*" element={<NotFoundPage />} />
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
