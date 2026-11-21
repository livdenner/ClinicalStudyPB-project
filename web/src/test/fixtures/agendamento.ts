import { fireEvent, within } from "@testing-library/react";
import { vi } from "vitest";
import type { EstudoComStatusApi } from "../../types/candidato";
import type { ParticipanteApi } from "../../types/participante";
import type { VisitaAgendada } from "../../types/visita-agendada";
import type { VisitaPrevista } from "../../types/visita-prevista";

/** Dados exclusivamente fictícios e HTTP isolado dos testes RF12. @author Lívia */
export const estudoAgendamento: EstudoComStatusApi = {
    id: 10,
    version: 0,
    title: "Estudo fictício de agendamento",
    objective: "Demonstração de visitas",
    responsibleUserId: 2,
    startDate: "2027-01-01",
    endDate: "2027-12-31",
    participantLimit: 5,
    status: "RECRUITMENT",
};

export const participanteAgendamento: ParticipanteApi = {
    id: 50,
    studyId: 10,
    candidateId: 101,
    candidateName: "Pessoa de demonstração",
    includedAt: "2026-11-18T12:00:00Z",
    status: "ACTIVE",
};

export const visitaPrevistaAgendamento: VisitaPrevista = {
    id: 7,
    studyId: 10,
    name: "Avaliação fictícia",
    plannedDate: "2027-02-10",
    position: 1,
    activities: [
        { id: 1, position: 1, name: "Entrevista fictícia", description: "Dados de demonstração" },
    ],
};

export const visitaAgendada: VisitaAgendada = {
    id: 80,
    studyId: 10,
    participantId: 50,
    participantName: participanteAgendamento.candidateName,
    plannedVisitId: 7,
    plannedVisitName: visitaPrevistaAgendamento.name,
    scheduledAt: "2027-02-10T12:00:00.000Z",
    status: "SCHEDULED",
    createdByUserId: 9,
    createdAt: "2026-11-18T12:00:00Z",
    version: 0,
};

export const caminhoAgenda = "/api/studies/10/participants/50/visits";
export const caminhoPrevistas = "/api/studies/10/planned-visits";
export const dataHoraFormulario = "2027-02-10T09:00";

export function respostaHttp(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

type RespostaSimulada = Response | Error | Promise<Response>;

/** Toda chamada passa pelo mock; rotas não declaradas falham sem acessar a rede. @author Lívia */
export function simularHttp(rotas: Record<string, RespostaSimulada | RespostaSimulada[]>) {
    const filas = new Map(
        Object.entries(rotas).map(([rota, valor]) => [
            rota,
            Array.isArray(valor) ? [...valor] : [valor],
        ])
    );
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const rota = `${(init?.method ?? "GET").toUpperCase()} ${String(input)}`;
        const fila = filas.get(rota);
        if (!fila?.length) throw new Error(`HTTP não simulado: ${rota}`);
        const proxima = fila.length > 1 ? fila.shift()! : fila[0];
        if (proxima instanceof Error) throw proxima;
        return (await proxima).clone();
    });
}

export function rotasAgenda(visitas: VisitaAgendada[] = []) {
    return {
        [`GET ${caminhoAgenda}`]: respostaHttp(visitas),
        [`GET ${caminhoPrevistas}`]: respostaHttp([visitaPrevistaAgendamento]),
    };
}

export async function preencherAgendamento(dialog: HTMLElement, dataHora = dataHoraFormulario) {
    const tela = within(dialog);
    await tela.findByRole("option", { name: visitaPrevistaAgendamento.name });
    fireEvent.change(tela.getByLabelText(/Visita prevista/), { target: { value: "7" } });
    fireEvent.change(tela.getByLabelText(/Data e hora/), { target: { value: dataHora } });
}
