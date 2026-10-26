import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../../context/AuthContext";
import { App } from "../../main";
import { saveStoredSession } from "../../services/auth";
import type { UserRole } from "../../types/auth";

function seedSession(role: UserRole, name = "Usuário Teste") {
  saveStoredSession({
    accessToken: `jwt-${role.toLowerCase()}`,
    tokenType: "Bearer",
    expiresIn: 3600,
    user: {
      id: 10,
      name,
      email: `${role.toLowerCase()}@clinicalstudypb.test`,
      role,
      active: true,
    },
  });
}

function renderApp(initialRoute: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <App />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("Rotas protegidas e menu por perfil (T5.2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("redireciona usuário não autenticado para /login ao acessar rota protegida", async () => {
    renderApp("/estudos");

    expect(
      await screen.findByRole("heading", { name: /acesso ao sistema/i }),
    ).toBeInTheDocument();
  });

  it("exibe apenas os itens de menu permitidos para o perfil RESEARCHER", async () => {
    seedSession("RESEARCHER", "Pesquisador Demo");
    renderApp("/estudos");

    expect(
      await screen.findByRole("heading", { name: /estudos clínicos/i }),
    ).toBeInTheDocument();

    const nav = screen.getByRole("navigation", {
      name: /navegação principal/i,
    });
    expect(
      within(nav).getByRole("link", { name: /estudos clínicos/i }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole("link", { name: /visão geral/i }),
    ).toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: /usuários e acessos/i }),
    ).not.toBeInTheDocument();
  });

  it("exibe apenas os itens de menu permitidos para o perfil ADMINISTRATOR e bloqueia /estudos com 403", async () => {
    seedSession("ADMINISTRATOR", "Administrador Demo");
    renderApp("/estudos");

    expect(
      await screen.findByRole("heading", { name: /acesso negado/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("403")).toBeInTheDocument();

    const nav = screen.getByRole("navigation", {
      name: /navegação principal/i,
    });
    expect(
      within(nav).getByRole("link", { name: /usuários e acessos/i }),
    ).toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: /estudos clínicos/i }),
    ).not.toBeInTheDocument();
  });

  it("bloqueia acesso direto de RESEARCHER à rota /usuarios com página 403", async () => {
    seedSession("RESEARCHER", "Pesquisador Demo");
    renderApp("/usuarios");

    expect(
      await screen.findByRole("heading", { name: /acesso negado/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /seu perfil \(pesquisador\) não possui permissão para acessar esta área/i,
      ),
    ).toBeInTheDocument();
  });

  it("encaminha PARTICIPANT autenticado para tela 403 sem itens administrativos no menu", async () => {
    seedSession("PARTICIPANT", "Participante Demo");
    renderApp("/");

    expect(
      await screen.findByRole("heading", { name: /acesso negado/i }),
    ).toBeInTheDocument();

    const nav = screen.getByRole("navigation", {
      name: /navegação principal/i,
    });
    expect(within(nav).queryAllByRole("link")).toHaveLength(0);
  });
});
