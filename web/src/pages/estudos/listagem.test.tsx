import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "@heroui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarDate } from "@internationalized/date";
import { AuthProvider } from "../../context/AuthContext";
import { AUTH_STORAGE_KEY } from "../../services/auth";
import type { UserRole } from "../../types/auth";
import type { EstudoApi } from "../../types/estudo";
import { ListagemEstudosPage } from "./listagem";

// Mantém o contrato de datas ISO; a navegação interna do calendário é da biblioteca.
vi.mock("../../components/estudos/CampoData", async () => {
  const { parseDate } = await import("@internationalized/date");
  return {
    CampoData: ({
      label,
      value,
      onChange,
      isDisabled,
      errorMessage,
    }: {
      label: string;
      value: CalendarDate | null;
      onChange: (value: CalendarDate | null) => void;
      isDisabled?: boolean;
      errorMessage?: string;
    }) => (
      <label>
        {label}
        <input
          type="date"
          aria-label={label}
          value={value?.toString() ?? ""}
          disabled={isDisabled}
          onChange={(event) =>
            onChange(event.target.value ? parseDate(event.target.value) : null)
          }
        />
        {errorMessage && <span>{errorMessage}</span>}
      </label>
    ),
  };
});

const estudo: EstudoApi = {
  id: 3,
  title: "Estudo do sono",
  objective: "Avaliar hábitos",
  responsibleUserId: 11,
  startDate: "2026-11-01",
  endDate: "2026-12-01",
  participantLimit: 30,
};

