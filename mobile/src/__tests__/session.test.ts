import {
  createSessionFromLoginResponse,
  InvalidAuthResponseError,
  isSessionExpired,
} from '../auth/session';
import type { LoginResponse } from '../services/auth/authTypes';

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);

function response(overrides: Partial<LoginResponse> = {}): LoginResponse {
  return {
    accessToken: 'header.payload.signature',
    tokenType: 'Bearer',
    expiresIn: 3600,
    user: {
      id: 10,
      name: 'Participante Fictício',
      email: 'participante@exemplo.test',
      role: 'PARTICIPANT',
      active: true,
      mustChangePassword: true,
    },
    ...overrides,
  };
}

describe('sessão autenticada', () => {
  it('derives the absolute expiration once from expiresIn', () => {
    const session = createSessionFromLoginResponse(response(), NOW);

    expect(session.expiresAt).toBe(NOW + 3600 * 1000);
    expect(session.user.role).toBe('PARTICIPANT');
    expect(session.user.mustChangePassword).toBe(true);
  });

  it('normalizes an omitted mustChangePassword to false', () => {
    const login = response();
    delete login.user.mustChangePassword;

    const session = createSessionFromLoginResponse(login, NOW);

    expect(session.user.mustChangePassword).toBe(false);
  });

  it('rejects invalid token and expiry metadata', () => {
    const invalidResponses: LoginResponse[] = [
      response({ accessToken: '' }),
      response({ tokenType: 'Basic' as unknown as 'Bearer' }),
      response({ expiresIn: 0 }),
      response({ expiresIn: -10 }),
      response({ expiresIn: Number.POSITIVE_INFINITY }),
    ];

    for (const login of invalidResponses) {
      expect(() => createSessionFromLoginResponse(login, NOW)).toThrow(
        InvalidAuthResponseError,
      );
    }
  });

  it('rejects an unknown role instead of creating a usable session', () => {
    const login = response();
    (login.user as { role: string }).role = 'UNKNOWN';

    expect(() => createSessionFromLoginResponse(login, NOW)).toThrow(
      InvalidAuthResponseError,
    );
  });

  it('rejects a user without a valid identifier', () => {
    const login = response();
    login.user.id = 0;

    expect(() => createSessionFromLoginResponse(login, NOW)).toThrow(
      InvalidAuthResponseError,
    );
  });

  it('treats the exact expiration instant as expired', () => {
    const session = createSessionFromLoginResponse(response(), NOW);

    expect(isSessionExpired(session, session.expiresAt - 1)).toBe(false);
    expect(isSessionExpired(session, session.expiresAt)).toBe(true);
    expect(isSessionExpired(session, session.expiresAt + 1)).toBe(true);
  });

  it('treats an invalid stored expiration as expired', () => {
    expect(isSessionExpired({ expiresAt: Number.NaN }, NOW)).toBe(true);
  });
});
