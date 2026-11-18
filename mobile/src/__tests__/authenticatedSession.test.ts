import {
  classifyAuthenticatedFailure,
  withPasswordChangeRequired,
} from '../auth/authenticatedSession';
import type { AuthSession } from '../auth/session';
import { millisecondsUntilExpiration } from '../auth/useSessionExpiration';
import { ApiError } from '../services/api/apiClient';

function session(
  overrides: Partial<AuthSession['user']> = {},
): AuthSession {
  return {
    accessToken: 'header.payload.signature',
    expiresAt: 1_800_000_000_000,
    user: {
      id: 7,
      name: 'Raffael Souza',
      email: 'raffael@exemplo.test',
      role: 'PARTICIPANT',
      active: true,
      mustChangePassword: false,
      ...overrides,
    },
  };
}

describe('classificação de chamadas autenticadas', () => {
  it('trata 401 como sessão inválida, com ou sem código', () => {
    expect(
      classifyAuthenticatedFailure(
        new ApiError('Token ausente ou inválido.', 401, 'UNAUTHORIZED'),
      ),
    ).toBe('unauthorized');
    expect(
      classifyAuthenticatedFailure(
        new ApiError('A API respondeu com status 401.', 401),
      ),
    ).toBe('unauthorized');
  });

  it('separa a restrição de senha do acesso negado', () => {
    expect(
      classifyAuthenticatedFailure(
        new ApiError('Defina sua senha.', 403, 'PASSWORD_CHANGE_REQUIRED'),
      ),
    ).toBe('password-change-required');
    expect(
      classifyAuthenticatedFailure(
        new ApiError('Perfil sem permissão.', 403, 'FORBIDDEN'),
      ),
    ).toBe('forbidden');
  });

  it('não invalida a sessão por erros de validação, servidor ou rede', () => {
    expect(
      classifyAuthenticatedFailure(
        new ApiError('Senha atual inválida.', 400, 'CURRENT_PASSWORD_INVALID'),
      ),
    ).toBe('failure');
    expect(
      classifyAuthenticatedFailure(new ApiError('indisponível', 503)),
    ).toBe('failure');
    expect(
      classifyAuthenticatedFailure(new TypeError('Network request failed')),
    ).toBe('failure');
    expect(classifyAuthenticatedFailure(new Error('inesperado'))).toBe(
      'failure',
    );
  });

  it('marca a restrição preservando token e vencimento', () => {
    const current = session();
    const restricted = withPasswordChangeRequired(current);

    expect(restricted).not.toBe(current);
    expect(restricted.accessToken).toBe(current.accessToken);
    expect(restricted.expiresAt).toBe(current.expiresAt);
    expect(restricted.user.mustChangePassword).toBe(true);
    expect(current.user.mustChangePassword).toBe(false);
  });

  it('reaproveita a sessão já restrita', () => {
    const restricted = session({ mustChangePassword: true });
    expect(withPasswordChangeRequired(restricted)).toBe(restricted);
  });
});

describe('cálculo do tempo até o vencimento', () => {
  it('devolve o tempo restante em milissegundos', () => {
    expect(millisecondsUntilExpiration(1_000, 400)).toBe(600);
  });

  it('não devolve valores negativos nem instantes inválidos', () => {
    expect(millisecondsUntilExpiration(1_000, 1_000)).toBe(0);
    expect(millisecondsUntilExpiration(1_000, 5_000)).toBe(0);
    expect(millisecondsUntilExpiration(Number.NaN, 0)).toBe(0);
  });
});
