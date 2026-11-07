import { ApiClientError } from "../services/api/apiClient";
import type { ApiFieldError } from "../types/api";

export function obterErrosCampos(
    erros: readonly ApiFieldError[],
    camposPermitidos: readonly string[]
): Record<string, string> {
    return Object.fromEntries(
        erros
            .filter(({ field }) => camposPermitidos.includes(field))
            .map(({ field, message }) => [field, message])
    );
}

export function obterMensagemErroAcesso(error: unknown): string | null {
    if (!(error instanceof ApiClientError)) return null;
    if (error.status === 401) return "Sua sessão expirou. Entre novamente.";
    if (error.status === 403) return "Você não tem permissão para realizar esta ação.";
    return null;
}
