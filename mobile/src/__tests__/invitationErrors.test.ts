import { ApiError } from '../services/api/apiClient';
import { AuthFlowError } from '../services/auth/authErrors';
import {
  blocksInvitationDecision,
  getInvitationDecisionErrorMessage,
  getInvitationLoadErrorMessage,
  INVITATION_DECISION_MESSAGES,
  INVITATION_MESSAGES,
  isHandledSessionError,
  shouldRefreshInvitationAfterDecisionError,
} from '../services/invitations/invitationErrors';

describe('invitationErrors', () => {
  it('distingue convite indisponível na lista e no detalhe', () => {
    const notFound = new ApiError('não encontrado', 404, 'NOT_FOUND');

    expect(getInvitationLoadErrorMessage(notFound, 'detail')).toBe(
      INVITATION_MESSAGES.notAvailable,
    );
    expect(getInvitationLoadErrorMessage(notFound, 'list')).toBe(
      INVITATION_MESSAGES.listFailed,
    );
  });

  it('mantém mensagem genérica para acesso negado', () => {
    expect(
      getInvitationLoadErrorMessage(
        new ApiError('acesso negado', 403, 'FORBIDDEN'),
        'detail',
      ),
    ).toBe(INVITATION_MESSAGES.forbidden);
  });

  it('não expõe detalhes internos de falhas do servidor', () => {
    const internal = new ApiError(
      'NullPointerException na linha 42',
      500,
      undefined,
    );

    expect(getInvitationLoadErrorMessage(internal, 'detail')).toBe(
      INVITATION_MESSAGES.detailFailed,
    );
    expect(getInvitationLoadErrorMessage(internal, 'list')).toBe(
      INVITATION_MESSAGES.listFailed,
    );
  });

  it('trata falha de rede como erro recuperável', () => {
    expect(
      getInvitationLoadErrorMessage(new TypeError('Network request failed'), 'list'),
    ).toBe(INVITATION_MESSAGES.listFailed);
  });

  it('trata rejeição conhecida da decisão sem sugerir sucesso', () => {
    expect(
      getInvitationDecisionErrorMessage(
        new ApiError('decisão inválida', 400, 'INVALID_STATUS'),
      ),
    ).toBe(INVITATION_DECISION_MESSAGES.rejected);
    expect(
      getInvitationDecisionErrorMessage(
        new ApiError('conflito', 409, 'CONSENT_ALREADY_DECIDED'),
      ),
    ).toBe(INVITATION_DECISION_MESSAGES.conflict);
    expect(
      getInvitationDecisionErrorMessage(
        new ApiError('não encontrado', 404, 'NOT_FOUND'),
      ),
    ).toBe(INVITATION_MESSAGES.notAvailable);
  });

  it('trata falha incerta da decisão como possível gravação', () => {
    expect(
      getInvitationDecisionErrorMessage(new ApiError('falha', 500)),
    ).toBe(INVITATION_DECISION_MESSAGES.uncertain);
    expect(
      getInvitationDecisionErrorMessage(new TypeError('Network request failed')),
    ).toBe(INVITATION_DECISION_MESSAGES.uncertain);
  });

  it('classifica conflitos que bloqueiam nova decisão e exigem atualização', () => {
    const cancelled = new ApiError('cancelada', 409, 'CANDIDATE_CANCELLED');
    const unavailable = new ApiError(
      'indisponível',
      409,
      'CONSENT_NOT_AVAILABLE',
    );
    const closedStudy = new ApiError(
      'recrutamento encerrado',
      409,
      'STUDY_NOT_RECRUITING',
    );

    expect(getInvitationDecisionErrorMessage(cancelled)).toBe(
      INVITATION_DECISION_MESSAGES.cancelled,
    );
    expect(getInvitationDecisionErrorMessage(unavailable)).toBe(
      INVITATION_DECISION_MESSAGES.unavailable,
    );
    expect(getInvitationDecisionErrorMessage(closedStudy)).toBe(
      INVITATION_DECISION_MESSAGES.studyNotRecruiting,
    );
    expect(blocksInvitationDecision(cancelled)).toBe(true);
    expect(blocksInvitationDecision(unavailable)).toBe(true);
    expect(blocksInvitationDecision(closedStudy)).toBe(true);
    expect(
      blocksInvitationDecision(
        new ApiError('já decidido', 409, 'CONSENT_ALREADY_DECIDED'),
      ),
    ).toBe(false);
  });

  it('reconsulta apenas quando o estado remoto pode ter mudado', () => {
    expect(
      shouldRefreshInvitationAfterDecisionError(
        new ApiError('conflito', 409, 'CONSENT_ALREADY_DECIDED'),
      ),
    ).toBe(true);
    expect(
      shouldRefreshInvitationAfterDecisionError(new ApiError('falha', 500)),
    ).toBe(true);
    expect(
      shouldRefreshInvitationAfterDecisionError(new TypeError('Network request failed')),
    ).toBe(true);
    expect(
      shouldRefreshInvitationAfterDecisionError(
        new ApiError('status inválido', 400, 'INVALID_STATUS'),
      ),
    ).toBe(false);
  });

  it('ignora erros de sessão já tratados pelo provider', () => {
    expect(isHandledSessionError(new AuthFlowError('SESSION_EXPIRED'))).toBe(
      true,
    );
    expect(isHandledSessionError(new AuthFlowError('STALE_REQUEST'))).toBe(
      true,
    );
    expect(
      isHandledSessionError(new AuthFlowError('PASSWORD_CHANGE_REQUIRED')),
    ).toBe(true);
    expect(isHandledSessionError(new AuthFlowError('ROLE_NOT_ALLOWED'))).toBe(
      false,
    );
    expect(isHandledSessionError(new Error('falha qualquer'))).toBe(false);
  });
});
