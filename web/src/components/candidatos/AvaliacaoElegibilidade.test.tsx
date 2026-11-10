import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../../services/api/apiClient";
import {
    listarCriteriosPorEstudo,
    obterAvaliacaoElegibilidade,
    salvarAvaliacaoElegibilidade,
} from "../../services/elegibilidade";
import type { UserRole } from "../../types/auth";
import type { CandidatoApi, EstudoComStatusApi } from "../../types/candidato";
import type { CriterioEstudoApi } from "../../types/elegibilidade";
import { AvaliacaoElegibilidade } from "./AvaliacaoElegibilidade";

vi.mock("../../services/elegibilidade", () => ({
    listarCriteriosPorEstudo: vi.fn(),
    obterAvaliacaoElegibilidade: vi.fn(),
    salvarAvaliacaoElegibilidade: vi.fn(),
}));

const estudo: EstudoComStatusApi = {
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

const candidato: CandidatoApi = {
    id: 101,
    studyId: 10,
    name: "Candidata 014",
    age: 42,
    eligibilityStatus: "PENDING",
};

const criterios: CriterioEstudoApi[] = [
    { id: 1, studyId: 10, type: "INCLUSION", description: "Ter 18 anos ou mais" },
    { id: 2, studyId: 10, type: "EXCLUSION", description: "Estar em gestação" },
];

function renderTela(role: UserRole = "COORDINATOR", status = estudo.status) {
    const onVoltar = vi.fn();
    const onAtualizarStatusCandidato = vi.fn();
    render(
        <AvaliacaoElegibilidade
            estudo={{ ...estudo, status }}
            candidato={candidato}
            token="token"
            role={role}
            onVoltar={onVoltar}
            onAtualizarStatusCandidato={onAtualizarStatusCandidato}
        />
    );
    return { onVoltar, onAtualizarStatusCandidato };
}

function parecer() {
    return screen.getByRole("status", { name: "Parecer resultante do candidato" });
}

beforeEach(() => {
    vi.mocked(listarCriteriosPorEstudo).mockResolvedValue(criterios);
    vi.mocked(obterAvaliacaoElegibilidade).mockResolvedValue({
        studyId: 10,
        candidateId: 101,
        status: "PENDING",
        answers: [],
    });
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("Avaliação de elegibilidade (RF09)", () => {
    it("carrega os critérios por tipo e o parecer atual do candidato", async () => {
        renderTela();

        expect(
            screen.getByText("Carregando critérios e avaliação de elegibilidade...")
        ).toBeVisible();
        expect(await screen.findByLabelText("Ter 18 anos ou mais")).toBeInTheDocument();
        expect(screen.getByLabelText("Estar em gestação")).toBeInTheDocument();
        expect(parecer()).toHaveTextContent("Pendente");
        expect(listarCriteriosPorEstudo).toHaveBeenCalledWith(10, "token", expect.any(AbortSignal));
        expect(obterAvaliacaoElegibilidade).toHaveBeenCalledWith(
            10,
            101,
            "token",
            expect.any(AbortSignal)
        );
    });

    it("mostra as respostas já registradas e o parecer devolvido pela API", async () => {
        vi.mocked(obterAvaliacaoElegibilidade).mockResolvedValue({
            studyId: 10,
            candidateId: 101,
            status: "INELIGIBLE",
            answers: [
                { criterionId: 1, matches: true },
                { criterionId: 2, matches: true },
            ],
            evaluatedAt: "2026-11-09T12:00:00Z",
        });

        renderTela();

        expect(await screen.findByLabelText("Estar em gestação")).toHaveValue("true");
        expect(screen.getByLabelText("Ter 18 anos ou mais")).toHaveValue("true");
        expect(parecer()).toHaveTextContent("Inelegível");
        expect(parecer()).toHaveTextContent("Última atualização");
    });

    it("salva as respostas e informa a nova situação à lista de candidatos", async () => {
        vi.mocked(salvarAvaliacaoElegibilidade).mockResolvedValue({
            studyId: 10,
            candidateId: 101,
            status: "ELIGIBLE",
            answers: [
                { criterionId: 1, matches: true },
                { criterionId: 2, matches: false },
            ],
            evaluatedAt: "2026-11-09T12:00:00Z",
        });
        const { onAtualizarStatusCandidato } = renderTela();

        fireEvent.change(await screen.findByLabelText("Ter 18 anos ou mais"), {
            target: { value: "true" },
        });
        fireEvent.change(screen.getByLabelText("Estar em gestação"), {
            target: { value: "false" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Salvar avaliação" }));

        expect(
            await screen.findByText("Avaliação de elegibilidade registrada com sucesso.")
        ).toBeInTheDocument();
        expect(salvarAvaliacaoElegibilidade).toHaveBeenCalledWith(
            10,
            101,
            {
                answers: [
                    { criterionId: 1, matches: true },
                    { criterionId: 2, matches: false },
                ],
            },
            "token"
        );
        expect(parecer()).toHaveTextContent("Elegível");
        expect(onAtualizarStatusCandidato).toHaveBeenCalledWith(101, "ELIGIBLE");
    });

    it("exige ao menos uma resposta antes de chamar a API", async () => {
        renderTela();

        await screen.findByLabelText("Ter 18 anos ou mais");
        fireEvent.click(screen.getByRole("button", { name: "Salvar avaliação" }));

        expect(
            await screen.findByText("Responda ao menos um critério antes de salvar a avaliação.")
        ).toBeInTheDocument();
        expect(salvarAvaliacaoElegibilidade).not.toHaveBeenCalled();
    });

    it("mostra o motivo do 409 devolvido pela API sem alterar o parecer", async () => {
        vi.mocked(salvarAvaliacaoElegibilidade).mockRejectedValue(
            new ApiClientError(
                "Não é possível reavaliar um candidato já incluído como participante.",
                {
                    status: 409,
                }
            )
        );
        const { onAtualizarStatusCandidato } = renderTela();

        fireEvent.change(await screen.findByLabelText("Ter 18 anos ou mais"), {
            target: { value: "true" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Salvar avaliação" }));

        expect(
            await screen.findByText(
                "Não é possível reavaliar um candidato já incluído como participante."
            )
        ).toBeInTheDocument();
        expect(parecer()).toHaveTextContent("Pendente");
        expect(onAtualizarStatusCandidato).not.toHaveBeenCalled();
    });

    it("avisa quando o estudo não tem critérios", async () => {
        vi.mocked(listarCriteriosPorEstudo).mockResolvedValue([]);

        renderTela();

        expect(await screen.findByText("Estudo sem critérios cadastrados")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Salvar avaliação" })).not.toBeInTheDocument();
    });

    it("deixa o pesquisador só consultar as respostas", async () => {
        renderTela("RESEARCHER");

        expect(await screen.findByLabelText("Ter 18 anos ou mais")).toBeDisabled();
        expect(screen.getByText(/modo somente leitura/)).toBeInTheDocument();
    });

    it("bloqueia o registro quando o estudo não está em recrutamento", async () => {
        renderTela("COORDINATOR", "EXECUTION");

        expect(await screen.findByLabelText("Ter 18 anos ou mais")).toBeDisabled();
        expect(screen.getByText(/só é permitido com o estudo/)).toBeInTheDocument();
    });

    it("trata falha ao carregar e permite tentar novamente", async () => {
        vi.mocked(listarCriteriosPorEstudo)
            .mockRejectedValueOnce(new ApiClientError("Proibido", { status: 403 }))
            .mockResolvedValueOnce(criterios);

        renderTela();

        expect(
            await screen.findByText(
                "Você não tem permissão para consultar a avaliação de elegibilidade."
            )
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

        expect(await screen.findByLabelText("Ter 18 anos ou mais")).toBeInTheDocument();
        await waitFor(() => expect(listarCriteriosPorEstudo).toHaveBeenCalledTimes(2));
    });

    it("volta para a lista de candidatos", async () => {
        const { onVoltar } = renderTela();

        await screen.findByLabelText("Ter 18 anos ou mais");
        fireEvent.click(screen.getByRole("button", { name: "Voltar para candidatos" }));

        expect(onVoltar).toHaveBeenCalledTimes(1);
    });
});
