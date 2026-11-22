import { apiRequest } from "./api/apiClient";
import type {
    DadosResultadoAtividade,
    ResultadoAtividade,
    ResultadosVisita,
} from "../types/resultado-atividade";
import type { VisitaAgendada } from "../types/visita-agendada";

function caminhoResultados(visita: VisitaAgendada): string {
    return `/api/studies/${visita.studyId}/participants/${visita.participantId}/visits/${visita.id}/results`;
}

/** Consulta novamente as atividades e os resultados persistidos ao abrir a visita. @author Lívia */
export function consultarResultadosVisita(
    visita: VisitaAgendada,
    token: string,
    signal?: AbortSignal
) {
    return apiRequest<ResultadosVisita>(caminhoResultados(visita), { token, signal });
}

/** Salva uma atividade por chamada; omitir note remove a observação anterior. @author Lívia */
export function salvarResultadoAtividade(
    visita: VisitaAgendada,
    activityId: number,
    dados: DadosResultadoAtividade,
    token: string
) {
    return apiRequest<ResultadoAtividade>(`${caminhoResultados(visita)}/${activityId}`, {
        method: "PUT",
        body: dados,
        token,
    });
}
