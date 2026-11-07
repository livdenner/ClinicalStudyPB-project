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

const acoesTransicao = /Abrir recrutamento|Iniciar execução|Encerrar estudo/;

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
        expect(screen.queryByRole("button", { name: acoesTransicao })).not.toBeInTheDocument();
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

    it.each([
        {
            origem: "PLANNING",
            rotuloOrigem: "Planejamento",
            destino: "RECRUITMENT",
            rotuloDestino: "Recrutamento",
            acao: "Abrir recrutamento",
        },
        {
            origem: "RECRUITMENT",
            rotuloOrigem: "Recrutamento",
            destino: "EXECUTION",
            rotuloDestino: "Em execução",
            acao: "Iniciar execução",
        },
        {
            origem: "EXECUTION",
            rotuloOrigem: "Em execução",
            destino: "CLOSED",
            rotuloDestino: "Encerrado",
            acao: "Encerrar estudo",
        },
    ] as const)(
        "oferece apenas a ação válida e confirma $origem → $destino",
        async ({ origem, rotuloOrigem, destino, rotuloDestino, acao }) => {
            const proprio = { ...estudo, responsibleUserId: 7, status: origem };
            const fetchMock = vi
                .spyOn(globalThis, "fetch")
                .mockResolvedValueOnce(resposta(proprio))
                .mockResolvedValueOnce(resposta({ ...proprio, status: destino, version: 1 }));
            renderPage();
            const botao = await screen.findByRole("button", { name: acao });
            expect(screen.getAllByRole("button", { name: acoesTransicao })).toHaveLength(1);
            expect(
                within(screen.getByLabelText("Resumo do estudo")).getByText(rotuloOrigem)
            ).toBeInTheDocument();
            fireEvent.click(botao);
            const dialog = await screen.findByRole("dialog", { name: acao });
            expect(fetchMock).toHaveBeenCalledTimes(1);
            fireEvent.click(within(dialog).getByRole("button", { name: acao }));

            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
            expect(
                within(screen.getByLabelText("Resumo do estudo")).getByText(rotuloDestino)
            ).toBeInTheDocument();
            expect(fetchMock).toHaveBeenCalledTimes(2);
            const [, options] = fetchMock.mock.calls[1];
            expect(JSON.parse(String(options?.body))).toEqual({
                status: destino,
                expectedStatus: origem,
            });
        }
    );

    it("mantém o estudo encerrado sem botões de edição ou transição para o responsável", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta({ ...estudo, responsibleUserId: 7, status: "CLOSED" }));
        renderPage();
        await screen.findByRole("heading", { name: estudo.title });
        expect(
            within(screen.getByLabelText("Resumo do estudo")).getByText("Encerrado")
        ).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: acoesTransicao })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Editar estudo" })).not.toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("cancela a confirmação sem alterar o estado ou enviar uma transição", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta({ ...estudo, responsibleUserId: 7 }));
        renderPage();
        fireEvent.click(await screen.findByRole("button", { name: "Abrir recrutamento" }));
        const dialog = await screen.findByRole("dialog", { name: "Abrir recrutamento" });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(
            within(screen.getByLabelText("Resumo do estudo")).getByText("Planejamento")
        ).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(toast.success).not.toHaveBeenCalled();
    });

    it.each([
        {
            status: 400,
            corpo: {
                message: "Dados inválidos.",
                fieldErrors: [{ field: "expectedStatus", message: "Informe o estado consultado." }],
            },
            mensagem: "Não foi possível alterar o estado: Informe o estado consultado.",
        },
        {
            status: 403,
            corpo: { detail: "Somente o responsável pode alterar o estudo." },
            mensagem: "Você não tem permissão para realizar esta ação.",
        },
    ])(
        "preserva o estado quando a API recusa a transição com HTTP $status",
        async ({ status, corpo, mensagem }) => {
            const proprio = { ...estudo, responsibleUserId: 7 };
            const fetchMock = vi
                .spyOn(globalThis, "fetch")
                .mockResolvedValueOnce(resposta(proprio))
                .mockResolvedValueOnce(resposta(corpo, status));
            renderPage();
            fireEvent.click(await screen.findByRole("button", { name: "Abrir recrutamento" }));
            const dialog = await screen.findByRole("dialog", { name: "Abrir recrutamento" });
            fireEvent.click(within(dialog).getByRole("button", { name: "Abrir recrutamento" }));

            expect(await within(dialog).findByRole("alert")).toHaveTextContent(mensagem);
            expect(
                within(screen.getByLabelText("Resumo do estudo")).getByText("Planejamento")
            ).toBeInTheDocument();
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(toast.success).not.toHaveBeenCalled();
        }
    );

    it("mostra o motivo do conflito e permite atualizar antes de uma nova transição", async () => {
        const proprio = { ...estudo, responsibleUserId: 7 };
        const motivo = "O estado do estudo foi alterado por outra operação.";
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(proprio))
            .mockResolvedValueOnce(resposta({ detail: motivo }, 409))
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
        expect(fetchMock).toHaveBeenCalledTimes(2);

        fireEvent.click(within(dialog).getByRole("button", { name: "Atualizar estudo" }));
        await screen.findByRole("button", { name: "Iniciar execução" });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls[2][0]).toBe("/api/studies/3");
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
            expect(screen.queryByRole("button", { name: acoesTransicao })).not.toBeInTheDocument();
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
