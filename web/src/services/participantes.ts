import { apiRequest } from "./api/apiClient";
import type { ParticipanteApi } from "../types/participante";

export function listarParticipantesPorEstudo(studyId: number, token: string, signal?: AbortSignal) {
    return apiRequest<ParticipanteApi[]>(`/api/studies/${studyId}/participants`, {
        token,
        signal,
    });
}

export function incluirParticipanteNoEstudo(studyId: number, candidateId: number, token: string) {
    return apiRequest<ParticipanteApi>(
        `/api/studies/${studyId}/candidates/${candidateId}/inclusion`,
        {
            method: "POST",
            token,
        }
    );
}
