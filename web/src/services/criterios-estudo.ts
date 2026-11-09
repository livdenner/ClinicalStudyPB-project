import { apiRequest } from "./api/apiClient";
import type { CriterioEstudo, DadosCriterioEstudo } from "../types/criterio-estudo";

export function listarCriteriosEstudo(studyId: number, token: string, signal?: AbortSignal) {
    return apiRequest<CriterioEstudo[]>(`/api/studies/${studyId}/criteria`, { token, signal });
}

export function cadastrarCriterioEstudo(
    studyId: number,
    dados: DadosCriterioEstudo,
    token: string
) {
    return apiRequest<CriterioEstudo>(`/api/studies/${studyId}/criteria`, {
        method: "POST",
        body: dados,
        token,
    });
}
