import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../context/AuthContext";
import { AUTH_STORAGE_KEY } from "../../services/auth";
import type { UserRole } from "../../types/auth";
import type { CandidatoApi, EstudoComStatusApi } from "../../types/candidato";
import type { StatusConsentimentoApi } from "../../types/consentimento";
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

function consentimento(studyId: number, candidateId: number, status: StatusConsentimentoApi) {
    return resposta({ studyId, candidateId, status });
}

/**
 * Simula a API pela rota ("MÉTODO /caminho"), sem depender da ordem das chamadas. Cada rota
 * recebe uma resposta ou uma fila; o último item da fila continua valendo nas chamadas seguintes.
 */
function mockApiPorRota(rotas: Record<string, Response | Error | Array<Response | Error>>) {
    const filas = new Map(
        Object.entries(rotas).map(([rota, valor]) => [
            rota,
            Array.isArray(valor) ? [...valor] : [valor],
        ])
    );
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const rota = `${(init?.method ?? "GET").toUpperCase()} ${String(input)}`;
        const fila = filas.get(rota);
        if (!fila) throw new Error(`Rota não simulada: ${rota}`);
        const proxima = fila.length > 1 ? fila.shift()! : fila[0];
        if (proxima instanceof Error) throw proxima;
        return proxima.clone();
    });
}

