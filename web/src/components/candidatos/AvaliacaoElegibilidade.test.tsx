import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "../../types/auth";
import type {
    CandidatoApi,
    EstudoComStatusApi,
    StatusElegibilidadeApi,
} from "../../types/candidato";
import type { AvaliacaoElegibilidadeApi, CriterioEstudoApi } from "../../types/elegibilidade";
import { AvaliacaoElegibilidade } from "./AvaliacaoElegibilidade";

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
    ...estudoRecrutamento,
    id: 20,
    title: "Estudo Neurológico Inicial",
    status: "PLANNING",
};

const candidatoBase: CandidatoApi = {
    id: 101,
    studyId: 10,
    name: "Candidato 014",
    age: 42,
    eligibilityStatus: "PENDING",
};

const criteriosEstudo: CriterioEstudoApi[] = [
    {
        id: 1,
        studyId: 10,
        type: "INCLUSION",
        description: "Idade mínima de 18 anos completos",
    },
    {
        id: 2,
        studyId: 10,
        type: "INCLUSION",
        description: "Diagnóstico prévio confirmado",
    },
    {
        id: 3,
        studyId: 10,
        type: "EXCLUSION",
        description: "Alergia grave ao princípio ativo",
    },
];

function resposta(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status });
}

function renderAvaliacao({
    estudo = estudoRecrutamento,
    candidato = candidatoBase,
    role = "COORDINATOR" as UserRole,
    onVoltar = vi.fn(),
    onAtualizarStatusCandidato = vi.fn<(id: number, status: StatusElegibilidadeApi) => void>(),
} = {}) {
    return {
        onVoltar,
        onAtualizarStatusCandidato,
        ...render(
            <AvaliacaoElegibilidade
                estudo={estudo}
                candidato={candidato}
                token="token-coordenador"
                role={role}
                onVoltar={onVoltar}
                onAtualizarStatusCandidato={onAtualizarStatusCandidato}
            />
        ),
    };
}

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("Tela de avaliação de elegibilidade (RF09 - T13.3 / T13.4)", () => {
    it("renderiza critérios separando visualmente inclusão e exclusão e exibe parecer pendente", async () => {
        const avaliacaoInicial: AvaliacaoElegibilidadeApi = {
            studyId: 10,
            candidateId: 101,
            status: "PENDING",
            answers: [],
        };

        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(criteriosEstudo))
            .mockResolvedValueOnce(resposta(avaliacaoInicial));

        renderAvaliacao();

        expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
            "Carregando critérios e avaliação de elegibilidade..."
        );

        const secaoInclusao = await screen.findByRole("region", { name: "Critérios de inclusão" });
        const secaoExclusao = screen.getByRole("region", { name: "Critérios de exclusão" });

        expect(
            within(secaoInclusao).getByLabelText("Idade mínima de 18 anos completos")
        ).toBeInTheDocument();
        expect(
            within(secaoInclusao).getByLabelText("Diagnóstico prévio confirmado")
        ).toBeInTheDocument();
        expect(
            within(secaoExclusao).getByLabelText("Alergia grave ao princípio ativo")
        ).toBeInTheDocument();

        const cardParecer = screen.getByRole("status", { name: "Parecer resultante do candidato" });
        expect(cardParecer).toHaveTextContent("Pendente");
        expect(cardParecer).toHaveTextContent(/Existem critérios pendentes de resposta/i);
    });

    it("envia avaliação parcial apenas com os critérios respondidos e mantém status pendente", async () => {
        const avaliacaoInicial: AvaliacaoElegibilidadeApi = {
            studyId: 10,
            candidateId: 101,
            status: "PENDING",
            answers: [],
        };

        const avaliacaoParcial: AvaliacaoElegibilidadeApi = {
            studyId: 10,
            candidateId: 101,
            status: "PENDING",
            answers: [{ criterionId: 1, matches: true }],
            evaluatedAt: "2026-11-09T20:00:00Z",
        };

        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(criteriosEstudo))
            .mockResolvedValueOnce(resposta(avaliacaoInicial))
            .mockResolvedValueOnce(resposta(avaliacaoParcial));

        const { onAtualizarStatusCandidato } = renderAvaliacao();

        const selectInclusao1 = await screen.findByLabelText("Idade mínima de 18 anos completos");
        fireEvent.change(selectInclusao1, { target: { value: "true" } });

        fireEvent.click(screen.getByRole("button", { name: "Salvar avaliação" }));

        expect(
            await screen.findByText("Avaliação de elegibilidade registrada com sucesso.")
        ).toBeInTheDocument();

        const [url, options] = fetchMock.mock.calls[2];
        expect(url).toBe("/api/studies/10/candidates/101/eligibility");
        expect(options?.method).toBe("PUT");
        expect(JSON.parse(String(options?.body))).toEqual({
            answers: [{ criterionId: 1, matches: true }],
        });

        const cardParecer = screen.getByRole("status", { name: "Parecer resultante do candidato" });
        expect(cardParecer).toHaveTextContent("Pendente");
        expect(onAtualizarStatusCandidato).toHaveBeenCalledWith(101, "PENDING");
    });

    it("envia avaliação completa, confere payload JSON e apresenta visualmente resultado Elegível", async () => {
        const avaliacaoInicial: AvaliacaoElegibilidadeApi = {
            studyId: 10,
            candidateId: 101,
            status: "PENDING",
            answers: [],
        };

        const avaliacaoElegivel: AvaliacaoElegibilidadeApi = {
            studyId: 10,
            candidateId: 101,
            status: "ELIGIBLE",
            answers: [
                { criterionId: 1, matches: true },
                { criterionId: 2, matches: true },
                { criterionId: 3, matches: false },
            ],
            evaluatedAt: "2026-11-09T21:15:00Z",
        };

        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(criteriosEstudo))
            .mockResolvedValueOnce(resposta(avaliacaoInicial))
            .mockResolvedValueOnce(resposta(avaliacaoElegivel));

        const { onAtualizarStatusCandidato } = renderAvaliacao();

        fireEvent.change(await screen.findByLabelText("Idade mínima de 18 anos completos"), {
            target: { value: "true" },
        });
        fireEvent.change(screen.getByLabelText("Diagnóstico prévio confirmado"), {
            target: { value: "true" },
        });
        fireEvent.change(screen.getByLabelText("Alergia grave ao princípio ativo"), {
            target: { value: "false" },
        });

        fireEvent.click(screen.getByRole("button", { name: "Salvar avaliação" }));

        expect(
            await screen.findByText("Avaliação de elegibilidade registrada com sucesso.")
        ).toBeInTheDocument();

        const [url, options] = fetchMock.mock.calls[2];
        expect(url).toBe("/api/studies/10/candidates/101/eligibility");
        expect(options?.method).toBe("PUT");
        expect(JSON.parse(String(options?.body))).toEqual({
            answers: [
                { criterionId: 1, matches: true },
                { criterionId: 2, matches: true },
                { criterionId: 3, matches: false },
            ],
        });

        const cardParecer = screen.getByRole("status", { name: "Parecer resultante do candidato" });
        expect(cardParecer).toHaveTextContent("Elegível");
        expect(cardParecer).toHaveTextContent(/Todos os critérios de inclusão foram atendidos/i);
        expect(onAtualizarStatusCandidato).toHaveBeenCalledWith(101, "ELIGIBLE");
    });

    it("apresenta visualmente resultado Inelegível quando critério de exclusão se aplica", async () => {
        const avaliacaoInelegivel: AvaliacaoElegibilidadeApi = {
            studyId: 10,
            candidateId: 101,
            status: "INELIGIBLE",
            answers: [
                { criterionId: 1, matches: true },
                { criterionId: 2, matches: true },
                { criterionId: 3, matches: true },
            ],
            evaluatedAt: "2026-11-09T21:30:00Z",
        };

        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(criteriosEstudo))
            .mockResolvedValueOnce(resposta(avaliacaoInelegivel));

        renderAvaliacao({
            candidato: { ...candidatoBase, eligibilityStatus: "INELIGIBLE" },
        });

        await screen.findByLabelText("Alergia grave ao princípio ativo");

        const cardParecer = screen.getByRole("status", { name: "Parecer resultante do candidato" });
        expect(cardParecer).toHaveTextContent("Inelegível");
        expect(cardParecer).toHaveTextContent(
            /Ao menos um critério de inclusão não foi atendido ou um critério de exclusão se aplica/i
        );
        expect(screen.getByText("Impeditivo (Se aplica)")).toBeInTheDocument();
    });

    it("trata falha HTTP ao salvar (HTTP 409) e ao carregar sem perder o contexto da tela", async () => {
        const avaliacaoInicial: AvaliacaoElegibilidadeApi = {
            studyId: 10,
            candidateId: 101,
            status: "PENDING",
            answers: [],
        };

        vi.spyOn(globalThis, "fetch")
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(resposta(avaliacaoInicial))
            .mockResolvedValueOnce(resposta(criteriosEstudo))
            .mockResolvedValueOnce(resposta(avaliacaoInicial))
            .mockResolvedValueOnce(
                resposta(
                    {
                        code: "ELIGIBILITY_CONFLICT",
                        message: "Não é permitido alterar a elegibilidade após a inclusão.",
                    },
                    409
                )
            );

        renderAvaliacao();

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Não foi possível carregar os critérios e a avaliação de elegibilidade."
        );

        fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

        const selectInclusao = await screen.findByLabelText("Idade mínima de 18 anos completos");
        fireEvent.change(selectInclusao, { target: { value: "true" } });
        fireEvent.click(screen.getByRole("button", { name: "Salvar avaliação" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Não é permitido alterar a elegibilidade após a inclusão."
        );
        expect(screen.getByText("Candidato 014")).toBeInTheDocument();
    });

    it("bloqueia edição para perfil sem permissão (RESEARCHER) e para estudo fora de recrutamento", async () => {
        const avaliacaoInicial: AvaliacaoElegibilidadeApi = {
            studyId: 10,
            candidateId: 101,
            status: "PENDING",
            answers: [{ criterionId: 1, matches: true }],
        };

        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(criteriosEstudo))
            .mockResolvedValueOnce(resposta(avaliacaoInicial))
            .mockResolvedValueOnce(resposta(criteriosEstudo))
            .mockResolvedValueOnce(resposta(avaliacaoInicial));

        const { unmount } = renderAvaliacao({ role: "RESEARCHER" });

        const selectPesquisador = await screen.findByLabelText("Idade mínima de 18 anos completos");
        expect(selectPesquisador).toBeDisabled();
        expect(screen.getByText(/Visualização em modo somente leitura/i)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Salvar avaliação" })).not.toBeInTheDocument();

        unmount();

        renderAvaliacao({ estudo: estudoPlanejamento, role: "COORDINATOR" });

        const selectPlanejamento = await screen.findByLabelText(
            "Idade mínima de 18 anos completos"
        );
        expect(selectPlanejamento).toBeDisabled();
        expect(
            screen.getByText(/só é permitido com o estudo em recrutamento/i)
        ).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Salvar avaliação" })).not.toBeInTheDocument();
    });

    it("exibe aviso claro quando o estudo não possui critérios cadastrados", async () => {
        const avaliacaoInicial: AvaliacaoElegibilidadeApi = {
            studyId: 10,
            candidateId: 101,
            status: "PENDING",
            answers: [],
        };

        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta([]))
            .mockResolvedValueOnce(resposta(avaliacaoInicial));

        renderAvaliacao();

        expect(
            await screen.findByRole("heading", { name: "Estudo sem critérios cadastrados" })
        ).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Salvar avaliação" })).not.toBeInTheDocument();
    });
});
