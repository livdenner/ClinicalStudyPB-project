import { apiRequest } from "./api/apiClient";
import type {
    CadastroCandidatoApi,
    CandidatoApi,
    DadosCandidatoApi,
    DadosCancelamentoCandidatoApi,
} from "../types/candidato";

function getCandidatosPath(studyId: number): string {
    return `/api/studies/${studyId}/candidates`;
}

/** Consulta candidatos, incluindo cancelados somente quando solicitado. @author Lívia */
export function listarCandidatosPorEstudo(
    studyId: number,
    token: string,
    signal?: AbortSignal,
    includeCancelled = false
) {
    const query = includeCancelled ? "?includeCancelled=true" : "";
    return apiRequest<CandidatoApi[]>(`${getCandidatosPath(studyId)}${query}`, { token, signal });
}

/** Recupera a situação atual do candidato após um conflito de cancelamento. @author Lívia */
export function obterCandidato(studyId: number, candidateId: number, token: string) {
    return apiRequest<CandidatoApi>(`${getCandidatosPath(studyId)}/${candidateId}`, { token });
}

/** Cancela a candidatura com motivo e devolve o registro confirmado pela API. @author Lívia */
export function cancelarCandidatura(
    studyId: number,
    candidateId: number,
    dados: DadosCancelamentoCandidatoApi,
    token: string
) {
    return apiRequest<CandidatoApi>(`${getCandidatosPath(studyId)}/${candidateId}/cancellation`, {
        method: "POST",
        body: dados,
        token,
    });
}

export function cadastrarCandidato(studyId: number, dados: DadosCandidatoApi, token: string) {
    return apiRequest<CadastroCandidatoApi>(getCandidatosPath(studyId), {
        method: "POST",
        body: dados,
        token,
    });
}
