import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "@heroui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../context/AuthContext";
import { AUTH_STORAGE_KEY } from "../../services/auth";
import { ListagemUsuariosPage } from "./listagem";
import type { UserRole } from "../../types/auth";
import type { Usuario } from "../../types/usuario";

const usuario: Usuario = {
    id: 2,
    name: "Ana Silva",
    email: "ana@example.test",
    role: "RESEARCHER",
    active: true,
};

function resposta(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function renderPage(role: UserRole = "ADMINISTRATOR", autenticado = true) {
    if (autenticado)
        localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({
                accessToken: "token-admin",
                tokenType: "Bearer",
                expiresAt: Date.now() + 3600000,
                user: {
                    id: 1,
                    name: "Administrador",
                    email: "admin@example.test",
                    role,
                    active: true,
                },
            })
        );
    return render(
        <AuthProvider>
            <MemoryRouter initialEntries={["/usuarios"]}>
                <Routes>
                    <Route path="/usuarios" element={<ListagemUsuariosPage />} />
                    <Route path="/login" element={<p>Tela de login</p>} />
                </Routes>
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

describe("Gestão de usuários", () => {
    it("mostra carregamento até receber a lista da API", async () => {
        let concluir!: (response: Response) => void;
        const pendente = new Promise<Response>((resolve) => {
            concluir = resolve;
        });
        vi.spyOn(globalThis, "fetch").mockReturnValueOnce(pendente);
        renderPage();
        expect(screen.getByRole("status")).toHaveTextContent("Carregando usuários...");
        expect(screen.queryByRole("grid")).not.toBeInTheDocument();
        await act(async () => concluir(resposta([usuario])));
        expect(await screen.findByRole("rowheader", { name: usuario.name })).toBeInTheDocument();
        expect(screen.queryByText("Carregando usuários...")).not.toBeInTheDocument();
    });

    it("mostra estado vazio quando a API não retorna usuários", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(resposta([]));
        renderPage();
        expect(await screen.findByText("Nenhum usuário encontrado")).toBeInTheDocument();
        expect(screen.getByText("Exibindo 0 de 0 usuários")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^Editar usuário:/ })).not.toBeInTheDocument();
    });

    it("combina busca, perfil e situação e permite limpar os filtros sem novas requisições", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            resposta([
                usuario,
                {
                    ...usuario,
                    id: 3,
                    name: "Ana Costa",
                    email: "ana.costa@example.test",
                    active: false,
                },
                {
                    ...usuario,
                    id: 4,
                    name: "Bruno Lima",
                    email: "bruno@example.test",
                    role: "PARTICIPANT",
                },
            ])
        );
        renderPage();
        await screen.findByText(usuario.name);
        const busca = screen.getByLabelText("Buscar por nome ou e-mail");
        fireEvent.change(busca, { target: { value: "  ANA  " } });
        expect(screen.queryByText("Bruno Lima")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Perfil/ }));
        fireEvent.click(await screen.findByRole("option", { name: "Pesquisador" }));
        fireEvent.click(screen.getByRole("button", { name: /Situação/ }));
        fireEvent.click(await screen.findByRole("option", { name: "Inativo" }));
        expect(screen.getByText("Ana Costa")).toBeInTheDocument();
        expect(screen.queryByText(usuario.name)).not.toBeInTheDocument();
        expect(screen.getByText("Exibindo 1 de 3 usuários")).toBeInTheDocument();
        fireEvent.change(busca, { target: { value: "ANA.COSTA@" } });
        expect(screen.getByText("Ana Costa")).toBeInTheDocument();
        fireEvent.change(busca, { target: { value: "" } });
        fireEvent.click(screen.getByRole("button", { name: /Perfil/ }));
        fireEvent.click(await screen.findByRole("option", { name: "Todos os perfis" }));
        fireEvent.click(screen.getByRole("button", { name: /Situação/ }));
        fireEvent.click(await screen.findByRole("option", { name: "Todas as situações" }));
        expect(screen.getByText("Bruno Lima")).toBeInTheDocument();
        expect(screen.getByText(usuario.name)).toBeInTheDocument();
        expect(screen.getByText("Exibindo 3 de 3 usuários")).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("só desativa ao salvar e confirmar, bloqueando a requisição pendente", async () => {
        let concluir!: (response: Response) => void;
        const pendente = new Promise<Response>((resolve) => {
            concluir = resolve;
        });
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([usuario]))
            .mockReturnValueOnce(pendente);
        renderPage();
        await screen.findByText(usuario.name);
        fireEvent.click(screen.getByRole("button", { name: "Editar usuário: Ana Silva" }));
        const interruptor = await screen.findByRole("switch");
        fireEvent.click(interruptor);
        expect(interruptor).not.toBeChecked();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(/Deseja desativar a conta/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
        expect(await screen.findByText(/Deseja desativar a conta/)).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
        expect(interruptor).not.toBeChecked();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        expect(screen.getByLabelText(/^Nome/)).toBeDisabled();
        expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Fechar modal" })).toBeDisabled();
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", code: "Escape" });
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const [url, options] = fetchMock.mock.lastCall!;
        expect(url).toBe("/api/users/2/deactivate");
        expect(options?.method).toBe("PATCH");
        expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer token-admin");
        await act(async () => {
            concluir(resposta({ ...usuario, active: false }));
        });
        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith("Usuário atualizado com sucesso.")
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("gridcell", { name: "Inativo" })).toBeInTheDocument();
    });

    it("ativa somente após salvar e confirmar", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([{ ...usuario, active: false }]))
            .mockResolvedValueOnce(resposta(usuario));
        renderPage();
        await screen.findByText(usuario.name);
        fireEvent.click(screen.getByRole("button", { name: "Editar usuário: Ana Silva" }));
        const interruptor = await screen.findByRole("switch");
        fireEvent.click(interruptor);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
        expect(await screen.findByText(/Deseja ativar a conta/)).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        expect(fetchMock).toHaveBeenLastCalledWith(
            "/api/users/2/activate",
            expect.objectContaining({ method: "PATCH" })
        );
        expect(screen.getByRole("gridcell", { name: "Ativo" })).toBeInTheDocument();
    });

    it("descarta a mudança do interruptor quando o modal é cancelado", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(resposta([usuario]));
        renderPage();
        await screen.findByText(usuario.name);
        fireEvent.click(screen.getByRole("button", { name: "Editar usuário: Ana Silva" }));
        fireEvent.click(await screen.findByRole("switch"));
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("gridcell", { name: "Ativo" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Editar usuário: Ana Silva" }));
        expect(await screen.findByRole("switch")).toBeChecked();
    });

    it("mantém a situação original e o formulário se a alteração for recusada", async () => {
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([usuario]))
            .mockResolvedValueOnce(resposta({ title: "Forbidden" }, 403));
        renderPage();
        await screen.findByText(usuario.name);
        fireEvent.click(screen.getByRole("button", { name: "Editar usuário: Ana Silva" }));
        fireEvent.click(await screen.findByRole("switch"));
        fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Você não tem permissão para salvar usuários."
        );
        expect(screen.getByRole("switch")).not.toBeChecked();
        expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled();
        expect(toast.success).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Fechar modal" }));
        expect(screen.getByRole("gridcell", { name: "Ativo" })).toBeInTheDocument();
    });

    it("informa salvamento parcial e repete somente a situação ao tentar novamente", async () => {
        const atualizado = { ...usuario, name: "Ana Souza" };
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([usuario]))
            .mockResolvedValueOnce(resposta(atualizado))
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(resposta({ ...atualizado, active: false }));
        renderPage();
        await screen.findByText(usuario.name);
        fireEvent.click(screen.getByRole("button", { name: "Editar usuário: Ana Silva" }));
        fireEvent.change(await screen.findByLabelText(/^Nome/), {
            target: { value: atualizado.name },
        });
        fireEvent.click(screen.getByRole("switch"));
        fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Os dados do usuário foram salvos, mas não foi possível confirmar a alteração da situação."
        );
        expect(screen.getByLabelText(/^Nome/)).toHaveValue(atualizado.name);
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            "/api/users/2",
            expect.objectContaining({ method: "PUT" })
        );
        expect(fetchMock).toHaveBeenCalledTimes(3);
        fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        expect(fetchMock).toHaveBeenCalledTimes(4);
        expect(fetchMock).toHaveBeenLastCalledWith(
            "/api/users/2/deactivate",
            expect.objectContaining({ method: "PATCH" })
        );
        expect(screen.getByText(atualizado.name)).toBeInTheDocument();
        expect(screen.getByRole("gridcell", { name: "Inativo" })).toBeInTheDocument();
    });

    it("não altera a situação quando os dados de edição são rejeitados", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([usuario]))
            .mockResolvedValueOnce(resposta({ detail: "E-mail já cadastrado." }, 409));
        renderPage();
        await screen.findByText(usuario.name);
        fireEvent.click(screen.getByRole("button", { name: "Editar usuário: Ana Silva" }));
        fireEvent.change(await screen.findByLabelText(/^E-mail/), {
            target: { value: "duplicado@example.test" },
        });
        fireEvent.click(screen.getByRole("switch"));
        fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        expect(
            await screen.findByText("Este e-mail já está cadastrado. Informe outro e-mail.")
        ).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenLastCalledWith(
            "/api/users/2",
            expect.objectContaining({ method: "PUT" })
        );
        expect(toast.success).not.toHaveBeenCalled();
    });

    it.each(["cadastro", "edição"])(
        "rejeita e-mail sem domínio completo no %s e permite corrigir",
        async (modo) => {
            const fetchMock = vi
                .spyOn(globalThis, "fetch")
                .mockResolvedValueOnce(resposta([usuario]))
                .mockResolvedValueOnce(
                    resposta({
                        ...usuario,
                        id: modo === "cadastro" ? 3 : usuario.id,
                        email: "teste@teste.com",
                    })
                );
            renderPage();
            await screen.findByText(usuario.name);
            fireEvent.click(
                screen.getByRole("button", {
                    name: modo === "cadastro" ? "Novo usuário" : "Editar usuário: Ana Silva",
                })
            );
            const campoEmail = await screen.findByLabelText(/^E-mail/);
            if (modo === "cadastro") {
                fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Teste" } });
                fireEvent.change(screen.getByLabelText(/^Senha/), {
                    target: { value: "SenhaTeste123" },
                });
            }
            fireEvent.change(campoEmail, { target: { value: "teste@teste" } });
            const salvar = screen.getByRole("button", {
                name: modo === "cadastro" ? "Cadastrar usuário" : "Salvar alterações",
            });
            fireEvent.click(salvar);
            expect(
                await screen.findByText("Informe um endereço de e-mail válido.")
            ).toBeInTheDocument();
            expect(campoEmail).toHaveAttribute("aria-invalid", "true");
            expect(campoEmail).toHaveFocus();
            expect(
                screen.queryByText("Confira os campos indicados antes de salvar.")
            ).not.toBeInTheDocument();
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(toast.success).not.toHaveBeenCalled();

            fireEvent.change(campoEmail, { target: { value: "teste@teste.com" } });
            fireEvent.click(salvar);
            await waitFor(() => expect(toast.success).toHaveBeenCalled());
            expect(JSON.parse(fetchMock.mock.lastCall![1]?.body as string).email).toBe(
                "teste@teste.com"
            );
        }
    );

    it("lista, cadastra e edita usuários com JWT sem enviar senha na edição", async () => {
        const novo = {
            ...usuario,
            id: 3,
            name: "Maria Santos",
            email: "maria@example.test",
            role: "PARTICIPANT",
        };
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([usuario]))
            .mockResolvedValueOnce(resposta(novo, 201))
            .mockResolvedValueOnce(resposta({ ...usuario, name: "Ana Souza" }));
        renderPage();
        expect(await screen.findByText("Ana Silva")).toBeInTheDocument();
        expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/users", expect.anything());

        fireEvent.click(screen.getByRole("button", { name: "Novo usuário" }));
        fireEvent.change(await screen.findByLabelText(/^Nome/), { target: { value: novo.name } });
        expect(
            screen.queryByRole("button", { name: /^(Ativar|Desativar) usuário$/ })
        ).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: novo.email } });
        fireEvent.change(screen.getByLabelText(/^Senha/), { target: { value: "SenhaTeste123" } });
        fireEvent.click(screen.getByRole("button", { name: "Cadastrar usuário" }));
        expect(await screen.findByText("Maria Santos")).toBeInTheDocument();
        expect(toast.success).toHaveBeenCalledWith("Usuário cadastrado com sucesso.");
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Editar usuário: Ana Silva" }));
        expect(screen.queryByLabelText(/^Senha/)).not.toBeInTheDocument();
        fireEvent.change(await screen.findByLabelText(/^Nome/), { target: { value: "Ana Souza" } });
        fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
        expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
        expect(toast.success).toHaveBeenLastCalledWith("Usuário atualizado com sucesso.");
        const [url, options] = fetchMock.mock.lastCall!;
        expect(url).toBe("/api/users/2");
        expect(options?.method).toBe("PUT");
        expect(JSON.parse(options?.body as string)).toEqual({
            name: "Ana Souza",
            email: usuario.email,
            role: usuario.role,
        });
        expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer token-admin");

        fireEvent.change(screen.getByLabelText("Buscar por nome ou e-mail"), {
            target: { value: "inexistente" },
        });
        expect(screen.getByText("Nenhum usuário encontrado")).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("Buscar por nome ou e-mail"), {
            target: { value: "ana@" },
        });
        expect(screen.getByText("Ana Souza")).toBeInTheDocument();
        expect(screen.queryByText("Maria Santos")).not.toBeInTheDocument();
    });

    it("mantém o modal e os dados quando o backend rejeita e-mail duplicado", async () => {
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([usuario]))
            .mockResolvedValueOnce(resposta({ detail: "E-mail já cadastrado." }, 409));
        renderPage();
        await screen.findByText(usuario.name);
        fireEvent.click(screen.getByRole("button", { name: "Editar usuário: Ana Silva" }));
        fireEvent.change(await screen.findByLabelText(/^E-mail/), {
            target: { value: "duplicado@example.test" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
        expect(
            await screen.findByText("Este e-mail já está cadastrado. Informe outro e-mail.")
        ).toBeInTheDocument();
        expect(screen.queryByText("E-mail já cadastrado.")).not.toBeInTheDocument();
        expect(screen.getByLabelText(/^E-mail/)).toHaveFocus();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByLabelText(/^E-mail/)).toHaveValue("duplicado@example.test");
        expect(toast.success).not.toHaveBeenCalled();
        expect(screen.getByText(usuario.name)).toBeInTheDocument();
    });

    it("mostra validação da API apenas no campo correspondente", async () => {
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([usuario]))
            .mockResolvedValueOnce(
                resposta(
                    {
                        message: "Dados inválidos.",
                        fieldErrors: [{ field: "name", message: "Informe o nome completo." }],
                    },
                    400
                )
            );
        renderPage();
        await screen.findByText(usuario.name);
        fireEvent.click(screen.getByRole("button", { name: "Editar usuário: Ana Silva" }));
        await screen.findByLabelText(/^Nome/);
        fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
        expect(await screen.findByText("Informe o nome completo.")).toBeInTheDocument();
        expect(screen.queryByText("Dados inválidos.")).not.toBeInTheDocument();
        expect(screen.getByLabelText(/^Nome/)).toHaveFocus();
    });

    it("mantém alerta geral e foco no resumo quando a API fica indisponível ao salvar", async () => {
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([usuario]))
            .mockRejectedValueOnce(new TypeError("Failed to fetch"));
        renderPage();
        await screen.findByText(usuario.name);
        fireEvent.click(screen.getByRole("button", { name: "Editar usuário: Ana Silva" }));
        await screen.findByLabelText(/^Nome/);
        fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
        const alerta = await screen.findByRole("alert");
        expect(alerta).toHaveTextContent("Não foi possível conectar à API.");
        expect(alerta.parentElement).toHaveFocus();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("mostra erro de carregamento e permite tentar novamente", async () => {
        vi.spyOn(globalThis, "fetch")
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(resposta([usuario]));
        renderPage();
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Não foi possível carregar os usuários"
        );
        fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
        await waitFor(() => expect(screen.getByText(usuario.name)).toBeInTheDocument());
    });

    it.each<UserRole>(["RESEARCHER", "COORDINATOR", "PARTICIPANT"])(
        "impede acesso do perfil %s sem consultar a API",
        (role) => {
            const fetchMock = vi.spyOn(globalThis, "fetch");
            renderPage(role);
            expect(screen.getByRole("heading", { name: "Acesso restrito" })).toBeInTheDocument();
            expect(fetchMock).not.toHaveBeenCalled();
        }
    );

    it.each([
        [401, "Sua sessão não é mais válida. Entre novamente para continuar."],
        [403, "Você não tem permissão para consultar usuários."],
    ] as const)(
        "mostra a mensagem adequada quando a listagem retorna HTTP %s",
        async (status, mensagem) => {
            vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                resposta({ detail: "Acesso negado." }, status)
            );
            renderPage();
            expect(await screen.findByRole("alert")).toHaveTextContent(mensagem);
            expect(screen.queryByRole("grid")).not.toBeInTheDocument();
            expect(screen.getByRole("link", { name: "Ir para o login" })).toHaveAttribute(
                "href",
                "/login"
            );
        }
    );

    it("redireciona para login quando não há sessão", () => {
        const fetchMock = vi.spyOn(globalThis, "fetch");
        renderPage("ADMINISTRATOR", false);
        expect(screen.getByText("Tela de login")).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
