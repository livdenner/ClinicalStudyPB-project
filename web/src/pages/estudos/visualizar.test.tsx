import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Tabs, toast } from "@heroui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as requisitosTransicao from "../../services/requisitos-transicao";
import { App } from "../../main";
import { AuthProvider } from "../../context/AuthContext";
import { AUTH_STORAGE_KEY } from "../../services/auth";
import type { UserRole } from "../../types/auth";
import type { EstudoApi } from "../../types/estudo";

const estudo: EstudoApi = {
    version: 0,
    status: "PLANNING",
    id: 3,
    title: "Estudo do sono",
    objective: "Avaliar hábitos de sono.",
    responsibleUserId: 11,
    startDate: "2026-11-01",
    endDate: "2026-12-01",
    participantLimit: 30,
};

function resposta(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status });
}

function renderPage(path = "/estudos/3", role: UserRole = "RESEARCHER", autenticado = true) {
    if (autenticado)
        sessionStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({
                accessToken: "token-pesquisador",
                tokenType: "Bearer",
                expiresAt: Date.now() + 3600000,
                user: { id: 7, name: "Ana Silva", email: "ana@example.test", role, active: true },
            })
        );
    return render(
        <AuthProvider>
            <MemoryRouter initialEntries={[path]}>
                <App />
            </MemoryRouter>
        </AuthProvider>
    );
}

async function encontrarAcaoEstado(nome: string) {
    const abrir = await screen.findByRole("button", { name: "Alterar estado" });
    if (abrir.getAttribute("aria-expanded") !== "true") fireEvent.click(abrir);
    const acao = await screen.findByRole("menuitem", { name: nome });
    await waitFor(() => expect(acao).not.toHaveAttribute("aria-disabled", "true"));
    return acao;
}

beforeEach(() => {
    vi.spyOn(requisitosTransicao, "verificarRequisitosTransicao").mockResolvedValue(null);
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(toast, "success").mockReturnValue("toast-teste");
});

afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
});

