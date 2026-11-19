import { apiRequest } from "./api/apiClient";
import type {
    DadosAgendamentoVisita,
    DadosDesfechoVisita,
    FiltrosVisitasEstudo,
    VisitaAgendada,
} from "../types/visita-agendada";

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

/** Consulta visitas reais do estudo com os filtros previstos no OpenAPI. @author Lívia */
export function listarVisitasDoEstudo(
    studyId: number,
    filtros: FiltrosVisitasEstudo,
    token: string,
    signal?: AbortSignal
) {
    const query = new URLSearchParams();
    if (filtros.status) query.set("status", filtros.status);
    if (filtros.participantId !== undefined)
        query.set("participantId", String(filtros.participantId));
    const parametros = query.toString();
    return apiRequest<VisitaAgendada[]>(
        `/api/studies/${studyId}/visits${parametros ? `?${parametros}` : ""}`,
        { token, signal }
    );
}

/** Recupera a situação e a versão atuais de uma visita após um conflito. @author Lívia */
export function obterVisitaAgendada(
    studyId: number,
    participantId: number,
    visitId: number,
    token: string,
    signal?: AbortSignal
) {
    return apiRequest<VisitaAgendada>(`${caminho(studyId, participantId)}/${visitId}`, {
        token,
        signal,
    });
}

/** Registra o desfecho usando a versão da visita agendada, não a do estudo. @author Lívia */
export function registrarDesfechoVisita(
    visita: VisitaAgendada,
    dados: DadosDesfechoVisita,
    token: string
) {
    return apiRequest<VisitaAgendada>(
        `${caminho(visita.studyId, visita.participantId)}/${visita.id}/outcome`,
        {
            method: "POST",
            body: dados,
            headers: { "If-Match": `"${visita.version}"` },
            token,
        }
    );
}