function rotasDoEstudo(candidatos: CandidatoApi[], status: StatusConsentimentoApi = "PENDING") {
    return {
        "GET /api/studies": resposta([estudoRecrutamento]),
        "GET /api/studies/10/candidates": resposta(candidatos),
        "GET /api/studies/10/participants": resposta([]),
        ...Object.fromEntries(
            candidatos.map((c) => [
                `GET /api/studies/10/candidates/${c.id}/consent`,
                consentimento(10, c.id, status),
            ])
        ),
    };
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

        const fetchMock = mockApiPorRota({
            ...rotasDoEstudo([candidatoPendente, candidatoElegivel]),
            "GET /api/studies": resposta([estudoRecrutamento, estudoPlanejamento]),
            "GET /api/studies/20/candidates": resposta([candidatoOutroEstudo]),
            "GET /api/studies/20/participants": resposta([]),
            "GET /api/studies/20/candidates/201/consent": consentimento(20, 201, "PENDING"),
        });

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
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(
            expect.arrayContaining([
                "/api/studies/20/candidates",
                "/api/studies/20/participants",
                "/api/studies/20/candidates/201/consent",
            ])
        );
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
        mockApiPorRota({
            ...rotasDoEstudo([candidatoPendente]),
            "POST /api/studies/10/candidates": resposta(
                {
                    code: "DUPLICATE_CANDIDATE",
                    message: "Já existe um candidato com este nome neste estudo.",
                },
                409
            ),
        });

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
        mockApiPorRota({
            ...rotasDoEstudo([candidatoPendente]),
            "GET /api/studies/10/candidates": [
                new TypeError("Failed to fetch"),
                resposta([candidatoPendente]),
            ],
        });

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

    it("não consulta o consentimento quando o perfil é RESEARCHER", async () => {
        const fetchMock = mockApiPorRota({
            "GET /api/studies": resposta([estudoRecrutamento]),
            "GET /api/studies/10/candidates": resposta([candidatoElegivel]),
            "GET /api/studies/10/participants": resposta([]),
        });

        renderPage("RESEARCHER");

        expect(await screen.findByText("Candidato 021")).toBeInTheDocument();
        expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/consent"))).toBe(false);
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

describe("Consentimento na lista e inclusão de participante (RF10 e RF11)", () => {
    it("usa a decisão da API sem registro local e permite incluir o participante", async () => {
        const fetchMock = mockApiPorRota({
            ...rotasDoEstudo([candidatoElegivel], "GRANTED"),
            "POST /api/studies/10/candidates/102/inclusion": resposta(
                {
                    id: 1,
                    studyId: 10,
                    candidateId: 102,
                    candidateName: "Candidato 021",
                    includedAt: "2026-11-09T12:00:00Z",
                },
                201
            ),
        });

        renderPage();

        expect(await screen.findByText("Aceito")).toBeInTheDocument();
        const incluir = screen.getByRole("button", { name: "Incluir participante: Candidato 021" });
        expect(incluir).toBeEnabled();

        fireEvent.click(incluir);
        const dialog = await screen.findByRole("dialog", {
            name: "Confirmar inclusão de participante",
        });
        expect(within(dialog).getByText("50 de 50")).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar inclusão" }));

        expect(
            await screen.findByText("Participante incluído no estudo com sucesso.")
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Paciente Incluído: Candidato 021")).toBeInTheDocument();
        expect(
            screen.getByRole("status", { name: "Indicador de vagas do estudo" })
        ).toHaveTextContent("1 de 50");
        expect(
            fetchMock.mock.calls.some(
                ([url, init]) =>
                    url === "/api/studies/10/candidates/102/inclusion" && init?.method === "POST"
            )
        ).toBe(true);
    });

    it("ignora a decisão antiga guardada no navegador quando a API diz que está pendente", async () => {
        localStorage.setItem(
            "clinicalstudypb.consentimentos",
            JSON.stringify({ 102: { status: "GRANTED", termo: "TCLE-ANTIGO" } })
        );
        mockApiPorRota(rotasDoEstudo([candidatoElegivel], "PENDING"));

        renderPage();

        expect(await screen.findByText("Não registrado")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Incluir participante: Candidato 021" })
        ).toBeDisabled();
    });

    it("avisa quando o consentimento não pôde ser consultado e permite consultar de novo", async () => {
        mockApiPorRota({
            ...rotasDoEstudo([candidatoElegivel]),
            "GET /api/studies/10/candidates/102/consent": [
                resposta({ message: "Falha interna" }, 500),
                consentimento(10, 102, "GRANTED"),
            ],
        });

        renderPage();

        expect(
            await screen.findByText(
                /Não foi possível consultar o consentimento de alguns candidatos/
            )
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Incluir participante: Candidato 021" })
        ).toBeDisabled();

        fireEvent.click(screen.getByRole("button", { name: "Consultar novamente" }));

        expect(await screen.findByText("Aceito")).toBeInTheDocument();
        expect(
            screen.queryByText(/Não foi possível consultar o consentimento de alguns candidatos/)
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Incluir participante: Candidato 021" })
        ).toBeEnabled();
    });

    it("mantém o botão de inclusão desabilitado quando o estudo já atingiu o limite de vagas", async () => {
        const estudoUmaVaga: EstudoComStatusApi = {
            ...estudoRecrutamento,
            participantLimit: 1,
        };

        mockApiPorRota({
            ...rotasDoEstudo([candidatoElegivel], "GRANTED"),
            "GET /api/studies": resposta([estudoUmaVaga]),
            "GET /api/studies/10/participants": resposta([
                {
                    id: 501,
                    studyId: 10,
                    candidateId: 100,
                    candidateName: "Candidato 001",
                    includedAt: "2026-11-09T10:00:00Z",
                },
            ]),
        });

        renderPage();

        expect(await screen.findByText("Aceito")).toBeInTheDocument();

        const indicadorVagas = screen.getByRole("status", {
            name: "Indicador de vagas do estudo",
        });
        expect(indicadorVagas).toHaveTextContent("Vagas ocupadas: 1 de 1");
        expect(indicadorVagas).toHaveTextContent("Saldo disponível: 0 vagas");
        expect(indicadorVagas).toHaveTextContent("Limite de vagas atingido");

        const botaoSemVaga = screen.getByRole("button", {
            name: "Incluir participante: Candidato 021",
        });
        expect(botaoSemVaga).toBeDisabled();
        expect(botaoSemVaga).toHaveAttribute(
            "title",
            "O estudo atingiu o limite de vagas disponíveis."
        );
    });

    it("exibe o motivo específico retornado pela API (HTTP 409) quando a última vaga esgota antes da resposta", async () => {
        mockApiPorRota({
            ...rotasDoEstudo([candidatoElegivel], "GRANTED"),
            "POST /api/studies/10/candidates/102/inclusion": resposta(
                {
                    code: "INCLUSION_CONFLICT",
                    message: "O estudo atingiu o limite de participantes.",
                },
                409
            ),
        });

        renderPage();

        expect(await screen.findByText("Aceito")).toBeInTheDocument();
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

        const rotasBase = rotasDoEstudo([candidatoElegivel], "GRANTED");
        const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
            const rota = `${(init?.method ?? "GET").toUpperCase()} ${String(input)}`;
            if (rota === "POST /api/studies/10/candidates/102/inclusion") {
                return pendenteInclusao;
            }
            const respostaRota = (rotasBase as Record<string, Response | undefined>)[rota];
            if (!respostaRota) {
                throw new Error(`Rota não simulada: ${rota}`);
            }
            return respostaRota.clone();
        });

        renderPage();

        expect(await screen.findByText("Aceito")).toBeInTheDocument();
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
            ([url, init]) =>
                url === "/api/studies/10/candidates/102/inclusion" && init?.method === "POST"
        );
        expect(chamadasInclusao).toHaveLength(1);

        await act(async () =>
            concluirInclusao(
                resposta(
                    {
                        id: 502,
                        studyId: 10,
                        candidateId: 102,
                        candidateName: "Candidato 021",
                        includedAt: "2026-11-09T17:00:00Z",
                    },
                    201
                )
            )
        );

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });
});
