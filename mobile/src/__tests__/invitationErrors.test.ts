import { ApiError } from '../services/api/apiClient';
import { AuthFlowError } from '../services/auth/authErrors';
import {
  getInvitationLoadErrorMessage,
  INVITATION_MESSAGES,
  isHandledSessionError,
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
