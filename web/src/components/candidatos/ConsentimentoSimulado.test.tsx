import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../../services/api/apiClient";
import {
    obterConsentimentoSimulado,
    registrarConsentimentoSimulado,
} from "../../services/consentimento";
import type { UserRole } from "../../types/auth";
import type { CandidatoApi, EstudoComStatusApi } from "../../types/candidato";
import { ConsentimentoSimulado } from "./ConsentimentoSimulado";

vi.mock("../../services/consentimento", () => ({
    obterConsentimentoSimulado: vi.fn(),
    registrarConsentimentoSimulado: vi.fn(),
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

const candidatoElegivel: CandidatoApi = {
    id: 102,
    studyId: 10,
    name: "Candidato 021",
    age: 55,
    eligibilityStatus: "ELIGIBLE",
};

function renderTela({
    role = "COORDINATOR" as UserRole,
    status = estudo.status,
    candidato = candidatoElegivel,
} = {}) {
    const onVoltar = vi.fn();
    const onAtualizarConsentimentoCandidato = vi.fn();
    render(
        <ConsentimentoSimulado
            estudo={{ ...estudo, status }}
            candidato={candidato}
            token="token"
            role={role}
            responsavelNome="Carla Coordenadora"
            onVoltar={onVoltar}
            onAtualizarConsentimentoCandidato={onAtualizarConsentimentoCandidato}
        />
    );
    return { onVoltar, onAtualizarConsentimentoCandidato };
}

function situacao() {
    return screen.getByRole("status", { name: "Situação atual do consentimento" });
}

beforeEach(() => {
    vi.mocked(obterConsentimentoSimulado).mockResolvedValue({
        studyId: 10,
        candidateId: 102,
        status: "PENDING",
    });
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("Consentimento simulado (RF10)", () => {
    it("carrega a situação pendente e sugere a identificação do termo", async () => {
        renderTela();

        expect(screen.getByText("Carregando dados do consentimento simulado...")).toBeVisible();
        expect(await screen.findByLabelText("Decisão do consentimento")).toHaveValue("");
        expect(situacao()).toHaveTextContent("Pendente");
        expect(screen.getByLabelText("Identificação do termo simulado")).toHaveValue(
            "TCLE-SIMULADO-ESTUDO-10-v1"
        );
        expect(obterConsentimentoSimulado).toHaveBeenCalledWith(
            10,
            102,
            "token",
            expect.any(AbortSignal)
        );
    });

    it("mostra a decisão já registrada e a repassa para a lista", async () => {
        vi.mocked(obterConsentimentoSimulado).mockResolvedValue({
            studyId: 10,
            candidateId: 102,
            status: "GRANTED",
            recordedAt: "2026-11-09T12:00:00Z",
        });
        const { onAtualizarConsentimentoCandidato } = renderTela();

        expect(await screen.findByLabelText("Decisão do consentimento")).toHaveValue("GRANTED");
        expect(situacao()).toHaveTextContent("Aceito");
        expect(onAtualizarConsentimentoCandidato).toHaveBeenCalledWith(
            102,
            "GRANTED",
            "TCLE-SIMULADO-ESTUDO-10-v1"
        );
    });

    it("registra a decisão com a API e informa a lista de candidatos", async () => {
        vi.mocked(registrarConsentimentoSimulado).mockResolvedValue({
            studyId: 10,
            candidateId: 102,
            status: "GRANTED",
            recordedAt: "2026-11-09T12:00:00Z",
        });
        const { onAtualizarConsentimentoCandidato } = renderTela();

        fireEvent.change(await screen.findByLabelText("Identificação do termo simulado"), {
            target: { value: "  TCLE-CARDIO-v2  " },
        });
        fireEvent.change(screen.getByLabelText("Decisão do consentimento"), {
            target: { value: "GRANTED" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Salvar consentimento" }));

        expect(
            await screen.findByText("Consentimento simulado registrado com sucesso.")
        ).toBeInTheDocument();
        expect(registrarConsentimentoSimulado).toHaveBeenCalledWith(
            10,
            102,
            expect.objectContaining({ status: "GRANTED" }),
            "token"
        );
        expect(situacao()).toHaveTextContent("Aceito");
        expect(onAtualizarConsentimentoCandidato).toHaveBeenLastCalledWith(
            102,
            "GRANTED",
            "TCLE-CARDIO-v2"
        );
    });

    it("valida termo e decisão antes de chamar a API", async () => {
        renderTela();

        fireEvent.change(await screen.findByLabelText("Identificação do termo simulado"), {
            target: { value: "   " },
        });
        fireEvent.click(screen.getByRole("button", { name: "Salvar consentimento" }));

        expect(
            await screen.findByText("Informe a identificação do termo simulado.")
        ).toBeInTheDocument();
        expect(
            screen.getByText("Selecione a decisão do consentimento (aceite ou recusa).")
        ).toBeInTheDocument();
        expect(registrarConsentimentoSimulado).not.toHaveBeenCalled();
    });

    it("mostra o motivo do 409 quando a decisão está bloqueada pela inclusão", async () => {
        vi.mocked(registrarConsentimentoSimulado).mockRejectedValue(
            new ApiClientError("O consentimento não pode mudar após a inclusão.", { status: 409 })
        );
        renderTela();

        fireEvent.change(await screen.findByLabelText("Decisão do consentimento"), {
            target: { value: "DECLINED" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Salvar consentimento" }));

        expect(
            await screen.findByText("O consentimento não pode mudar após a inclusão.")
        ).toBeInTheDocument();
        expect(situacao()).toHaveTextContent("Pendente");
    });

    it("bloqueia o registro para candidato inelegível", async () => {
        renderTela({ candidato: { ...candidatoElegivel, eligibilityStatus: "INELIGIBLE" } });

        expect(await screen.findByLabelText("Decisão do consentimento")).toBeDisabled();
        expect(screen.getByText(/Candidato inelegível/)).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Salvar consentimento" })
        ).not.toBeInTheDocument();
    });

    it("bloqueia o registro quando o estudo não está em recrutamento", async () => {
        renderTela({ status: "EXECUTION" });

        expect(await screen.findByLabelText("Decisão do consentimento")).toBeDisabled();
        expect(screen.getByText(/só é permitido com o estudo em/)).toBeInTheDocument();
    });

    it("deixa o pesquisador só consultar", async () => {
        renderTela({ role: "RESEARCHER" });

        expect(await screen.findByLabelText("Decisão do consentimento")).toBeDisabled();
        expect(screen.getByText(/modo somente leitura/)).toBeInTheDocument();
    });

    it("trata falha ao carregar e permite tentar novamente", async () => {
        vi.mocked(obterConsentimentoSimulado)
            .mockRejectedValueOnce(new ApiClientError("Não encontrado", { status: 404 }))
            .mockResolvedValueOnce({ studyId: 10, candidateId: 102, status: "DECLINED" });

        renderTela();

        expect(
            await screen.findByText("Candidato ou estudo não encontrado para consentimento.")
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

        expect(await screen.findByLabelText("Decisão do consentimento")).toHaveValue("DECLINED");
    });

    it("volta para a lista de candidatos", async () => {
        const { onVoltar } = renderTela();

        await screen.findByLabelText("Decisão do consentimento");
        fireEvent.click(screen.getByRole("button", { name: "Voltar para candidatos" }));

        expect(onVoltar).toHaveBeenCalledTimes(1);
    });
});