function resposta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function renderPage(role: UserRole = "RESEARCHER", autenticado = true) {
  if (autenticado)
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        accessToken: "token-pesquisador",
        tokenType: "Bearer",
        expiresAt: Date.now() + 3600000,
        user: {
          id: 7,
          name: "Ana Silva",
          email: "ana@example.test",
          role,
          active: true,
        },
      }),
    );
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/estudos"]}>
        <Routes>
          <Route path="/estudos" element={<ListagemEstudosPage />} />
          <Route path="/login" element={<p>Tela de login</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(toast, "success").mockReturnValue("toast-teste");
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("estudos conectados à API", () => {
  it("mostra carregamento e depois o estado vazio, liberando o cadastro", async () => {
    let concluir!: (response: Response) => void;
    const pendente = new Promise<Response>((resolve) => {
      concluir = resolve;
    });
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(pendente);
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Carregando estudos...",
    );
    expect(screen.getByRole("button", { name: "Novo estudo" })).toBeDisabled();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    await act(async () => concluir(resposta([])));
    expect(
      await screen.findByText("Nenhum estudo encontrado"),
    ).toBeInTheDocument();
    expect(screen.getByText("Exibindo 0 de 0 estudos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo estudo" })).toBeEnabled();
  });

  it("lista e busca os registros reais sem inventar status ou participantes", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        resposta([
          estudo,
          {
            ...estudo,
            id: 4,
            title: "Estudo cardiovascular",
            responsibleUserId: 7,
          },
        ]),
      );
    renderPage();
    await screen.findByText(estudo.title);
    expect(screen.getByText("Pesquisador #11")).toBeInTheDocument();
    expect(screen.getByText("Ana Silva")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Limite de participantes" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Status" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Participantes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Filtrar por status"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Resumo dos estudos"),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar por nome do estudo"), {
      target: { value: "  SONO  " },
    });
    expect(screen.queryByText("Estudo cardiovascular")).not.toBeInTheDocument();
    expect(screen.getByText(estudo.title)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar por nome do estudo"), {
      target: { value: "inexistente" },
    });
    expect(screen.getByText("Nenhum estudo encontrado")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar por nome do estudo"), {
      target: { value: "" },
    });
    expect(screen.getByText("Estudo cardiovascular")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization"),
    ).toBe("Bearer token-pesquisador");
  });

  it("cadastra no backend com o pesquisador logado e usa a resposta do servidor", async () => {
    const novo = {
      ...estudo,
      id: 42,
      title: "Novo estudo",
      responsibleUserId: 7,
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(resposta([]))
      .mockResolvedValueOnce(resposta(novo, 201));
    renderPage();
    await screen.findByText("Nenhum estudo encontrado");
    fireEvent.click(screen.getByRole("button", { name: "Novo estudo" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Nome do estudo/), {
      target: { value: " Novo estudo " },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Objetivo/), {
      target: { value: " Avaliar hábitos " },
    });
    fireEvent.change(within(dialog).getByLabelText("Data de início"), {
      target: { value: "2026-11-01" },
    });
    fireEvent.change(within(dialog).getByLabelText("Data de término"), {
      target: { value: "2026-12-01" },
    });
    fireEvent.change(
      within(dialog).getByLabelText(/^Limite de participantes/),
      { target: { value: "30" } },
    );
    expect(within(dialog).getByText("Ana Silva")).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Cadastrar estudo" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/studies");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(String(options?.body))).toEqual({
      title: "Novo estudo",
      objective: "Avaliar hábitos",
      responsibleUserId: 7,
      startDate: "2026-11-01",
      endDate: "2026-12-01",
      participantLimit: 30,
    });
    expect(
      screen.getByRole("rowheader", { name: "Novo estudo" }),
    ).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith(
      "Estudo cadastrado com sucesso.",
    );
  });

  it("preserva outro responsável na edição e bloqueia o formulário até o PUT terminar", async () => {
    let concluir!: (value: Response) => void;
    const pendente = new Promise<Response>((resolve) => {
      concluir = resolve;
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(resposta([estudo]))
      .mockReturnValueOnce(pendente);
    renderPage();
    await screen.findByText(estudo.title);
    fireEvent.click(
      screen.getByRole("button", { name: `Editar estudo: ${estudo.title}` }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Objetivo/), {
      target: { value: "Novo objetivo" },
    });
    expect(within(dialog).getByText("Pesquisador #11")).toBeInTheDocument();
    expect(
      within(dialog).queryByLabelText("Status do estudo"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(within(dialog).getByLabelText(/^Nome do estudo/)).toBeDisabled();
    expect(within(dialog).getByLabelText("Data de início")).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Fechar modal" }),
    ).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/studies/3");
    expect(options?.method).toBe("PUT");
    const { id: _id, ...dados } = estudo;
    expect(JSON.parse(String(options?.body))).toEqual({
      ...dados,
      objective: "Novo objetivo",
    });
    await act(async () =>
      concluir(
        resposta({
          ...estudo,
          title: "Nome retornado pela API",
          objective: "Novo objetivo",
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Nome retornado pela API")).toBeInTheDocument();
  });

  it("mantém o modal e os dados digitados quando uma regra do backend rejeita a edição", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(resposta([estudo]))
      .mockResolvedValueOnce(
        resposta(
          { detail: "O pesquisador responsável pelo estudo deve estar ativo." },
          400,
        ),
      );
    renderPage();
    await screen.findByText(estudo.title);
    fireEvent.click(
      screen.getByRole("button", { name: `Editar estudo: ${estudo.title}` }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Nome do estudo/), {
      target: { value: "Alteração não salva" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Salvar alterações" }),
    );
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(
      "O pesquisador responsável pelo estudo deve estar ativo.",
    );
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(within(dialog).getByLabelText(/^Nome do estudo/)).toHaveValue(
      "Alteração não salva",
    );
    expect(screen.getByText(estudo.title)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("descarta a edição cancelada sem alterar a tabela nem enviar requisição", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(resposta([estudo]));
    renderPage();
    await screen.findByText(estudo.title);
    fireEvent.click(
      screen.getByRole("button", { name: `Editar estudo: ${estudo.title}` }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Nome do estudo/), {
      target: { value: "Alteração descartada" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("rowheader", { name: estudo.title }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: `Editar estudo: ${estudo.title}` }),
    );
    const novoDialog = await screen.findByRole("dialog");
    expect(within(novoDialog).getByLabelText(/^Nome do estudo/)).toHaveValue(
      estudo.title,
    );
  });

  it("valida objetivo, limite inteiro e datas antes de enviar", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(resposta([estudo]));
    renderPage();
    await screen.findByText(estudo.title);
    fireEvent.click(
      screen.getByRole("button", { name: `Editar estudo: ${estudo.title}` }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Objetivo/), {
      target: { value: " " },
    });
    fireEvent.change(
      within(dialog).getByLabelText(/^Limite de participantes/),
      { target: { value: "1.5" } },
    );
    fireEvent.change(within(dialog).getByLabelText("Data de término"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Salvar alterações" }),
    );
    expect(
      await screen.findByText("Informe o objetivo do estudo."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Informe um limite inteiro/)).toBeInTheDocument();
    expect(
      screen.getByText(/A data de término deve ser igual/),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("não usa mocks quando a listagem falha e permite tentar novamente", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(resposta([estudo]));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os estudos.",
    );
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText(estudo.title)).toBeInTheDocument();
  });

  it.each([
    [401, "Sua sessão não é mais válida. Entre novamente para continuar."],
    [403, "Você não tem permissão para consultar estudos."],
  ] as const)(
    "trata a resposta HTTP %s na listagem sem mostrar dados",
    async (status, mensagem) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        resposta({ detail: "Acesso negado." }, status),
      );
      renderPage();
      expect(await screen.findByRole("alert")).toHaveTextContent(mensagem);
      expect(screen.queryByRole("grid")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Novo estudo" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("link", { name: "Ir para o login" }),
      ).toHaveAttribute("href", "/login");
    },
  );

  it.each<UserRole>(["ADMINISTRATOR", "COORDINATOR", "PARTICIPANT"])(
    "não chama a API para o perfil %s",
    (role) => {
      const fetchMock = vi.spyOn(globalThis, "fetch");
      renderPage(role);
      expect(screen.getByText("Acesso restrito")).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("redireciona para login quando não há sessão", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderPage("RESEARCHER", false);
    expect(screen.getByText("Tela de login")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
