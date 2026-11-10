import { apiRequest } from "./api/apiClient";
import type {
    ConsentimentoSimuladoApi,
    DadosConsentimentoSimuladoApi,
} from "../types/consentimento";

export function obterConsentimentoSimulado(
    studyId: number,
    candidateId: number,
    token: string,
    signal?: AbortSignal
) {
    return apiRequest<ConsentimentoSimuladoApi>(
        `/api/studies/${studyId}/candidates/${candidateId}/consent`,
        { token, signal }
    );
}

export function registrarConsentimentoSimulado(
    studyId: number,
    candidateId: number,
    dados: DadosConsentimentoSimuladoApi,
    token: string
) {
    return apiRequest<ConsentimentoSimuladoApi>(
        `/api/studies/${studyId}/candidates/${candidateId}/consent`,
        {
            method: "PUT",
            body: dados,
            token,
        }
    );
}
