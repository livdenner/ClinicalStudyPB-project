import { apiRequest } from "./api/apiClient";
import type { DadosEstudoApi, EstudoApi } from "../types/estudo";

const ESTUDOS_PATH = "/api/studies";

export function listarEstudos(token: string, signal?: AbortSignal) {
    return apiRequest<EstudoApi[]>(ESTUDOS_PATH, { token, signal });
}

export function obterEstudo(id: number, token: string, signal?: AbortSignal) {
    return apiRequest<EstudoApi>(`${ESTUDOS_PATH}/${id}`, { token, signal });
}

export function cadastrarEstudo(dados: DadosEstudoApi, token: string) {
    return apiRequest<EstudoApi>(ESTUDOS_PATH, {
        method: "POST",
        body: dados,
        token,
    });
}

export function editarEstudo(id: number, dados: DadosEstudoApi, token: string) {
    return apiRequest<EstudoApi>(`${ESTUDOS_PATH}/${id}`, {
        method: "PUT",
        body: dados,
        token,
    });
}
