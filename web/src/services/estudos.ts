import { apiRequest } from "./api/apiClient";
import type {
    DadosEstudoApi,
    DadosTransicaoEstudoApi,
    EstudoApi,
    HistoricoEstadoEstudo,
} from "../types/estudo";

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

export function alterarEstadoEstudo(id: number, dados: DadosTransicaoEstudoApi, token: string) {
    return apiRequest<EstudoApi>(`${ESTUDOS_PATH}/${id}/status`, {
        method: "PATCH",
        body: dados,
        token,
    });
}

export function obterHistoricoEstadoEstudo(id: number, token: string, signal?: AbortSignal) {
    return apiRequest<HistoricoEstadoEstudo[]>(`${ESTUDOS_PATH}/${id}/status-history`, {
        token,
        signal,
    });
}
