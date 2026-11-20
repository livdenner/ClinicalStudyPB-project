import { ApiError } from '../api/apiClient';
import { AuthFlowError } from '../auth/authErrors';

/** Mensagens dos convites; nenhuma revela dados de outra conta. */
export const INVITATION_MESSAGES = {
  listFailed:
    'Não foi possível carregar seus convites. Verifique sua conexão e tente novamente.',
  detailFailed:
    'Não foi possível carregar os detalhes deste convite. Tente novamente.',
  notAvailable:
    'Este convite não está mais disponível. Volte à lista para conferir seus convites.',
  forbidden: 'Sua conta não tem acesso a este convite.',
  invalidId: 'Convite inválido. Volte à lista e escolha um convite.',
  previousData:
    'Os convites exibidos são de uma consulta anterior e podem estar desatualizados.',
} as const;

/** Operação de leitura que originou o erro. */
export type InvitationLoadScope = 'list' | 'detail';

/**
 * Traduz um erro de consulta para uma mensagem segura. Usa status e código
 * estáveis, nunca o texto em português devolvido pela API.
 *
 * @param error Erro lançado pelo cliente HTTP ou pelo provider de sessão.
 * @param scope Lista ou detalhe.
 * @returns Mensagem pronta para exibição.
 */
export function getInvitationLoadErrorMessage(
  error: unknown,
  scope: InvitationLoadScope,
): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return scope === 'detail'
        ? INVITATION_MESSAGES.notAvailable
        : INVITATION_MESSAGES.listFailed;
    }
    if (error.status === 403) {
      return INVITATION_MESSAGES.forbidden;
    }
  }

  return scope === 'detail'
    ? INVITATION_MESSAGES.detailFailed
    : INVITATION_MESSAGES.listFailed;
}

/**
 * Indica erros já tratados pelo provider, que não devem aparecer como falha
 * de consulta na tela: sessão expirada, resposta obsoleta ou senha pendente.
 */
export function isHandledSessionError(error: unknown): boolean {
  return (
    error instanceof AuthFlowError &&
    (error.code === 'SESSION_EXPIRED' ||
      error.code === 'STALE_REQUEST' ||
      error.code === 'PASSWORD_CHANGE_REQUIRED')
  );
}
