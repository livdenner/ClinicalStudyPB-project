import { apiRequest } from "./api/apiClient";
import type { CadastroCandidatoApi, CandidatoApi, DadosCandidatoApi } from "../types/candidato";

function getCandidatosPath(studyId: number): string {
    return `/api/studies/${studyId}/candidates`;
}

export function listarCandidatosPorEstudo(studyId: number, token: string, signal?: AbortSignal) {
    return apiRequest<CandidatoApi[]>(getCandidatosPath(studyId), { token, signal });
}

export function cadastrarCandidato(studyId: number, dados: DadosCandidatoApi, token: string) {
    return apiRequest<CadastroCandidatoApi>(getCandidatosPath(studyId), {
        method: "POST",
        body: dados,
        token,
    });
}
