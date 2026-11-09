import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "@heroui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
        localStorage.setItem(
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

beforeEach(() => {
    localStorage.clear();
    vi.spyOn(toast, "success").mockReturnValue("toast-teste");
});

afterEach(() => {
    cleanup();
    localStorage.clear();
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
    it("abre pelo botão da tabela e consulta o endpoint do estudo selecionado", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([estudo]))
            .mockResolvedValueOnce(
                resposta({ ...estudo, title: "Nome retornado pela consulta individual" })
            );
        renderPage("/estudos");
        const tabela = await screen.findByRole("grid", { name: "Lista de estudos clínicos" });
        fireEvent.click(
            await within(tabela).findByRole("button", { name: "Visualizar estudo: Estudo do sono" })
        );

        expect(
            await screen.findByRole("heading", { name: "Nome retornado pela consulta individual" })
        ).toBeInTheDocument();
        const [url, options] = fetchMock.mock.calls[1];
        expect(url).toBe("/api/studies/3");
        expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer token-pesquisador");
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("carrega diretamente pelo endereço e mostra somente dados disponíveis na API", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(estudo))
            .mockResolvedValueOnce(resposta([]));
        renderPage();
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
        expect(screen.queryByRole("tab")).not.toBeInTheDocument();
        expect(screen.queryByText("Progresso de inclusão")).not.toBeInTheDocument();
        expect(screen.queryByText("Status do estudo")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("link", { name: /Voltar para estudos/i }));
        expect(
            await screen.findByRole("heading", { name: "Estudos clínicos" })
        ).toBeInTheDocument();
        await screen.findByText("Nenhum estudo encontrado");
        expect(fetchMock.mock.calls[1][0]).toBe("/api/studies");
    });

    it("confirma a transição do responsável e atualiza o estado pela resposta da API", async () => {
        const proprio = { ...estudo, responsibleUserId: 7 };
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(proprio))
            .mockResolvedValueOnce(resposta({ ...proprio, status: "RECRUITMENT" }));
        renderPage();
        fireEvent.click(await screen.findByRole("button", { name: "Abrir recrutamento" }));
        const dialog = await screen.findByRole("dialog", { name: "Abrir recrutamento" });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        fireEvent.click(within(dialog).getByRole("button", { name: "Abrir recrutamento" }));
        await screen.findByRole("button", { name: "Iniciar execução" });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
        fireEvent.click(await screen.findByRole("button", { name: "Abrir recrutamento" }));
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
        await screen.findByRole("button", { name: "Iniciar execução" });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
        fireEvent.click(await screen.findByRole("button", { name: "Voltar ao planejamento" }));
        const dialog = await screen.findByRole("dialog", { name: "Voltar ao planejamento" });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        fireEvent.click(within(dialog).getByRole("button", { name: "Voltar ao planejamento" }));
        await screen.findByRole("button", { name: "Abrir recrutamento" });
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
        fireEvent.click(await screen.findByRole("button", { name: "Cancelar estudo" }));
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
        expect(await screen.findByRole("button", { name: "Restaurar estudo" })).toBeInTheDocument();
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
            fireEvent.click(await screen.findByRole("button", { name: "Restaurar estudo" }));
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
        expect(await screen.findByRole("button", { name: "Restaurar estudo" })).toBeInTheDocument();
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
        fireEvent.click(await screen.findByRole("button", { name: "Abrir recrutamento" }));
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

    it.each<UserRole>(["ADMINISTRATOR", "COORDINATOR", "PARTICIPANT"])(
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
