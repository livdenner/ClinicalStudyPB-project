import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../context/AuthContext";
import { AUTH_STORAGE_KEY } from "../../services/auth";
import type { UserRole } from "../../types/auth";
import type { CandidatoApi, EstudoComStatusApi } from "../../types/candidato";
import { RecrutamentoPage } from "./recrutamento";
import { cadastroConvidado } from "../../test/fixtures/fluxos-web";

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
    email: "candidato014@exemplo.test",
    phone: "(83) 99999-0014",
    userId: 201,
    status: "ACTIVE",
    eligibilityStatus: "PENDING",
    consentStatus: "PENDING",
};

const candidatoElegivel: CandidatoApi = {
    id: 102,
    studyId: 10,
    name: "Candidato 021",
    age: 55,
    email: "candidato021@exemplo.test",
    phone: "(83) 99999-0021",
    userId: 202,
    status: "CONSENT_PENDING",
    eligibilityStatus: "ELIGIBLE",
    consentStatus: "PENDING",
};

const candidatoAceitou: CandidatoApi = {
    ...candidatoElegivel,
    status: "GRANTED",
    consentStatus: "GRANTED",
};

function resposta(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status });
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

function rotasDoEstudo(candidatos: CandidatoApi[]) {
    return {
        "GET /api/studies": resposta([estudoRecrutamento]),
        "GET /api/studies/10/candidates": resposta(candidatos),
        "GET /api/studies/10/participants": resposta([]),
    };
}

