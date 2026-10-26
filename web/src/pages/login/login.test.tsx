import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../main";
import { AUTH_STORAGE_KEY, loadStoredSession } from "../../services/auth";
import { AuthProvider } from "../../context/AuthContext";

function renderApp(initialRoute = "/login") {
    return render(
        <AuthProvider>
            <MemoryRouter initialEntries={[initialRoute]}>
                <App />
            </MemoryRouter>
        </AuthProvider>
    );
}

describe("Login e gestão de sessão (T4.2)", () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        window.localStorage.clear();
    });

    it("valida campos obrigatórios antes de chamar a API", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        renderApp("/login");

        fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Informe seu e-mail e sua senha para entrar."
        );
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("exibe erro quando as credenciais são inválidas ou a conta está inativa (401)", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    code: "INVALID_CREDENTIALS",
                    message: "E-mail ou senha inválidos, ou usuário inativo.",
                }),
                { status: 401, headers: { "Content-Type": "application/json" } }
            )
        );

        renderApp("/login");

        fireEvent.change(screen.getByLabelText("E-mail"), {
            target: { value: "invalido@clinicalstudypb.test" },
        });
        fireEvent.change(screen.getByLabelText("Senha"), {
            target: { value: "senha-errada" },
        });
        fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "E-mail ou senha inválidos, ou usuário inativo."
        );
        expect(loadStoredSession()).toBeNull();
    });

    it("exibe erro de conexão e não salva sessão quando a API está indisponível", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));

        renderApp("/login");

        fireEvent.change(screen.getByLabelText("E-mail"), {
            target: { value: "pesquisador@clinicalstudypb.test" },
        });
        fireEvent.change(screen.getByLabelText("Senha"), {
            target: { value: "Demo@Clinical2026" },
        });
        fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente."
        );
        expect(loadStoredSession()).toBeNull();
        expect(
            screen.queryByRole("heading", { name: /estudos clínicos/i })
        ).not.toBeInTheDocument();
    });

    it("autentica usuário ativo, persiste a sessão, exibe perfil na Sidebar e encerra a sessão no logout", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        accessToken: "jwt-token-teste",
                        tokenType: "Bearer",
                        expiresIn: 3600,
                        user: {
                            id: 1,
                            name: "Pesquisador Demo",
                            email: "pesquisador@clinicalstudypb.test",
                            role: "RESEARCHER",
                            active: true,
                        },
                    }),
                    { status: 200, headers: { "Content-Type": "application/json" } }
                )
            )
            .mockResolvedValueOnce(new Response(null, { status: 204 }));

        renderApp("/login");

        fireEvent.change(screen.getByLabelText("E-mail"), {
            target: { value: "pesquisador@clinicalstudypb.test" },
        });
        fireEvent.change(screen.getByLabelText("Senha"), {
            target: { value: "Senha123!" },
        });
        fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

        expect(
            await screen.findByRole("heading", { name: /estudos clínicos/i })
        ).toBeInTheDocument();

        expect(screen.getByText("Pesquisador Demo")).toBeInTheDocument();
        expect(screen.getByText("Pesquisador")).toBeInTheDocument();

        const sessaoSalva = loadStoredSession();
        expect(sessaoSalva?.accessToken).toBe("jwt-token-teste");
        expect(sessaoSalva?.user.email).toBe("pesquisador@clinicalstudypb.test");

        fireEvent.click(screen.getByRole("button", { name: /sair/i }));

        expect(
            await screen.findByRole("heading", { name: /acesso ao sistema/i })
        ).toBeInTheDocument();

        await waitFor(() => {
            expect(loadStoredSession()).toBeNull();
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            "/api/v1/auth/login",
            expect.objectContaining({ method: "POST" })
        );
        expect(fetchMock).toHaveBeenLastCalledWith(
            "/api/v1/auth/logout",
            expect.objectContaining({ method: "POST" })
        );

        const logoutOptions = fetchMock.mock.lastCall?.[1];
        const logoutHeaders = new Headers(logoutOptions?.headers);
        expect(logoutHeaders.get("Authorization")).toBe("Bearer jwt-token-teste");
    });

    it("descarta automaticamente sessão já expirada no armazenamento local", () => {
        window.localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({
                accessToken: "token-expirado",
                tokenType: "Bearer",
                expiresAt: Date.now() - 5000,
                user: {
                    id: 2,
                    name: "Administrador Demo",
                    email: "administrador@clinicalstudypb.test",
                    role: "ADMINISTRATOR",
                    active: true,
                },
            })
        );

        expect(loadStoredSession()).toBeNull();
        expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    });
});