describe("visualização de estudos", () => {
    it("cancela a consulta pendente quando a página é desmontada", async () => {
        let concluir!: (response: Response) => void;
        const pendente = new Promise<Response>((resolve) => {
            concluir = resolve;
        });
        const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValueOnce(pendente);
        const { unmount } = renderPage();
        expect(screen.getByRole("status")).toHaveTextContent("Carregando estudo...");
        const signal = fetchMock.mock.calls[0][1]?.signal;
        expect(signal?.aborted).toBe(false);
        unmount();
        expect(signal?.aborted).toBe(true);
        await act(async () => concluir(resposta(estudo)));
    });
    it("abre pelo link do card e consulta o endpoint do estudo selecionado", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([estudo]))
            .mockResolvedValueOnce(
                resposta({ ...estudo, title: "Nome retornado pela consulta individual" })
            );
        renderPage("/estudos");
        const tabela = await screen.findByRole("list", { name: "Lista de estudos clínicos" });
        fireEvent.click(
            await within(tabela).findByRole("link", { name: "Visualizar estudo: Estudo do sono" })
        );

        expect(
            await screen.findByRole("heading", { name: "Nome retornado pela consulta individual" })
        ).toBeInTheDocument();
        const [url, options] = fetchMock.mock.calls[1];
        expect(url).toBe("/api/studies/3");
        expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer token-pesquisador");
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it.each<UserRole>(["RESEARCHER", "COORDINATOR"])(
        "carrega os detalhes em modo de consulta para %s",
        async (role) => {
            const fetchMock = vi
                .spyOn(globalThis, "fetch")
                .mockResolvedValueOnce(resposta(estudo))
                .mockResolvedValueOnce(resposta([]));
            renderPage("/estudos/3", role);
            expect(screen.getByRole("status")).toHaveTextContent("Carregando estudo...");
            expect(await screen.findByRole("heading", { name: estudo.title })).toBeInTheDocument();
            expect(screen.getByText("Estudo #3")).toBeInTheDocument();
            expect(screen.getByText(estudo.objective)).toBeInTheDocument();
            const resumo = screen.getByLabelText("Resumo do estudo");
            expect(within(resumo).getByText("Pesquisador #11")).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Editar estudo" })).not.toBeInTheDocument();
            expect(
                screen.queryByRole("button", { name: "Abrir recrutamento" })
            ).not.toBeInTheDocument();
            expect(within(resumo).getByText("30")).toBeInTheDocument();
            expect(within(resumo).getByText("01/11/2026 – 01/12/2026")).toBeInTheDocument();
            expect(screen.getByRole("link", { name: /Voltar para estudos/i })).toHaveAttribute(
                "href",
                "/estudos"
            );
            expect(screen.getByRole("tab", { name: "Visão geral" })).toHaveAttribute(
                "aria-selected",
                "true"
            );
            expect(screen.getByRole("tab", { name: "Critérios" })).toBeInTheDocument();
            expect(screen.getByRole("tab", { name: "Visitas previstas" })).toBeInTheDocument();
            expect(screen.queryByText("Progresso de inclusão")).not.toBeInTheDocument();
            expect(screen.queryByText("Status do estudo")).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole("link", { name: /Voltar para estudos/i }));
            expect(
                await screen.findByRole("heading", { name: "Estudos clínicos" })
            ).toBeInTheDocument();
            await screen.findByText("Nenhum estudo encontrado");
            expect(fetchMock.mock.calls[1][0]).toBe("/api/studies");
        }
    );

    it("libera as ações do estudo após falha nas visitas e permite recuperar a aba", async () => {
        vi.spyOn(Tabs, "Indicator").mockImplementation(() => <span aria-hidden="true" />);
        const proprio = { ...estudo, responsibleUserId: 7 };
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(proprio))
            .mockResolvedValueOnce(resposta(proprio))
            .mockResolvedValueOnce(resposta({ detail: "Falha ao carregar as visitas." }, 500))
            .mockResolvedValueOnce(resposta(proprio))
            .mockResolvedValueOnce(resposta([]));
        renderPage();
        fireEvent.click(await screen.findByRole("tab", { name: "Visitas previstas" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar as visitas.");
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Editar estudo" })).toBeEnabled()
        );
        expect(screen.getByRole("button", { name: "Cadastrar visita" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Atualizar visitas previstas" }));
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Cadastrar visita" })).toBeEnabled()
        );
        expect(
            screen.getByRole("heading", { name: "Nenhuma visita prevista" })
        ).toBeInTheDocument();
    });

    it("confirma a transição do responsável e atualiza o estado pela resposta da API", async () => {
        const proprio = { ...estudo, responsibleUserId: 7 };
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(proprio))
            .mockResolvedValueOnce(resposta({ ...proprio, status: "RECRUITMENT" }));
        renderPage();
        fireEvent.click(await encontrarAcaoEstado("Abrir recrutamento"));
        const dialog = await screen.findByRole("dialog", { name: "Abrir recrutamento" });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        fireEvent.click(within(dialog).getByRole("button", { name: "Abrir recrutamento" }));
        await encontrarAcaoEstado("Iniciar execução");
        expect(dialog).not.toBeInTheDocument();
        const [url, options] = fetchMock.mock.calls[1];
        expect(url).toBe("/api/studies/3/status");
        expect(options?.method).toBe("PATCH");
        expect(JSON.parse(String(options?.body))).toEqual({
            status: "RECRUITMENT",
            expectedStatus: "PLANNING",
        });
        expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer token-pesquisador");
    });

    it("mostra o motivo do conflito e permite atualizar antes de uma nova transição", async () => {
        const proprio = { ...estudo, responsibleUserId: 7 };
        const motivo = "O estudo foi alterado. Atualize os dados antes de tentar novamente.";
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(proprio))
            .mockResolvedValueOnce(resposta({ detail: motivo }, 409))
            .mockResolvedValueOnce(resposta({ ...proprio, status: "RECRUITMENT" }))
            .mockResolvedValueOnce(resposta({ ...proprio, status: "RECRUITMENT" }));
        renderPage();
        fireEvent.click(await encontrarAcaoEstado("Abrir recrutamento"));
        const dialog = await screen.findByRole("dialog", { name: "Abrir recrutamento" });
        fireEvent.click(within(dialog).getByRole("button", { name: "Abrir recrutamento" }));

        const alerta = await within(dialog).findByRole("alert");
        expect(alerta).toHaveTextContent(motivo);
        await waitFor(() => expect(alerta).toHaveFocus());
        expect(
            within(dialog).queryByRole("button", { name: "Abrir recrutamento" })
        ).not.toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(3);

        fireEvent.click(within(dialog).getByRole("button", { name: "Atualizar estudo" }));
        await encontrarAcaoEstado("Iniciar execução");
        expect(dialog).not.toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(4);
        expect(fetchMock.mock.calls[3][0]).toBe("/api/studies/3");
    });

    it("retorna do recrutamento ao planejamento após confirmação", async () => {
        const proprio = { ...estudo, responsibleUserId: 7, status: "RECRUITMENT" };
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(proprio))
            .mockResolvedValueOnce(resposta({ ...proprio, status: "PLANNING" }));
        renderPage();
        fireEvent.click(await encontrarAcaoEstado("Voltar ao planejamento"));
        const dialog = await screen.findByRole("dialog", { name: "Voltar ao planejamento" });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        fireEvent.click(within(dialog).getByRole("button", { name: "Voltar ao planejamento" }));
        await encontrarAcaoEstado("Abrir recrutamento");
        expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
            status: "PLANNING",
            expectedStatus: "RECRUITMENT",
        });
    });

    it("exige justificativa para cancelar e envia o texto sem espaços nas extremidades", async () => {
        const proprio = { ...estudo, responsibleUserId: 7 };
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(proprio))
            .mockResolvedValueOnce(resposta({ ...proprio, status: "CANCELLED" }))
            .mockResolvedValueOnce(
                resposta([{ id: 20, fromStatus: "PLANNING", toStatus: "CANCELLED" }])
            );
        renderPage();
        fireEvent.click(await encontrarAcaoEstado("Cancelar estudo"));
        const dialog = await screen.findByRole("dialog", { name: "Cancelar estudo" });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar estudo" }));
        expect(
            await within(dialog).findByText("Informe uma justificativa de até 1000 caracteres.")
        ).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        fireEvent.change(within(dialog).getByLabelText(/^Justificativa/), {
            target: { value: "  Estudo suspenso pelo patrocinador.  " },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar estudo" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
            status: "CANCELLED",
            expectedStatus: "PLANNING",
            reason: "Estudo suspenso pelo patrocinador.",
        });
        expect(await encontrarAcaoEstado("Restaurar estudo")).toBeInTheDocument();
    });

    it.each(["PLANNING", "RECRUITMENT"])(
        "restaura cancelamento para a origem %s consultada no histórico",
        async (origem) => {
            const proprio = { ...estudo, responsibleUserId: 7, status: "CANCELLED" };
            const fetchMock = vi
                .spyOn(globalThis, "fetch")
                .mockResolvedValueOnce(resposta(proprio))
                .mockResolvedValueOnce(
                    resposta([{ id: 20, fromStatus: origem, toStatus: "CANCELLED" }])
                )
                .mockResolvedValueOnce(resposta({ ...proprio, status: origem }));
            renderPage();
            fireEvent.click(await encontrarAcaoEstado("Restaurar estudo"));
            const dialog = await screen.findByRole("dialog", { name: "Restaurar estudo" });
            fireEvent.click(within(dialog).getByRole("button", { name: "Restaurar estudo" }));
            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
            expect(fetchMock.mock.calls[1][0]).toBe("/api/studies/3/status-history");
            expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({
                status: origem,
                expectedStatus: "CANCELLED",
            });
        }
    );

    it("mantém o estudo visível após falha do histórico e permite repetir somente essa consulta", async () => {
        let concluirHistorico!: (response: Response) => void;
        const historicoPendente = new Promise<Response>((resolve) => {
            concluirHistorico = resolve;
        });
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                resposta({ ...estudo, responsibleUserId: 7, status: "CANCELLED" })
            )
            .mockResolvedValueOnce(resposta({ detail: "Histórico indisponível." }, 500))
            .mockReturnValueOnce(historicoPendente);
        renderPage();
        expect(await screen.findByRole("heading", { name: estudo.title })).toBeInTheDocument();
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Não foi possível verificar a restauração do estudo."
        );
        expect(screen.getByText(estudo.objective)).toBeInTheDocument();
        expect(
            screen.queryByRole("heading", { name: "Não foi possível abrir o estudo" })
        ).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Restaurar estudo" })).not.toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: "Tentar consultar histórico novamente" })
        );
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
        expect(screen.getByRole("heading", { name: estudo.title })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Restaurar estudo" })).not.toBeInTheDocument();
        await act(async () =>
            concluirHistorico(resposta([{ id: 20, fromStatus: "PLANNING", toStatus: "CANCELLED" }]))
        );
        expect(await encontrarAcaoEstado("Restaurar estudo")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            "/api/studies/3",
            "/api/studies/3/status-history",
            "/api/studies/3/status-history",
        ]);
    });

    it.each(["EXECUTION", "CLOSED"])(
        "não restaura cancelamento originado de %s",
        async (origem) => {
            const fetchMock = vi
                .spyOn(globalThis, "fetch")
                .mockResolvedValueOnce(
                    resposta({ ...estudo, responsibleUserId: 7, status: "CANCELLED" })
                )
                .mockResolvedValueOnce(
                    resposta([{ id: 20, fromStatus: origem, toStatus: "CANCELLED" }])
                );
            renderPage();
            await screen.findByRole("heading", { name: estudo.title });
            expect(
                screen.queryByRole("button", { name: "Restaurar estudo" })
            ).not.toBeInTheDocument();
            expect(
                screen.queryByRole("button", { name: "Cancelar estudo" })
            ).not.toBeInTheDocument();
            expect(fetchMock).toHaveBeenCalledTimes(2);
        }
    );

    it("mostra a pré-condição do HTTP 409 sem exigir atualização de estado", async () => {
        const proprio = { ...estudo, responsibleUserId: 7 };
        const motivo = "Cadastre uma visita prevista com atividade antes de abrir o recrutamento.";
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(proprio))
            .mockResolvedValueOnce(resposta({ detail: motivo }, 409))
            .mockResolvedValueOnce(resposta(proprio));
        renderPage();
        fireEvent.click(await encontrarAcaoEstado("Abrir recrutamento"));
        const dialog = await screen.findByRole("dialog", { name: "Abrir recrutamento" });
        fireEvent.click(within(dialog).getByRole("button", { name: "Abrir recrutamento" }));
        expect(await within(dialog).findByRole("alert")).toHaveTextContent(motivo);
        expect(
            within(dialog).queryByRole("button", { name: "Atualizar estudo" })
        ).not.toBeInTheDocument();
        expect(within(dialog).getByRole("button", { name: "Abrir recrutamento" })).toBeEnabled();
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("edita pelo modal existente, mantém o responsável e atualiza os detalhes após sucesso", async () => {
        const atualizado = {
            ...estudo,
            responsibleUserId: 7,
            objective: "Objetivo atualizado",
            participantLimit: 40,
        };
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta({ ...estudo, responsibleUserId: 7 }))
            .mockResolvedValueOnce(resposta(atualizado));
        renderPage();
        fireEvent.click(await screen.findByRole("button", { name: "Editar estudo" }));
        const dialog = await screen.findByRole("dialog");
        fireEvent.change(within(dialog).getByLabelText(/^Objetivo/), {
            target: { value: atualizado.objective },
        });
        fireEvent.change(within(dialog).getByLabelText(/^Limite de participantes/), {
            target: { value: "40" },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        const [url, options] = fetchMock.mock.calls[1];
        expect(url).toBe("/api/studies/3");
        expect(options?.method).toBe("PUT");
        const { id: _id, status: _status, version: _version, ...dados } = atualizado;
        expect(JSON.parse(String(options?.body))).toEqual(dados);
        expect(screen.getByText(atualizado.objective)).toBeInTheDocument();
        expect(
            within(screen.getByLabelText("Resumo do estudo")).getByText("40")
        ).toBeInTheDocument();
        expect(toast.success).toHaveBeenCalledWith("Estudo atualizado com sucesso.");
    });

    it.each(["abc", "0", "-2", "1.5", "9007199254740992"])(
        "não chama a API para o identificador inválido %s",
        (id) => {
            const fetchMock = vi.spyOn(globalThis, "fetch");
            renderPage(`/estudos/${id}`);
            expect(
                screen.getByRole("heading", { name: "Estudo não encontrado" })
            ).toBeInTheDocument();
            expect(fetchMock).not.toHaveBeenCalled();
        }
    );

    it("mostra estudo não encontrado quando a API devolve 404", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            resposta({ detail: "Estudo não encontrado: 3" }, 404)
        );
        renderPage();
        expect(
            await screen.findByRole("heading", { name: "Estudo não encontrado" })
        ).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Editar estudo" })).not.toBeInTheDocument();
    });

    it("permite tentar novamente após uma falha de conexão", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(resposta({ ...estudo, responsibleUserId: 7 }));
        renderPage();
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Não foi possível carregar o estudo."
        );
        fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
        await screen.findByRole("heading", { name: estudo.title });
        expect(
            within(screen.getByLabelText("Resumo do estudo")).getByText("Ana Silva")
        ).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it.each([
        [401, "Sua sessão expirou. Entre novamente."],
        [403, "Você não tem permissão para realizar esta ação."],
    ])("trata a resposta HTTP %s sem exibir os detalhes", async (status, mensagem) => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            resposta({ detail: "Acesso negado." }, status as number)
        );
        renderPage();
        expect(await screen.findByRole("alert")).toHaveTextContent(String(mensagem));
        expect(screen.queryByLabelText("Resumo do estudo")).not.toBeInTheDocument();
    });

    it.each<UserRole>(["ADMINISTRATOR", "PARTICIPANT"])(
        "não consulta o estudo para o perfil %s",
        (role) => {
            const fetchMock = vi.spyOn(globalThis, "fetch");
            renderPage("/estudos/3", role);
            expect(screen.getByRole("heading", { name: "Acesso negado" })).toBeInTheDocument();
            expect(screen.getByText("403")).toBeInTheDocument();
            expect(fetchMock).not.toHaveBeenCalled();
        }
    );

    it("redireciona para login sem sessão", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch");
        renderPage("/estudos/3", "RESEARCHER", false);
        expect(
            await screen.findByRole("heading", { name: /Acesso ao sistema/i })
        ).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

it("carrega participantes apenas ao abrir a aba do estudo", async () => {
    vi.spyOn(Tabs, "Indicator").mockImplementation(() => <span aria-hidden="true" />);
    const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(resposta(estudo))
        .mockResolvedValueOnce(resposta([]));
    renderPage();
    await screen.findByRole("heading", { name: estudo.title });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("tab", { name: "Participantes" }));
    expect(await screen.findByText("Nenhum participante incluído")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/studies/3/participants");
});

const cenariosAcoes = [
    { status: "PLANNING", protocoloEditavel: true },
    { status: "RECRUITMENT", protocoloEditavel: true },
    { status: "EXECUTION", protocoloEditavel: false },
    { status: "CLOSED", protocoloEditavel: false },
    { status: "CANCELLED", protocoloEditavel: false },
].flatMap(({ status, protocoloEditavel }) =>
    [
        { papel: "responsável", role: "RESEARCHER" as const, responsavel: true },
        { papel: "outro pesquisador", role: "RESEARCHER" as const, responsavel: false },
        { papel: "coordenador", role: "COORDINATOR" as const, responsavel: false },
    ].map((perfil) => ({
        ...perfil,
        status,
        editavel: perfil.responsavel && protocoloEditavel,
    }))
);

it.each(cenariosAcoes)(
    "T24.5 — Hierarquia das ações: no máximo uma primária nas quatro abas em $status para $papel",
    async ({ status, role, responsavel, editavel }) => {
        vi.spyOn(Tabs, "Indicator").mockImplementation(() => <span aria-hidden="true" />);
        const atual = { ...estudo, status, responsibleUserId: responsavel ? 7 : 11 };
        vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
            if (String(url) === "/api/studies/3") return resposta(atual);
            if (String(url).endsWith("/status-history"))
                return resposta([{ id: 20, fromStatus: "PLANNING", toStatus: "CANCELLED" }]);
            return resposta([]);
        });
        renderPage("/estudos/3", role);
        await screen.findByRole("heading", { name: estudo.title });

        for (const aba of ["Visão geral", "Critérios", "Visitas previstas", "Participantes"]) {
            fireEvent.click(screen.getByRole("tab", { name: aba }));
            if (aba === "Critérios")
                await screen.findByText("Nenhum critério de inclusão cadastrado.");
            if (aba === "Visitas previstas")
                await screen.findByRole("heading", { name: "Nenhuma visita prevista" });
            if (aba === "Participantes") await screen.findByText("Nenhum participante incluído");

            const editar = screen.queryByRole("button", { name: "Editar estudo" });
            if (editavel) {
                expect(editar).toHaveClass("button--primary");
                await waitFor(() => expect(editar).toBeEnabled());
            } else {
                expect(editar).not.toBeInTheDocument();
            }

            if (aba === "Critérios" || aba === "Visitas previstas") {
                const criar = screen.queryByRole("button", {
                    name: aba === "Critérios" ? "Cadastrar critério" : "Cadastrar visita",
                });
                if (editavel) {
                    expect(criar).toBeEnabled();
                    expect(criar).not.toHaveClass("button--primary");
                } else {
                    expect(criar).not.toBeInTheDocument();
                    expect(
                        within(
                            screen.getByRole("region", {
                                name:
                                    aba === "Critérios"
                                        ? "Critérios do estudo"
                                        : "Visitas previstas",
                            })
                        ).getByText("Somente leitura")
                    ).toBeVisible();
                }
            }

            const candidatos = screen.queryByRole("link", { name: "Gerenciar candidatos" });
            if (role === "COORDINATOR" && status === "RECRUITMENT")
                expect(candidatos).toHaveAttribute("href", "/recrutamento?studyId=3");
            else expect(candidatos).not.toBeInTheDocument();

            const controles = [
                ...screen.queryAllByRole("button"),
                ...screen.queryAllByRole("link"),
            ];
            expect(
                controles.filter((controle) => controle.classList.contains("button--primary"))
            ).toHaveLength(editavel ? 1 : 0);
        }
    }
);

