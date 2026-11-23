import { ApiError } from '../api/apiClient';

export { isHandledSessionError } from '../auth/authErrors';

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

/** Mensagens das decisões de convite. */
export const INVITATION_DECISION_MESSAGES = {
  rejected:
    'Não foi possível registrar sua decisão. Atualize o convite para conferir a situação antes de tentar novamente.',
  conflict:
    'Este convite não aceita mais uma decisão pelo aplicativo. Atualize o convite para conferir a situação registrada.',
  uncertain:
    'Não foi possível confirmar se sua decisão foi registrada. Atualize o convite para verificar a situação antes de tentar novamente.',
  cancelled:
    'Este convite não está mais disponível para decisão. Atualize a lista de convites para conferir a situação.',
  unavailable:
    'Este convite não está disponível para decisão neste momento. Atualize a lista para conferir a situação.',
  studyNotRecruiting:
    'Este estudo não aceita decisões neste momento. A decisão não foi registrada.',
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
 * Traduz uma falha ao registrar a decisão para uma mensagem segura.
 * Falhas de rede/5xx são tratadas como resultado incerto: a decisão pode ter
 * sido gravada mesmo sem resposta, então a tela orienta a reconsultar em vez
 * de reenviar automaticamente.
 *
 * @param error Erro lançado pelo cliente HTTP ou pelo provider de sessão.
 * @returns Mensagem pronta para exibição.
 */
export function getInvitationDecisionErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return INVITATION_MESSAGES.notAvailable;
    }
    if (error.status === 403) {
      return INVITATION_MESSAGES.forbidden;
    }
    if (error.status === 409) {
      switch (error.code) {
        case 'CANDIDATE_CANCELLED':
          return INVITATION_DECISION_MESSAGES.cancelled;
        case 'CONSENT_NOT_AVAILABLE':
          return INVITATION_DECISION_MESSAGES.unavailable;
        case 'STUDY_NOT_RECRUITING':
          return INVITATION_DECISION_MESSAGES.studyNotRecruiting;
        default:
          break;
      }
      return INVITATION_DECISION_MESSAGES.conflict;
    }
    if (error.status >= 400 && error.status < 500) {
      return INVITATION_DECISION_MESSAGES.rejected;
    }
  }

  return INVITATION_DECISION_MESSAGES.uncertain;
}

/**
 * Indica se uma falha pode ter deixado a decisão gravada ou o estado remoto
 * alterado. A tela relê o detalhe, mas nunca repete o POST automaticamente.
 */
export function shouldRefreshInvitationAfterDecisionError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 409 || error.status >= 500;
  }

  return true;
}

/**
 * Indica conflitos que impedem nova tentativa enquanto o mesmo detalhe estiver
 * aberto. A pessoa ainda pode atualizar a lista para obter o estado remoto.
 */
export function blocksInvitationDecision(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    (error.code === 'CANDIDATE_CANCELLED' ||
      error.code === 'CONSENT_NOT_AVAILABLE' ||
      error.code === 'STUDY_NOT_RECRUITING')
  );
}

/**
 * Indica que o convite não está mais disponível ou acessível para a conta,
 * exigindo limpar dados exibidos anteriormente em vez de mantê-los na tela.
 */
export function isInvitationUnavailableError(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 404 || error.status === 403)
  );
}
