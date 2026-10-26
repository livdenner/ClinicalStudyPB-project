import { apiRequest } from "./api/apiClient";
import type { DadosCadastroUsuario, DadosEdicaoUsuario, Usuario } from "../types/usuario";

const USUARIOS_PATH = "/api/users";

export function listarUsuarios(token: string, signal?: AbortSignal) {
  return apiRequest<Usuario[]>(USUARIOS_PATH, { token, signal });
}

export function cadastrarUsuario(dados: DadosCadastroUsuario, token: string) {
  return apiRequest<Usuario>(USUARIOS_PATH, {
    method: "POST",
    body: dados,
    token,
  });
}

export function editarUsuario(id: number, dados: DadosEdicaoUsuario, token: string) {
  return apiRequest<Usuario>(`${USUARIOS_PATH}/${id}`, {
    method: "PUT",
    body: dados,
    token,
  });
}

export function alterarSituacaoUsuario(id: number, ativo: boolean, token: string) {
  const acao = ativo ? "activate" : "deactivate";
  return apiRequest<Usuario>(`${USUARIOS_PATH}/${id}/${acao}`, {
    method: "PATCH",
    token,
  });
}
