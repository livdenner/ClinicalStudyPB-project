import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "../../types/auth";
import type { CandidatoApi, EstudoComStatusApi } from "../../types/candidato";
import type { ConsentimentoSimuladoApi, StatusConsentimentoApi } from "../../types/consentimento";
import { ConsentimentoSimulado } from "./ConsentimentoSimulado";

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

const candidatoElegivel: CandidatoApi = {
    id: 102,
    studyId: 10,
    name: "Candidato 021",
    age: 55,
    eligibilityStatus: "ELIGIBLE",
};

const candidatoInelegivel: CandidatoApi = {
    ...candidatoElegivel,
    id: 103,
    name: "Candidato 030",
    eligibilityStatus: "INELIGIBLE",
};

function resposta(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status });
}

function renderConsentimento({
    estudo = estudoRecrutamento,
    candidato = candidatoElegivel,
    role = "COORDINATOR" as UserRole,
    responsavelNome = "Carla Coordenadora",
    termoInicial = undefined as string | undefined,
    onVoltar = vi.fn(),
    onAtualizarConsentimentoCandidato = vi.fn<
        (id: number, status: StatusConsentimentoApi, termo: string) => void
    >(),
} = {}) {
    return {
        onVoltar,
        onAtualizarConsentimentoCandidato,
        ...render(
            <ConsentimentoSimulado
                estudo={estudo}
                candidato={candidato}
                token="token-coordenador"
                role={role}
                responsavelNome={responsavelNome}
                termoInicial={termoInicial}
                onVoltar={onVoltar}
                onAtualizarConsentimentoCandidato={onAtualizarConsentimentoCandidato}
            />
        ),
    };
}

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("Tela de consentimento simulado (RF10 - T14.3 / T14.4)", () => {
    it("indica explicitamente aviso simulado e distingue visualmente candidato sem registro (Pendente)", async () => {
        const pendenteApi: ConsentimentoSimuladoApi = {
            studyId: 10,
            candidateId: 102,
            status: "PENDING",
        };

        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(resposta(pendenteApi));

        renderConsentimento();

        expect(
            screen.getByRole("note", { name: "Aviso de consentimento simulado" })
        ).toHaveTextContent(/estritamente simulado e utiliza apenas dados fictícios/i);

        await screen.findByRole("heading", { name: "Resumo do consentimento gravado" });

        const cardSituacao = screen.getByRole("status", {
            name: "Situação atual do consentimento",
        });
        expect(cardSituacao).toHaveTextContent("Pendente");
        expect(cardSituacao).toHaveTextContent(
            /Nenhuma decisão de consentimento simulado foi registrada/i
        );
        expect(screen.getByText("Aguardando registro")).toBeInTheDocument();
        expect(screen.getByText("Não registrado")).toBeInTheDocument();
    });

    it("consulta e exibe resumo de consentimento existente (Aceito) com data, hora e responsável", async () => {
        const aceitoApi: ConsentimentoSimuladoApi = {
            studyId: 10,
            candidateId: 102,
            status: "GRANTED",
            recordedAt: "2026-11-09T14:30:00Z",
        };

        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(resposta(aceitoApi));

        const { onAtualizarConsentimentoCandidato } = renderConsentimento({
            termoInicial: "TCLE-CARDIO-2026-V2",
        });

        const secaoResumo = await screen.findByRole("region", {
            name: "Resumo do consentimento gravado",
        });

        const cardSituacao = screen.getByRole("status", {
            name: "Situação atual do consentimento",
        });
        expect(cardSituacao).toHaveTextContent("Aceito");
        expect(cardSituacao).toHaveTextContent(
            /O candidato manifestou aceite ao termo de consentimento simulado/i
        );

        expect(within(secaoResumo).getByText("Aceito")).toBeInTheDocument();
        expect(within(secaoResumo).getByText("TCLE-CARDIO-2026-V2")).toBeInTheDocument();
        expect(within(secaoResumo).getByText("09/11/2026")).toBeInTheDocument();
        expect(within(secaoResumo).getByText("Carla Coordenadora")).toBeInTheDocument();
        expect(onAtualizarConsentimentoCandidato).toHaveBeenCalledWith(
            102,
            "GRANTED",
            "TCLE-CARDIO-2026-V2"
        );
    });

    it("registra aceite (GRANTED), confere payload enviado ao cliente HTTP e atualiza o resumo", async () => {
        const pendenteApi: ConsentimentoSimuladoApi = {
            studyId: 10,
            candidateId: 102,
            status: "PENDING",
        };

        const gravadoApi: ConsentimentoSimuladoApi = {
            studyId: 10,
            candidateId: 102,
            status: "GRANTED",
            recordedAt: "2026-11-09T18:45:00Z",
        };

        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(pendenteApi))
            .mockResolvedValueOnce(resposta(gravadoApi));

        const { onAtualizarConsentimentoCandidato } = renderConsentimento();

        const inputTermo = await screen.findByLabelText("Identificação do termo simulado");
        fireEvent.change(inputTermo, { target: { value: "  TCLE-SIMULADO-ACEITE-01  " } });

        const selectDecisao = screen.getByLabelText("Decisão do consentimento");
        fireEvent.change(selectDecisao, { target: { value: "GRANTED" } });

        fireEvent.click(screen.getByRole("button", { name: "Salvar consentimento" }));

        expect(
            await screen.findByText("Consentimento simulado registrado com sucesso.")
        ).toBeInTheDocument();

        const [url, options] = fetchMock.mock.calls[1];
        expect(url).toBe("/api/studies/10/candidates/102/consent");
        expect(options?.method).toBe("PUT");
        expect(JSON.parse(String(options?.body))).toEqual({
            status: "GRANTED",
        });

        expect(onAtualizarConsentimentoCandidato).toHaveBeenCalledWith(
            102,
            "GRANTED",
            "TCLE-SIMULADO-ACEITE-01"
        );
        expect(screen.getByText("TCLE-SIMULADO-ACEITE-01")).toBeInTheDocument();
    });

    it("registra recusa (DECLINED) e distingue visualmente o estado Recusado", async () => {
        const pendenteApi: ConsentimentoSimuladoApi = {
            studyId: 10,
            candidateId: 102,
            status: "PENDING",
        };

        const recusadoApi: ConsentimentoSimuladoApi = {
            studyId: 10,
            candidateId: 102,
            status: "DECLINED",
            recordedAt: "2026-11-09T19:10:00Z",
        };

        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(pendenteApi))
            .mockResolvedValueOnce(resposta(recusadoApi));

        const { onAtualizarConsentimentoCandidato } = renderConsentimento();

        const selectDecisao = await screen.findByLabelText("Decisão do consentimento");
        fireEvent.change(selectDecisao, { target: { value: "DECLINED" } });

        fireEvent.click(screen.getByRole("button", { name: "Salvar consentimento" }));

        expect(
            await screen.findByText("Consentimento simulado registrado com sucesso.")
        ).toBeInTheDocument();

        const [url, options] = fetchMock.mock.calls[1];
        expect(url).toBe("/api/studies/10/candidates/102/consent");
        expect(options?.method).toBe("PUT");
        expect(JSON.parse(String(options?.body))).toEqual({
            status: "DECLINED",
        });

        const cardSituacao = screen.getByRole("status", {
            name: "Situação atual do consentimento",
        });
        expect(cardSituacao).toHaveTextContent("Recusado");
        expect(cardSituacao).toHaveTextContent(
            /O candidato recusou o termo de consentimento simulado/i
        );
        expect(onAtualizarConsentimentoCandidato).toHaveBeenCalledWith(
            102,
            "DECLINED",
            "TCLE-SIMULADO-ESTUDO-10-v1"
        );
    });

    it("valida campos obrigatórios antes de submeter à API", async () => {
        const pendenteApi: ConsentimentoSimuladoApi = {
            studyId: 10,
            candidateId: 102,
            status: "PENDING",
        };

        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(pendenteApi));

        renderConsentimento();

        const inputTermo = await screen.findByLabelText("Identificação do termo simulado");
        fireEvent.change(inputTermo, { target: { value: "   " } });

        fireEvent.click(screen.getByRole("button", { name: "Salvar consentimento" }));

        expect(
            await screen.findByText("Informe a identificação do termo simulado.")
        ).toBeInTheDocument();
        expect(
            screen.getByText("Selecione a decisão do consentimento (aceite ou recusa).")
        ).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        fireEvent.change(inputTermo, { target: { value: "TCLE-VALIDO-V1" } });
        fireEvent.click(screen.getByRole("button", { name: "Salvar consentimento" }));

        expect(
            await screen.findByText("Selecione a decisão do consentimento (aceite ou recusa).")
        ).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("exibe mensagens claras para falha HTTP no carregamento e conflito (HTTP 409) no salvamento", async () => {
        const pendenteApi: ConsentimentoSimuladoApi = {
            studyId: 10,
            candidateId: 102,
            status: "PENDING",
        };

        vi.spyOn(globalThis, "fetch")
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(resposta(pendenteApi))
            .mockResolvedValueOnce(
                resposta(
                    {
                        code: "CONSENT_CONFLICT",
                        message: "O consentimento não pode ser alterado após a inclusão.",
                    },
                    409
                )
            );

        renderConsentimento();

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Não foi possível carregar os dados do consentimento simulado."
        );

        fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

        const selectDecisao = await screen.findByLabelText("Decisão do consentimento");
        fireEvent.change(selectDecisao, { target: { value: "GRANTED" } });
        fireEvent.click(screen.getByRole("button", { name: "Salvar consentimento" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "O consentimento não pode ser alterado após a inclusão."
        );
    });

    it("bloqueia gravação para perfil não autorizado, estudo fora de recrutamento ou candidato inelegível", async () => {
        const pendenteApi: ConsentimentoSimuladoApi = {
            studyId: 10,
            candidateId: 102,
            status: "PENDING",
        };

        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(resposta(pendenteApi))
            .mockResolvedValueOnce(resposta(pendenteApi))
            .mockResolvedValueOnce(resposta(pendenteApi));

        const { unmount } = renderConsentimento({ role: "RESEARCHER" });

        expect(await screen.findByLabelText("Identificação do termo simulado")).toBeDisabled();
        expect(screen.getByLabelText("Decisão do consentimento")).toBeDisabled();
        expect(screen.getByText(/Apenas o coordenador pode registrar/i)).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Salvar consentimento" })
        ).not.toBeInTheDocument();

        unmount();

        const { unmount: unmountPlanejamento } = renderConsentimento({
            estudo: estudoPlanejamento,
            role: "COORDINATOR",
        });

        expect(await screen.findByLabelText("Identificação do termo simulado")).toBeDisabled();
        expect(
            screen.getByText(/só é permitido com o estudo em recrutamento/i)
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Salvar consentimento" })
        ).not.toBeInTheDocument();

        unmountPlanejamento();

        renderConsentimento({
            candidato: candidatoInelegivel,
            role: "COORDINATOR",
        });

        expect(await screen.findByLabelText("Identificação do termo simulado")).toBeDisabled();
        expect(screen.getByText(/Candidato inelegível/i)).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Salvar consentimento" })
        ).not.toBeInTheDocument();
    });
});
