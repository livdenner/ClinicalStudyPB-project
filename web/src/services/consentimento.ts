import { apiRequest } from "./api/apiClient";
import type { ConsentimentoSimuladoApi } from "../types/consentimento";

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