function renderPage(role: UserRole = "COORDINATOR", autenticado = true, path = "/recrutamento") {
    if (autenticado) {
        sessionStorage.setItem(
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
            <MemoryRouter initialEntries={[path]}>
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
    sessionStorage.clear();
});

afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
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
            email: "candidato099@exemplo.test",
            phone: "(83) 99999-0099",
            userId: 203,
            status: "ACTIVE",
            eligibilityStatus: "INELIGIBLE",
            consentStatus: "PENDING",
        };

        const fetchMock = mockApiPorRota({
            ...rotasDoEstudo([candidatoPendente, candidatoElegivel]),
            "GET /api/studies": resposta([estudoRecrutamento, estudoPlanejamento]),
            "GET /api/studies/20/candidates": resposta([candidatoOutroEstudo]),
            "GET /api/studies/20/participants": resposta([]),
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
            expect.arrayContaining(["/api/studies/20/candidates", "/api/studies/20/participants"])
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

        expect(await within(dialog).findByText("Informe o nome do candidato.")).toBeInTheDocument();
        expect(within(dialog).getByText("Informe a idade do candidato.")).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(3);

        fireEvent.change(within(dialog).getByLabelText("Nome do candidato"), {
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
            email: "candidato050@exemplo.test",
            phone: "(83) 99999-0050",
            userId: 204,
            status: "ACTIVE",
            eligibilityStatus: "PENDING",
            consentStatus: "PENDING",
        };

        const fetchMock = mockApiPorRota({
            ...rotasDoEstudo([]),
            "POST /api/studies/10/candidates": resposta(novoCandidato, 201),
        });
        renderPage();

        await screen.findByText("Nenhum candidato encontrado");
        fireEvent.click(screen.getByRole("button", { name: "Novo candidato" }));

        const dialog = await screen.findByRole("dialog", { name: "Novo candidato" });
        fireEvent.change(within(dialog).getByLabelText("Nome do candidato"), {
            target: { value: "  Candidato 050  " },
        });
        fireEvent.change(within(dialog).getByLabelText("Idade"), {
            target: { value: "38" },
        });
        fireEvent.change(within(dialog).getByLabelText("E-mail"), {
            target: { value: "candidato050@exemplo.test" },
        });
        fireEvent.change(within(dialog).getByLabelText("Telefone"), {
            target: { value: "(83) 99999-0050" },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar candidato" }));

        fireEvent.click(await screen.findByRole("button", { name: "Concluir cadastro" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        const cadastro = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
        expect(cadastro).toBeDefined();
        const [url, options] = cadastro!;
        expect(url).toBe("/api/studies/10/candidates");
        expect(options?.method).toBe("POST");
        expect(JSON.parse(String(options?.body))).toEqual({
            name: "Candidato 050",
            age: 38,
            email: "candidato050@exemplo.test",
            phone: "(83) 99999-0050",
        });

        expect(
            screen.getByText("Candidato cadastrado. Vinculado a conta existente.")
        ).toBeInTheDocument();
        expect(await screen.findByText("Candidato 050")).toBeInTheDocument();
        expect(screen.getByText("38 anos")).toBeInTheDocument();
        expect(screen.getByText("Exibindo 1 de 1 candidatos")).toBeInTheDocument();
    });

    it("exibe erro claro no modal ao receber conflito de duplicidade (HTTP 409)", async () => {
        mockApiPorRota({
            ...rotasDoEstudo([candidatoPendente]),
            "POST /api/studies/10/candidates": resposta(
                {
                    code: "CANDIDATE_ALREADY_IN_STUDY",
                    message: "O candidato já está cadastrado no estudo.",
                },
                409
            ),
        });

        renderPage();

        await screen.findByText("Candidato 014");
        fireEvent.click(screen.getByRole("button", { name: "Novo candidato" }));

        const dialog = await screen.findByRole("dialog", { name: "Novo candidato" });
        fireEvent.change(within(dialog).getByLabelText("Nome do candidato"), {
            target: { value: "Candidato 014" },
        });
        fireEvent.change(within(dialog).getByLabelText("Idade"), {
            target: { value: "42" },
        });
        fireEvent.change(within(dialog).getByLabelText("E-mail"), {
            target: { value: candidatoPendente.email },
        });
        fireEvent.change(within(dialog).getByLabelText("Telefone"), {
            target: { value: candidatoPendente.phone },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar candidato" }));

        expect(await within(dialog).findByRole("alert")).toHaveTextContent(
            "O candidato já está cadastrado no estudo."
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
            ...rotasDoEstudo([candidatoAceitou]),
            "GET /api/studies/10/candidates": [
                resposta([candidatoAceitou]),
                resposta([{ ...candidatoAceitou, status: "INCLUDED" }]),
            ],
            "GET /api/studies/10/participants": [
                resposta([]),
                resposta([
                    {
                        id: 1,
                        studyId: 10,
                        candidateId: 102,
                        candidateName: "Candidato 021",
                        includedAt: "2026-11-09T12:00:00Z",
                        status: "ACTIVE",
                    },
                ]),
            ],
            "POST /api/studies/10/candidates/102/inclusion": resposta(
                {
                    id: 1,
                    studyId: 10,
                    candidateId: 102,
                    candidateName: "Candidato 021",
                    includedAt: "2026-11-09T12:00:00Z",
                    status: "ACTIVE",
                },
                201
            ),
        });

        renderPage();

        expect(await screen.findByText("Aceitou")).toBeInTheDocument();
        const incluir = screen.getByRole("button", { name: "Incluir participante: Candidato 021" });
        await waitFor(() => expect(incluir).toBeEnabled());

        fireEvent.click(incluir);
        const dialog = await screen.findByRole("dialog", {
            name: "Confirmar inclusão de participante",
        });
        expect(within(dialog).getByText("50 de 50")).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar inclusão" }));

        expect(
            await screen.findByText("Participante incluído no estudo com sucesso.")
        ).toBeInTheDocument();
        expect(
            await within(await screen.findByLabelText("Lista de candidatos")).findByText("Incluído")
        ).toBeInTheDocument();
        await waitFor(() =>
            expect(
                screen.getByRole("status", { name: "Indicador de vagas do estudo" })
            ).toHaveTextContent("1 de 50")
        );
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
        mockApiPorRota(rotasDoEstudo([candidatoElegivel]));

        renderPage();

        expect(await screen.findByText("Aguardando decisão")).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Incluir participante: Candidato 021" })
        ).not.toBeInTheDocument();
    });

    it("avisa quando a situação não pôde ser consultada e permite consultar de novo", async () => {
        mockApiPorRota({
            ...rotasDoEstudo([candidatoAceitou]),
            "GET /api/studies/10/candidates": [
                resposta({ message: "Falha interna" }, 500),
                resposta([candidatoAceitou]),
            ],
        });

        renderPage();

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Não foi possível carregar os candidatos."
        );
        expect(
            screen.queryByRole("button", { name: "Incluir participante: Candidato 021" })
        ).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

        expect(await screen.findByText("Aceitou")).toBeInTheDocument();
        expect(
            screen.queryByText(/Não foi possível carregar os candidatos/)
        ).not.toBeInTheDocument();
        await waitFor(() =>
            expect(
                screen.getByRole("button", { name: "Incluir participante: Candidato 021" })
            ).toBeEnabled()
        );
    });

    it("mantém o botão de inclusão desabilitado quando o estudo já atingiu o limite de vagas", async () => {
        const estudoUmaVaga: EstudoComStatusApi = {
            ...estudoRecrutamento,
            participantLimit: 1,
        };

        mockApiPorRota({
            ...rotasDoEstudo([candidatoAceitou]),
            "GET /api/studies": resposta([estudoUmaVaga]),
            "GET /api/studies/10/participants": resposta([
                {
                    id: 501,
                    studyId: 10,
                    candidateId: 100,
                    candidateName: "Candidato 001",
                    includedAt: "2026-11-09T10:00:00Z",
                    status: "ACTIVE",
                },
            ]),
        });

        renderPage();

        expect(await screen.findByText("Aceitou")).toBeInTheDocument();

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
            ...rotasDoEstudo([candidatoAceitou]),
            "POST /api/studies/10/candidates/102/inclusion": resposta(
                {
                    code: "INCLUSION_CONFLICT",
                    message: "O estudo atingiu o limite de participantes.",
                },
                409
            ),
        });

        renderPage();

        expect(await screen.findByText("Aceitou")).toBeInTheDocument();
        const incluir = screen.getByRole("button", { name: "Incluir participante: Candidato 021" });
        await waitFor(() => expect(incluir).toBeEnabled());
        fireEvent.click(incluir);

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

        const rotasBase = rotasDoEstudo([candidatoAceitou]);
        const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
            const rota = `${(init?.method ?? "GET").toUpperCase()} ${String(input)}`;
            if (rota === "POST /api/studies/10/candidates/102/inclusion") {
                const resultado = await pendenteInclusao;
                rotasBase["GET /api/studies/10/candidates"] = resposta([
                    { ...candidatoAceitou, status: "INCLUDED" },
                ]);
                rotasBase["GET /api/studies/10/participants"] = resposta([
                    {
                        id: 502,
                        studyId: 10,
                        candidateId: 102,
                        candidateName: "Candidato 021",
                        includedAt: "2026-11-09T17:00:00Z",
                        status: "ACTIVE",
                    },
                ]);
                return resultado;
            }
            const respostaRota = (rotasBase as Record<string, Response | undefined>)[rota];
            if (!respostaRota) {
                throw new Error(`Rota não simulada: ${rota}`);
            }
            return respostaRota.clone();
        });

        renderPage();

        expect(await screen.findByText("Aceitou")).toBeInTheDocument();
        const incluir = screen.getByRole("button", { name: "Incluir participante: Candidato 021" });
        await waitFor(() => expect(incluir).toBeEnabled());
        fireEvent.click(incluir);

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
                        status: "ACTIVE",
                    },
                    201
                )
            )
        );

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });
});

