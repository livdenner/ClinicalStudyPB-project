import { ApiError } from '../services/api/apiClient';
import type { AuthSession } from './session';

/**
 * Classificação de uma falha ocorrida em chamada autenticada.
 *
 * - `unauthorized`: token ausente, inválido ou vencido (HTTP 401).
 * - `password-change-required`: sessão restrita que precisa definir a senha
 *   (HTTP 403 com código próprio); a sessão continua utilizável.
 * - `forbidden`: perfil sem permissão (HTTP 403); a sessão continua válida.
 * - `failure`: rede, servidor ou erro inesperado; nada é invalidado.
 */
export type AuthenticatedFailure =
  | 'unauthorized'
  | 'password-change-required'
  | 'forbidden'
  | 'failure';

/**
 * Classifica o erro pelo status e pelo código estável da API, nunca pelo texto.
 * O código é conferido antes do status porque `PASSWORD_CHANGE_REQUIRED` chega
 * como 403 e não pode ser confundido com expiração.
 *
 * @param error Erro lançado pela operação autenticada.
 */
export function classifyAuthenticatedFailure(
  error: unknown,
): AuthenticatedFailure {
  if (error instanceof ApiError) {
    if (error.code === 'PASSWORD_CHANGE_REQUIRED') {
      return 'password-change-required';
    }
    if (error.status === 401) {
      return 'unauthorized';
    }
    if (error.status === 403) {
      return 'forbidden';
    }
  }

  return 'failure';
}

/**
 * Devolve a sessão marcada como restrita sem alterar token ou vencimento.
 * Retorna a mesma instância quando a restrição já estava aplicada.
 *
 * @param session Sessão atual do participante.
 */
export function withPasswordChangeRequired(
  session: AuthSession,
): AuthSession {
  if (session.user.mustChangePassword) {
    return session;
  }

  return {
    ...session,
    user: { ...session.user, mustChangePassword: true },
  };
}
