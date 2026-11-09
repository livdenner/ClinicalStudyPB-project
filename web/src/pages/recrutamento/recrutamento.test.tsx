import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../context/AuthContext";
import { AUTH_STORAGE_KEY } from "../../services/auth";
import type { UserRole } from "../../types/auth";
import type { CandidatoApi, EstudoComStatusApi } from "../../types/candidato";
import { RecrutamentoPage } from "./recrutamento";

const estudoRecrutamento: EstudoComStatusApi = {
    id: 10,
    version: 0,
    title: "Estudo Cardiovascular Fase II",
    objective: "Avaliar pressão arterial",
    responsibleUserId: 2,
    startDate: "2026-11-01",
    endDate: "2027-05-01",
    participantLimit: 50,
    status: "RECRUITMENT",
};

const estudoPlanejamento: EstudoComStatusApi = {
    id: 20,
    version: 0,
    title: "Estudo Neurológico Inicial",
    objective: "Avaliar qualidade do sono",
    responsibleUserId: 2,
    startDate: "2026-12-01",
    endDate: "2027-06-01",
    participantLimit: 30,
    status: "PLANNING",
};

const candidatoPendente: CandidatoApi = {
    id: 101,
    studyId: 10,
    name: "Candidato 014",
    age: 42,
    eligibilityStatus: "PENDING",
};

const candidatoElegivel: CandidatoApi = {
    id: 102,
    studyId: 10,
    name: "Candidato 021",
    age: 55,
    eligibilityStatus: "ELIGIBLE",
};

function resposta(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status });
}

function renderPage(role: UserRole = "COORDINATOR", autenticado = true) {
    if (autenticado) {
        localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({
                accessToken: "token-coordenador",
                tokenType: "Bearer",
                expiresAt: Date.now() + 3600000,
                user: {
                    id: 9,
                    name: "Carla Coordenadora",
                    email: "coordenador@clinicalstudypb.test",
                    role,
                    active: true,
                },
            })
        );
    }

    return render(
        <AuthProvider>
            <MemoryRouter initialEntries={["/recrutamento"]}>
                <Routes>
                    <Route path="/recrutamento" element={<RecrutamentoPage />} />
                    <Route path="/login" element={<p>Tela de login</p>} />
                </Routes>
            </MemoryRouter>
        </AuthProvider>
    );
}

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
});

