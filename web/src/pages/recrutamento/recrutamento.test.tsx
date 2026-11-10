import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../context/AuthContext";
import { AUTH_STORAGE_KEY } from "../../services/auth";
import type { UserRole } from "../../types/auth";
import type { CandidatoApi, EstudoComStatusApi } from "../../types/candidato";
import type { ParticipanteApi } from "../../types/participante";
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
            .mockResolvedValueOnce(resposta([]))
            .mockResolvedValueOnce(resposta([]));

        renderPage();

        expect(screen.getByRole("status")).toHaveTextContent("Carregando estudos...");
        expect(screen.getByRole("button", { name: "Novo candidato" })).toBeDisabled();

        await act(async () => concluirEstudos(resposta([estudoRecrutamento])));

        expect(await screen.findByText("Nenhum candidato encontrado")).toBeInTheDocument();
        expect(screen.getByText("Exibindo 0 de 0 candidatos")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Novo candidato" })).toBeEnabled();
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls[0][0]).toBe("/api/studies");
        expect(fetchMock.mock.calls[1][0]).toBe("/api/studies/10/candidates");
        expect(fetchMock.mock.calls[2][0]).toBe("/api/studies/10/participants");
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
            .mockResolvedValueOnce(resposta([]))
            .mockResolvedValueOnce(resposta([candidatoOutroEstudo]))
            .mockResolvedValueOnce(resposta([]));

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
        expect(fetchMock).toHaveBeenCalledTimes(5);
        expect(fetchMock.mock.calls[3][0]).toBe("/api/studies/20/candidates");
        expect(fetchMock.mock.calls[4][0]).toBe("/api/studies/20/participants");
    });

    it("desabilita o cadastro quando o estudo não está em recrutamento", async () => {
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([estudoPlanejamento]))
            .mockResolvedValueOnce(resposta([]))
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
            .mockResolvedValueOnce(resposta([]))
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
        expect(fetchMock).toHaveBeenCalledTimes(3);

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
        expect(fetchMock).toHaveBeenCalledTimes(3);
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

        const [url, options] = fetchMock.mock.calls[3];
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
            .mockResolvedValueOnce(resposta([]))
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
            .mockResolvedValueOnce(resposta([]))
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
            .mockResolvedValueOnce(resposta([candidatoPendente]))
            .mockResolvedValueOnce(resposta([]));

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

describe("Inclusão e lista de participantes por estudo (RF11 - T15.3 / T15.4)", () => {
    const estudoComDuasVagas: EstudoComStatusApi = {
        ...estudoRecrutamento,
        participantLimit: 2,
    };

    const candidatoApto: CandidatoApi = {
        id: 102,
        studyId: 10,
        name: "Candidato 021",
        age: 55,
        eligibilityStatus: "ELIGIBLE",
        consentStatus: "GRANTED",
    };

    const candidatoConsentimentoRecusado: CandidatoApi = {
        id: 103,
        studyId: 10,
        name: "Candidato 030",
        age: 49,
        eligibilityStatus: "ELIGIBLE",
        consentStatus: "DECLINED",
    };

    const participanteExistente: ParticipanteApi = {
        id: 501,
        studyId: 10,
        candidateId: 100,
        candidateName: "Candidato 001",
        includedAt: "2026-11-09T15:00:00Z",
    };

    it("inclui candidato apto com sucesso, atualiza lista de participantes e saldo de vagas", async () => {
        const novoParticipante: ParticipanteApi = {
            id: 502,
            studyId: 10,
            candidateId: 102,
            candidateName: "Candidato 021",
            includedAt: "2026-11-09T16:30:00Z",
        };

        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([estudoComDuasVagas]))
            .mockResolvedValueOnce(resposta([candidatoApto]))
            .mockResolvedValueOnce(resposta([participanteExistente]))
            .mockResolvedValueOnce(resposta(novoParticipante, 201));

        renderPage("COORDINATOR");

        expect(await screen.findByText("Candidato 021")).toBeInTheDocument();

        const indicadorVagas = screen.getByRole("status", {
            name: "Indicador de vagas do estudo",
        });
        expect(indicadorVagas).toHaveTextContent("Vagas ocupadas: 1 de 2");
        expect(indicadorVagas).toHaveTextContent("Saldo disponível: 1 vaga");

        const botaoIncluir = screen.getByRole("button", {
            name: "Incluir participante: Candidato 021",
        });
        expect(botaoIncluir).toBeEnabled();
        fireEvent.click(botaoIncluir);

        const dialog = await screen.findByRole("dialog", {
            name: "Confirmar inclusão de participante",
        });
        expect(within(dialog).getByText("Candidato 021")).toBeInTheDocument();
        expect(within(dialog).getByText("1 de 2")).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar inclusão" }));

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        const [url, options] = fetchMock.mock.calls[3];
        expect(url).toBe("/api/studies/10/candidates/102/inclusion");
        expect(options?.method).toBe("POST");

        expect(
            screen.getByText("Participante incluído no estudo com sucesso.")
        ).toBeInTheDocument();
        expect(indicadorVagas).toHaveTextContent("Vagas ocupadas: 2 de 2");
        expect(indicadorVagas).toHaveTextContent("Saldo disponível: 0 vagas");
        expect(indicadorVagas).toHaveTextContent("Limite de vagas atingido");

        expect(screen.getByLabelText("Paciente Incluído: Candidato 021")).toBeInTheDocument();

        const tabelaParticipantes = screen.getByRole("grid", {
            name: "Lista de participantes incluídos",
        });
        expect(within(tabelaParticipantes).getByText("Candidato 001")).toBeInTheDocument();
        expect(within(tabelaParticipantes).getByText("Candidato 021")).toBeInTheDocument();
    });

    it("mantém botão de inclusão desabilitado para candidatos inaptos ou quando o estudo está sem vagas", async () => {
        const estudoUmaVaga: EstudoComStatusApi = {
            ...estudoRecrutamento,
            participantLimit: 1,
        };

        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([estudoComDuasVagas]))
            .mockResolvedValueOnce(
                resposta([candidatoPendente, candidatoElegivel, candidatoConsentimentoRecusado])
            )
            .mockResolvedValueOnce(resposta([]))
            .mockResolvedValueOnce(resposta([estudoUmaVaga]))
            .mockResolvedValueOnce(resposta([candidatoApto]))
            .mockResolvedValueOnce(resposta([participanteExistente]));

        const { unmount } = renderPage("COORDINATOR");

        await screen.findByText("Candidato 014");

        expect(
            screen.getByRole("button", { name: "Incluir participante: Candidato 014" })
        ).toBeDisabled();
        expect(
            screen.getByRole("button", { name: "Incluir participante: Candidato 021" })
        ).toBeDisabled();
        expect(
            screen.getByRole("button", { name: "Incluir participante: Candidato 030" })
        ).toBeDisabled();

        unmount();

        renderPage("COORDINATOR");

        await screen.findByText("Candidato 021");

        const botaoSemVaga = screen.getByRole("button", {
            name: "Incluir participante: Candidato 021",
        });
        expect(botaoSemVaga).toBeDisabled();
        expect(botaoSemVaga).toHaveAttribute(
            "title",
            "O estudo atingiu o limite de vagas disponíveis."
        );
    });

    it("exibe motivo específico retornado pela API (HTTP 409) quando a última vaga esgota antes da resposta", async () => {
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([estudoComDuasVagas]))
            .mockResolvedValueOnce(resposta([candidatoApto]))
            .mockResolvedValueOnce(resposta([participanteExistente]))
            .mockResolvedValueOnce(
                resposta(
                    {
                        code: "INCLUSION_CONFLICT",
                        message: "O estudo atingiu o limite de participantes.",
                    },
                    409
                )
            );

        renderPage("COORDINATOR");

        await screen.findByText("Candidato 021");
        fireEvent.click(
            screen.getByRole("button", { name: "Incluir participante: Candidato 021" })
        );

        const dialog = await screen.findByRole("dialog", {
            name: "Confirmar inclusão de participante",
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar inclusão" }));

        expect(await within(dialog).findByRole("alert")).toHaveTextContent(
            "O estudo atingiu o limite de participantes."
        );
        expect(
            screen.getByRole("dialog", { name: "Confirmar inclusão de participante" })
        ).toBeInTheDocument();
    });

    it("bloqueia clique duplo e dispara exatamente uma requisição durante a confirmação de inclusão", async () => {
        let concluirInclusao!: (response: Response) => void;
        const pendenteInclusao = new Promise<Response>((resolve) => {
            concluirInclusao = resolve;
        });

        const novoParticipante: ParticipanteApi = {
            id: 502,
            studyId: 10,
            candidateId: 102,
            candidateName: "Candidato 021",
            includedAt: "2026-11-09T17:00:00Z",
        };

        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([estudoComDuasVagas]))
            .mockResolvedValueOnce(resposta([candidatoApto]))
            .mockResolvedValueOnce(resposta([]))
            .mockReturnValueOnce(pendenteInclusao);

        renderPage("COORDINATOR");

        await screen.findByText("Candidato 021");
        fireEvent.click(
            screen.getByRole("button", { name: "Incluir participante: Candidato 021" })
        );

        const dialog = await screen.findByRole("dialog", {
            name: "Confirmar inclusão de participante",
        });
        const botaoConfirmar = within(dialog).getByRole("button", { name: "Confirmar inclusão" });

        fireEvent.click(botaoConfirmar);
        fireEvent.click(botaoConfirmar);
        fireEvent.click(botaoConfirmar);

        const chamadasInclusao = fetchMock.mock.calls.filter(
            ([url]) => url === "/api/studies/10/candidates/102/inclusion"
        );
        expect(chamadasInclusao).toHaveLength(1);

        await act(async () => concluirInclusao(resposta(novoParticipante, 201)));

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });
});