it("T24.1: seleciona o estudo da URL mesmo quando não é o primeiro da lista", async () => {
    const fetchMock = mockApiPorRota({
        ...rotasDoEstudo([]),
        "GET /api/studies": resposta([estudoPlanejamento, estudoRecrutamento]),
    });
    renderPage("COORDINATOR", true, "/recrutamento?studyId=10");
    await screen.findByText("Nenhum candidato encontrado");
    expect(screen.getByLabelText("Estudo clínico")).toHaveValue("10");
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/studies/10/candidates")).toBe(
        true
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/studies/20/"))).toBe(
        false
    );
});

it.each(["999", "abc", "0", "1e1"])(
    "T24.1: não consulta outro estudo silenciosamente para studyId=%s",
    async (id) => {
        const fetchMock = mockApiPorRota(rotasDoEstudo([]));
        renderPage("COORDINATOR", true, `/recrutamento?studyId=${id}`);
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "O estudo solicitado não está disponível."
        );
        expect(screen.getByLabelText("Estudo clínico")).toHaveValue("");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        fireEvent.change(screen.getByLabelText("Estudo clínico"), { target: { value: "10" } });
        await screen.findByText("Nenhum candidato encontrado");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    }
);

it("T24.3: preserva o cancelamento e a consulta de cancelados na lista de cards", async () => {
    const cancelado: CandidatoApi = {
        ...candidatoPendente,
        status: "CANCELLED",
        cancellation: {
            reason: "E-mail incorreto",
            cancelledAt: "2026-11-20T12:00:00Z",
            cancelledByUserId: 9,
        },
    };
    const fetchMock = mockApiPorRota({
        ...rotasDoEstudo([candidatoPendente]),
        "GET /api/studies/10/candidates": [resposta([candidatoPendente]), resposta([])],
        "POST /api/studies/10/candidates/101/cancellation": resposta(cancelado),
        "GET /api/studies/10/candidates?includeCancelled=true": resposta([cancelado]),
    });
    renderPage();
    fireEvent.click(
        await screen.findByRole("button", { name: "Cancelar candidatura: Candidato 014" })
    );
    const modal = screen.getByRole("dialog", { name: "Cancelar candidatura" });
    fireEvent.change(within(modal).getByRole("textbox", { name: /Motivo do cancelamento/ }), {
        target: { value: "  E-mail incorreto  " },
    });
    fireEvent.click(within(modal).getByRole("button", { name: "Confirmar cancelamento" }));
    expect(await screen.findByText("Nenhum candidato encontrado")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox", { name: "Exibir candidaturas canceladas" }));
    const lista = await screen.findByRole("list", { name: "Lista de candidatos" });
    expect(within(lista).getByText("Cancelado")).toBeInTheDocument();
    expect(within(lista).getByText("Motivo: E-mail incorreto")).toBeInTheDocument();
    expect(within(lista).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /consentimento/i })).not.toBeInTheDocument();
    const envio = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
    expect(envio?.[0]).toBe("/api/studies/10/candidates/101/cancellation");
    expect(JSON.parse(String(envio?.[1]?.body))).toEqual({ reason: "E-mail incorreto" });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/consent"))).toBe(false);
});

