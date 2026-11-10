import { apiRequest } from "./api/apiClient";
import type {
    AvaliacaoElegibilidadeApi,
    CriterioEstudoApi,
    DadosAvaliacaoElegibilidadeApi,
} from "../types/elegibilidade";

export function listarCriteriosPorEstudo(studyId: number, token: string, signal?: AbortSignal) {
    return apiRequest<CriterioEstudoApi[]>(`/api/studies/${studyId}/criteria`, {
        token,
        signal,
    });
}

export function obterAvaliacaoElegibilidade(
    studyId: number,
    candidateId: number,
    token: string,
    signal?: AbortSignal
) {
    return apiRequest<AvaliacaoElegibilidadeApi>(
        `/api/studies/${studyId}/candidates/${candidateId}/eligibility`,
        { token, signal }
    );
}

export function salvarAvaliacaoElegibilidade(
    studyId: number,
    candidateId: number,
    dados: DadosAvaliacaoElegibilidadeApi,
    token: string
) {
    return apiRequest<AvaliacaoElegibilidadeApi>(
        `/api/studies/${studyId}/candidates/${candidateId}/eligibility`,
        {
            method: "PUT",
            body: dados,
            token,
        }
    );
}
