import { ApiError } from '../services/api/apiClient';
import {
  AUTH_MESSAGES,
  AuthFlowError,
  getAuthErrorMessage,
} from '../services/auth/authErrors';

describe('mensagens de erro de autenticação', () => {
  it('shows a generic credential message without echoing the API text', () => {
    const error = new ApiError(
      'A conta participante@exemplo.test existe e o token header.payload.signature é inválido.',
      401,
      'INVALID_CREDENTIALS',
    );

    const message = getAuthErrorMessage(error, 'login');

    expect(message).toBe(AUTH_MESSAGES.invalidCredentials);
    expect(message).not.toContain('participante@exemplo.test');
    expect(message).not.toContain('header.payload.signature');
  });

  it('distinguishes an invalid activation from an expired one', () => {
    expect(
      getAuthErrorMessage(
        new ApiError('detalhe interno', 400, 'ACTIVATION_INVALID'),
        'activation',
      ),
    ).toBe(AUTH_MESSAGES.activationInvalid);
    expect(
      getAuthErrorMessage(
        new ApiError('detalhe interno', 410, 'ACTIVATION_EXPIRED'),
        'activation',
      ),
    ).toBe(AUTH_MESSAGES.activationExpired);
  });

  it('explains the password policy and the invalid current password', () => {
    expect(
      getAuthErrorMessage(
        new ApiError('detalhe interno', 400, 'PASSWORD_POLICY'),
        'password',
      ),
    ).toBe(AUTH_MESSAGES.passwordPolicy);
    expect(
      getAuthErrorMessage(
        new ApiError('detalhe interno', 400, 'CURRENT_PASSWORD_INVALID'),
        'password',
      ),
    ).toBe(AUTH_MESSAGES.currentPasswordInvalid);
  });

  it('does not treat every 403 as an expired session', () => {
    expect(
      getAuthErrorMessage(
        new ApiError('detalhe interno', 403, 'PASSWORD_CHANGE_REQUIRED'),
        'session',
      ),
    ).toBe(AUTH_MESSAGES.passwordChangeRequired);
    expect(
      getAuthErrorMessage(
        new ApiError('detalhe interno', 403, 'FORBIDDEN'),
        'session',
      ),
    ).toBe(AUTH_MESSAGES.forbidden);
  });

  it('distinguishes an invalid login from an expired authenticated session', () => {
    expect(
      getAuthErrorMessage(new ApiError('detalhe interno', 401), 'login'),
    ).toBe(AUTH_MESSAGES.invalidCredentials);
    expect(
      getAuthErrorMessage(new ApiError('detalhe interno', 401), 'activation'),
    ).toBe(AUTH_MESSAGES.activationInvalid);
    expect(
      getAuthErrorMessage(new ApiError('detalhe interno', 401), 'session'),
    ).toBe(AUTH_MESSAGES.sessionExpired);
  });

  it('maps the UNAUTHORIZED code to an expired session', () => {
    expect(
      getAuthErrorMessage(
        new ApiError('Token ausente ou inválido.', 401, 'UNAUTHORIZED'),
        'password',
      ),
    ).toBe(AUTH_MESSAGES.sessionExpired);
  });

  it('maps a server failure to a recoverable message', () => {
    expect(
      getAuthErrorMessage(new ApiError('detalhe interno', 503), 'session'),
    ).toBe(AUTH_MESSAGES.serviceUnavailable);
  });

  it('maps a network failure without discarding the session', () => {
    expect(
      getAuthErrorMessage(new TypeError('Network request failed'), 'session'),
    ).toBe(AUTH_MESSAGES.network);
  });

  it('falls back to a safe message for unknown failures', () => {
    expect(getAuthErrorMessage(new Error('erro interno'), 'login')).toBe(
      AUTH_MESSAGES.unexpected,
    );
  });

  it('keeps the safe message of an application flow error', () => {
    expect(
      getAuthErrorMessage(new AuthFlowError('ROLE_NOT_ALLOWED'), 'login'),
    ).toBe(AUTH_MESSAGES.forbidden);
    expect(
      getAuthErrorMessage(new AuthFlowError('SESSION_EXPIRED'), 'password'),
    ).toBe(AUTH_MESSAGES.sessionExpired);
    expect(
      getAuthErrorMessage(new AuthFlowError('INVALID_RESPONSE'), 'login'),
    ).toBe(AUTH_MESSAGES.unexpected);
  });
});