it("T24.5 — Confirmação de estado: Voltar preserva o estudo sem enviar alteração", async () => {
    const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(resposta({ ...estudo, responsibleUserId: 7 }));
    renderPage();
    fireEvent.click(await encontrarAcaoEstado("Cancelar estudo"));
    const dialog = await screen.findByRole("dialog", { name: "Cancelar estudo" });
    fireEvent.change(within(dialog).getByLabelText("Justificativa"), {
        target: { value: "Cancelamento não confirmado" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Voltar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(
        within(screen.getByLabelText("Resumo do estudo")).getByText("Planejamento")
    ).toBeInTheDocument();
});

it("T24.1: coordenador abre o recrutamento com o estudo atual selecionado", async () => {
    vi.spyOn(Tabs, "Indicator").mockImplementation(() => <span aria-hidden="true" />);
    const atual = { ...estudo, status: "RECRUITMENT" };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        if (String(url) === "/api/studies/3") return resposta(atual);
        if (String(url) === "/api/studies") return resposta([{ ...estudo, id: 99 }, atual]);
        return resposta([]);
    });
    renderPage("/estudos/3", "COORDINATOR");
    const link = await screen.findByRole("link", { name: "Gerenciar candidatos" });
    expect(link).toHaveAttribute("href", "/recrutamento?studyId=3");
    const cabecalho = screen.getByRole("heading", { name: estudo.title }).closest("header")!;
    expect(within(cabecalho).getByRole("link", { name: "Gerenciar candidatos" })).toBe(link);
    const sobre = screen.getByRole("region", { name: "Sobre o estudo" });
    expect(
        within(sobre).queryByRole("link", { name: "Gerenciar candidatos" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recrutar" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Participantes" }));
    await screen.findByText("Nenhum participante incluído");
    expect(within(cabecalho).getByRole("link", { name: "Gerenciar candidatos" })).toBe(link);
    fireEvent.click(link);
    await screen.findByText("Nenhum candidato encontrado");
    expect(screen.getByLabelText("Estudo clínico")).toHaveValue("3");
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/studies/99/"))).toBe(
        false
    );
});

it.each<[UserRole, EstudoApi["status"]]>([
    ["COORDINATOR", "PLANNING"],
    ["COORDINATOR", "EXECUTION"],
    ["COORDINATOR", "CLOSED"],
    ["COORDINATOR", "CANCELLED"],
    ["RESEARCHER", "RECRUITMENT"],
])("T24.1: não oferece Gerenciar candidatos para %s em %s", async (role, status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(resposta({ ...estudo, status }));
    renderPage("/estudos/3", role);
    await screen.findByRole("heading", { name: estudo.title });
    expect(screen.queryByRole("link", { name: "Gerenciar candidatos" })).not.toBeInTheDocument();
});