describe("Tela de candidatos com filtro por estudo (RF08 - T12.3 / T12.4)", () => {
    it("exibe carregamento inicial e depois lista vazia quando não há registros", async () => {
        let concluirEstudos!: (response: Response) => void;
        const pendenteEstudos = new Promise<Response>((resolve) => {
            concluirEstudos = resolve;
        });

        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockReturnValueOnce(pendenteEstudos)
            .mockResolvedValueOnce(resposta([]));

        renderPage();

        expect(screen.getByRole("status")).toHaveTextContent("Carregando estudos...");
        expect(screen.getByRole("button", { name: "Novo candidato" })).toBeDisabled();

        await act(async () => concluirEstudos(resposta([estudoRecrutamento])));

        expect(await screen.findByText("Nenhum candidato encontrado")).toBeInTheDocument();
        expect(screen.getByText("Exibindo 0 de 0 candidatos")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Novo candidato" })).toBeEnabled();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0][0]).toBe("/api/studies");
        expect(fetchMock.mock.calls[1][0]).toBe("/api/studies/10/candidates");
    });

    it("lista candidatos iniciais e consulta a API com o novo studyId ao filtrar", async () => {
        const candidatoOutroEstudo: CandidatoApi = {
            id: 201,
            studyId: 20,
            name: "Candidato 099",
            age: 31,
            eligibilityStatus: "INELIGIBLE",
        };

        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([estudoRecrutamento, estudoPlanejamento]))
            .mockResolvedValueOnce(resposta([candidatoPendente, candidatoElegivel]))
            .mockResolvedValueOnce(resposta([candidatoOutroEstudo]));

        renderPage();

        expect(await screen.findByText("Candidato 014")).toBeInTheDocument();
        expect(screen.getByText("42 anos")).toBeInTheDocument();
        expect(screen.getByText("Pendente")).toBeInTheDocument();
        expect(screen.getByText("Candidato 021")).toBeInTheDocument();
        expect(screen.getByText("Elegível")).toBeInTheDocument();
        expect(screen.getByText("Exibindo 2 de 2 candidatos")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Buscar candidato por identificação"), {
            target: { value: "021" },
        });
        expect(screen.queryByText("Candidato 014")).not.toBeInTheDocument();
        expect(screen.getByText("Candidato 021")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Buscar candidato por identificação"), {
            target: { value: "" },
        });

        fireEvent.change(screen.getByLabelText("Estudo clínico"), {
            target: { value: "20" },
        });

        expect(await screen.findByText("Candidato 099")).toBeInTheDocument();
        expect(screen.getByText("Inelegível")).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls[2][0]).toBe("/api/studies/20/candidates");
    });

    it("desabilita o cadastro quando o estudo não está em recrutamento", async () => {
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([estudoPlanejamento]))
            .mockResolvedValueOnce(resposta([]));

        renderPage();

        expect(await screen.findByText("Nenhum candidato encontrado")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Novo candidato" })).toBeDisabled();
        expect(
            screen.getByText(/O cadastro de novos candidatos só é permitido/i)
        ).toBeInTheDocument();
    });

    it("valida campos obrigatórios e idade antes da chamada HTTP de cadastro", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([estudoRecrutamento]))
            .mockResolvedValueOnce(resposta([]));

        renderPage();

        await screen.findByText("Nenhum candidato encontrado");
        fireEvent.click(screen.getByRole("button", { name: "Novo candidato" }));

        const dialog = await screen.findByRole("dialog", { name: "Novo candidato" });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar candidato" }));

        expect(
            await within(dialog).findByText("Informe a identificação do candidato.")
        ).toBeInTheDocument();
        expect(within(dialog).getByText("Informe a idade do candidato.")).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(2);

        fireEvent.change(within(dialog).getByLabelText("Identificação do candidato"), {
            target: { value: "Candidato 050" },
        });
        fireEvent.change(within(dialog).getByLabelText("Idade"), {
            target: { value: "0" },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar candidato" }));

        expect(
            await within(dialog).findByText("Informe uma idade inteira válida entre 1 e 130.")
        ).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("cadastra candidato válido e atualiza a listagem com o retorno da API", async () => {
        const novoCandidato: CandidatoApi = {
            id: 150,
            studyId: 10,
            name: "Candidato 050",
            age: 38,
            eligibilityStatus: "PENDING",
        };

        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([estudoRecrutamento]))
            .mockResolvedValueOnce(resposta([]))
            .mockResolvedValueOnce(resposta(novoCandidato, 201));

        renderPage();

        await screen.findByText("Nenhum candidato encontrado");
        fireEvent.click(screen.getByRole("button", { name: "Novo candidato" }));

        const dialog = await screen.findByRole("dialog", { name: "Novo candidato" });
        fireEvent.change(within(dialog).getByLabelText("Identificação do candidato"), {
            target: { value: "  Candidato 050  " },
        });
        fireEvent.change(within(dialog).getByLabelText("Idade"), {
            target: { value: "38" },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar candidato" }));

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        const [url, options] = fetchMock.mock.calls[2];
        expect(url).toBe("/api/studies/10/candidates");
        expect(options?.method).toBe("POST");
        expect(JSON.parse(String(options?.body))).toEqual({
            name: "Candidato 050",
            age: 38,
        });

        expect(screen.getByText("Candidato cadastrado com sucesso.")).toBeInTheDocument();
        expect(screen.getByText("Candidato 050")).toBeInTheDocument();
        expect(screen.getByText("38 anos")).toBeInTheDocument();
        expect(screen.getByText("Exibindo 1 de 1 candidatos")).toBeInTheDocument();
    });

    it("exibe erro claro no modal ao receber conflito de duplicidade (HTTP 409)", async () => {
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([estudoRecrutamento]))
            .mockResolvedValueOnce(resposta([candidatoPendente]))
            .mockResolvedValueOnce(
                resposta(
                    {
                        code: "DUPLICATE_CANDIDATE",
                        message: "Já existe um candidato com este nome neste estudo.",
                    },
                    409
                )
            );

        renderPage();

        await screen.findByText("Candidato 014");
        fireEvent.click(screen.getByRole("button", { name: "Novo candidato" }));

        const dialog = await screen.findByRole("dialog", { name: "Novo candidato" });
        fireEvent.change(within(dialog).getByLabelText("Identificação do candidato"), {
            target: { value: "Candidato 014" },
        });
        fireEvent.change(within(dialog).getByLabelText("Idade"), {
            target: { value: "42" },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar candidato" }));

        expect(await within(dialog).findByRole("alert")).toHaveTextContent(
            "Já existe um candidato com este nome neste estudo."
        );
        expect(screen.getByRole("dialog", { name: "Novo candidato" })).toBeInTheDocument();
    });

    it("trata falha na listagem de candidatos e permite tentar novamente", async () => {
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([estudoRecrutamento]))
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(resposta([candidatoPendente]));

        renderPage();

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Não foi possível carregar os candidatos. Verifique a conexão e tente novamente."
        );

        fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

        expect(await screen.findByText("Candidato 014")).toBeInTheDocument();
    });

    it("permite que RESEARCHER consulte candidatos sem botão de cadastro", async () => {
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([estudoRecrutamento]))
            .mockResolvedValueOnce(resposta([candidatoPendente]));

        renderPage("RESEARCHER");

        expect(await screen.findByText("Candidato 014")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Novo candidato" })).not.toBeInTheDocument();
    });

    it.each<UserRole>(["ADMINISTRATOR", "PARTICIPANT"])(
        "bloqueia acesso e não consulta a API para o perfil %s",
        (role) => {
            const fetchMock = vi.spyOn(globalThis, "fetch");
            renderPage(role);

            expect(screen.getByText("Acesso restrito")).toBeInTheDocument();
            expect(
                screen.getByText(/disponível apenas para coordenadores e pesquisadores/i)
            ).toBeInTheDocument();
            expect(fetchMock).not.toHaveBeenCalled();
        }
    );

    it("redireciona para login quando não há sessão autenticada", () => {
        const fetchMock = vi.spyOn(globalThis, "fetch");
        renderPage("COORDINATOR", false);

        expect(screen.getByText("Tela de login")).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
