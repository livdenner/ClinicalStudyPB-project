import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components";

import "./styles.css";
import { NotFoundPage } from "./pages/not-found";
import { ListagemEstudosPage } from "./pages/estudos/listagem";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/estudos" element={<ListagemEstudosPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