/** Regressões do convite, cancelamento e filtro acrescentados na Sprint 3. @author Lívia */
describe("RF08 — andamento e cancelamento (T17.8)", () => {
    it("RF08-P05: cancelamento mantém filtro ativo e mostra o histórico retornado pela API", async () => {
        const cancelado: CandidatoApi = {
            ...candidatoPendente,
            status: "CANCELLED",
            cancellation: {
                reason: "E-mail incorreto",
                cancelledAt: "2026-11-21T12:00:00Z",
                cancelledByUserId: 9,
            },
        };
        const http = mockApiPorRota({
            ...rotasDoEstudo([candidatoPendente]),
            "GET /api/studies/10/candidates?includeCancelled=true": [
                resposta([candidatoPendente]),
                resposta([cancelado]),
            ],
            "POST /api/studies/10/candidates/101/cancellation": resposta(cancelado),
        });
        renderPage();
        await screen.findByRole("list", { name: "Lista de candidatos" });
        fireEvent.click(screen.getByRole("checkbox", { name: "Exibir candidaturas canceladas" }));
        const lista = await screen.findByRole("list", { name: "Lista de candidatos" });
        fireEvent.click(
            await within(lista).findByRole("button", {
                name: "Cancelar candidatura: Candidato 014",
            })
        );
        const dialog = await screen.findByRole("dialog");
        fireEvent.change(within(dialog).getByLabelText(/Motivo do cancelamento/), {
            target: { value: "E-mail incorreto" },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar cancelamento" }));
        const atualizada = await screen.findByRole("list", { name: "Lista de candidatos" });
        expect(await within(atualizada).findByText("Cancelado")).toBeInTheDocument();
        expect(within(atualizada).getByText("Motivo: E-mail incorreto")).toBeInTheDocument();
        expect(
            screen.getByRole("checkbox", { name: "Exibir candidaturas canceladas" })
        ).toBeChecked();
        expect(
            http.mock.calls.filter(
                ([url]) => url === "/api/studies/10/candidates?includeCancelled=true"
            )
        ).toHaveLength(2);
    });

    it("RF08-P01: concluir convite remove o código da tela e não o grava em nenhum storage", async () => {
        mockApiPorRota({
            ...rotasDoEstudo([]),
            "POST /api/studies/10/candidates": resposta(cadastroConvidado, 201),
        });
        renderPage();
        await screen.findByText("Nenhum candidato encontrado");
        fireEvent.click(screen.getByRole("button", { name: "Novo candidato" }));
        const modal = await screen.findByRole("dialog", { name: "Novo candidato" });
        for (const [label, value] of [
            [/Nome do candidato/, "Pessoa fictícia"],
            [/E-mail/, "pessoa@example.test"],
            [/Telefone/, "83999990000"],
            [/Idade/, "42"],
        ] as const) {
            fireEvent.change(within(modal).getByLabelText(label), { target: { value } });
        }
        fireEvent.click(within(modal).getByRole("button", { name: "Cadastrar candidato" }));
        expect(await screen.findByLabelText("Código de ativação")).toHaveTextContent("DEMO-1234");
        fireEvent.click(screen.getByRole("button", { name: "Concluir cadastro" }));
        const lista = await screen.findByRole("list", { name: "Lista de candidatos" });
        expect(await within(lista).findByText("Convidado")).toBeInTheDocument();
        expect(screen.queryByText("DEMO-1234")).not.toBeInTheDocument();
        for (const storage of [localStorage, sessionStorage]) {
            for (let i = 0; i < storage.length; i++)
                expect(storage.getItem(storage.key(i)!)).not.toContain("DEMO-1234");
        }
    });

    it("RF08-P02: filtro de cancelados persiste ao atualizar e pode voltar à lista padrão", async () => {
        const cancelado: CandidatoApi = {
            ...candidatoPendente,
            status: "CANCELLED",
            cancellation: {
                reason: "Cadastro corrigido",
                cancelledAt: "2026-11-20T12:00:00Z",
                cancelledByUserId: 9,
            },
        };
        const http = mockApiPorRota({
            ...rotasDoEstudo([]),
            "GET /api/studies/10/candidates?includeCancelled=true": resposta([cancelado]),
        });
        renderPage();
        expect(await screen.findByText("Nenhum candidato encontrado")).toBeInTheDocument();
        const filtro = screen.getByRole("checkbox", { name: "Exibir candidaturas canceladas" });
        expect(filtro).not.toBeChecked();
        fireEvent.click(filtro);
        expect(
            await within(
                await screen.findByRole("list", { name: "Lista de candidatos" })
            ).findByText("Cancelado")
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Atualizar lista" }));
        expect(
            await within(
                await screen.findByRole("list", { name: "Lista de candidatos" })
            ).findByText("Motivo: Cadastro corrigido")
        ).toBeInTheDocument();
        expect(filtro).toBeChecked();
        expect(
            http.mock.calls.filter(
                ([url]) => url === "/api/studies/10/candidates?includeCancelled=true"
            )
        ).toHaveLength(2);
        fireEvent.click(filtro);
        expect(await screen.findByText("Nenhum candidato encontrado")).toBeInTheDocument();
        expect(filtro).not.toBeChecked();
    });

    it.each([
        [
            "CANDIDATE_ALREADY_INCLUDED",
            "INCLUDED",
            "RECRUITMENT",
            "Candidato incluído por outra pessoa.",
        ],
        [
            "CANDIDATE_ALREADY_CANCELLED",
            "CANCELLED",
            "RECRUITMENT",
            "Candidatura já cancelada por outra pessoa.",
        ],
        ["STUDY_NOT_RECRUITING", "ACTIVE", "EXECUTION", "O recrutamento foi encerrado."],
    ] as const)(
        "RF08-P03: conflito %s consulta candidato e estudo e bloqueia novo cancelamento",
        async (code, status, studyStatus, message) => {
            const atual = { ...candidatoPendente, status };
            const http = mockApiPorRota({
                ...rotasDoEstudo([candidatoPendente]),
                "GET /api/studies/10/candidates": [
                    resposta([candidatoPendente]),
                    resposta(status === "CANCELLED" ? [] : [atual]),
                ],
                "POST /api/studies/10/candidates/101/cancellation": resposta(
                    { code, message },
                    409
                ),
                "GET /api/studies/10/candidates/101": resposta(atual),
                "GET /api/studies/10": resposta({ ...estudoRecrutamento, status: studyStatus }),
            });
            renderPage();
            fireEvent.click(
                await screen.findByRole("button", { name: "Cancelar candidatura: Candidato 014" })
            );
            const dialog = await screen.findByRole("dialog", { name: "Cancelar candidatura" });
            fireEvent.change(within(dialog).getByLabelText(/Motivo do cancelamento/), {
                target: { value: "E-mail incorreto" },
            });
            fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar cancelamento" }));
            expect(await within(dialog).findByRole("alert")).toHaveTextContent(message);
            await waitFor(() =>
                expect(
                    within(dialog).getByRole("button", { name: "Confirmar cancelamento" })
                ).toBeDisabled()
            );
            expect(
                await within(dialog).findByText(/Dados atualizados. Situação da candidatura:/)
            ).toBeInTheDocument();
            expect(
                http.mock.calls.filter(([url]) => url === "/api/studies/10/candidates/101")
            ).toHaveLength(1);
            expect(http.mock.calls.filter(([url]) => url === "/api/studies/10")).toHaveLength(1);
            expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
        }
    );

    it("RF09-P04: avaliação elegível recarrega a candidatura e não antecipa o aceite", async () => {
        const criterios = [
            { id: 1, studyId: 10, type: "INCLUSION", description: "Inclusão fictícia" },
        ];
        const avaliacao = { studyId: 10, candidateId: 101, status: "PENDING", answers: [] };
        const http = mockApiPorRota({
            ...rotasDoEstudo([candidatoPendente]),
            "GET /api/studies/10/candidates": [
                resposta([candidatoPendente]),
                resposta([
                    {
                        ...candidatoPendente,
                        status: "CONSENT_PENDING",
                        eligibilityStatus: "ELIGIBLE",
                    },
                ]),
            ],
            "GET /api/studies/10/criteria": resposta(criterios),
            "GET /api/studies/10/candidates/101/eligibility": resposta(avaliacao),
            "PUT /api/studies/10/candidates/101/eligibility": resposta({
                ...avaliacao,
                status: "ELIGIBLE",
                answers: [{ criterionId: 1, matches: true }],
            }),
        });
        renderPage();
        fireEvent.click(
            await screen.findByRole("button", { name: "Avaliar elegibilidade: Candidato 014" })
        );
        fireEvent.change(await screen.findByLabelText("Inclusão fictícia"), {
            target: { value: "true" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Salvar avaliação" }));
        expect(
            await screen.findByText("Avaliação de elegibilidade registrada com sucesso.")
        ).toBeInTheDocument();
        await waitFor(() =>
            expect(
                http.mock.calls.filter(([url]) => url === "/api/studies/10/candidates")
            ).toHaveLength(2)
        );
        fireEvent.click(screen.getByRole("button", { name: "Voltar para candidatos" }));
        const lista = await screen.findByRole("list", { name: "Lista de candidatos" });
        expect(within(lista).getByText("Aguardando decisão")).toBeInTheDocument();
        expect(within(lista).getByText("Elegível")).toBeInTheDocument();
        expect(
            within(lista).queryByRole("button", { name: /^Incluir participante:/ })
        ).not.toBeInTheDocument();
        expect(http.mock.calls.some(([url]) => String(url).includes("/consent"))).toBe(false);
    });
});
