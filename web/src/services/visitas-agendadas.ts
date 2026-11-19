import { apiRequest } from "./api/apiClient";
import type { DadosAgendamentoVisita, VisitaAgendada } from "../types/visita-agendada";

function caminho(studyId: number, participantId: number) {
    return `/api/studies/${studyId}/participants/${participantId}/visits`;
}

/** Consulta a agenda do participante no estudo, incluindo os desfechos. @author Lívia */
export function listarVisitasAgendadas(
    studyId: number,
    participantId: number,
    token: string,
    signal?: AbortSignal
) {
    return apiRequest<VisitaAgendada[]>(caminho(studyId, participantId), { token, signal });
}

/** Agenda uma visita e devolve o registro confirmado pela API. @author Lívia */
export function agendarVisita(
    studyId: number,
    participantId: number,
    dados: DadosAgendamentoVisita,
    token: string
) {
    return apiRequest<VisitaAgendada>(caminho(studyId, participantId), {
        method: "POST",
        body: dados,
        token,
    });
}
