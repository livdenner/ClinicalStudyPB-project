import { apiRequest } from "./api/apiClient";
import type { DadosVisitaPrevista, VisitaPrevista } from "../types/visita-prevista";

function caminho(studyId: number) {
    return `/api/studies/${studyId}/planned-visits`;
}

export function listarVisitasPrevistas(studyId: number, token: string, signal?: AbortSignal) {
    return apiRequest<VisitaPrevista[]>(caminho(studyId), { token, signal });
}

export function salvarVisitaPrevista(
    studyId: number,
    dados: DadosVisitaPrevista,
    version: number,
    token: string,
    visitId?: number
) {
    return apiRequest<VisitaPrevista>(
        visitId === undefined ? caminho(studyId) : `${caminho(studyId)}/${visitId}`,
        {
            method: visitId === undefined ? "POST" : "PUT",
            body: dados,
            headers: { "If-Match": `"${version}"` },
            token,
        }
    );
}

export function excluirVisitaPrevista(
    studyId: number,
    visitId: number,
    version: number,
    token: string
) {
    return apiRequest<void>(`${caminho(studyId)}/${visitId}`, {
        method: "DELETE",
        headers: { "If-Match": `"${version}"` },
        token,
    });
}
