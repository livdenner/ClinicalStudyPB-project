import { ApiError } from '../services/api/apiClient';
import {
  activateAccountWithCode,
  changeAccountPassword,
  loginWithPassword,
  logoutSession,
} from '../services/auth/authApi';
import type { LoginResponse } from '../services/auth/authTypes';

const BASE_URL = 'http://localhost:8080/api';

const loginResponse: LoginResponse = {
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
};

function mockResponse(
  status: number,
  body: unknown,
  contentType = 'application/json',
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: jest.fn().mockReturnValue(contentType) },
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(''),
  } as unknown as Response;
}

function readBody(init: RequestInit | undefined): Record<string, unknown> {
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

describe('authApi', () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalBaseUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
    }
  });

  it('posts login to auth/login without duplicating the /api prefix', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(200, loginResponse));

    await expect(
      loginWithPassword({
        email: '  participante@exemplo.test  ',
        password: 'Senha123',
      }),
    ).resolves.toEqual(loginResponse);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(url).toBe(`${BASE_URL}/auth/login`);
    expect(init?.method).toBe('POST');
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Authorization')).toBeNull();
    expect(readBody(init)).toEqual({
      email: 'participante@exemplo.test',
      password: 'Senha123',
    });
  });

  it('sends the activation code without changing its inner content or case', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(200, loginResponse));

    await activateAccountWithCode({
      email: 'candidato@exemplo.test',
      activationCode: '  AbC7-xY9/Q2  ',
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/auth/activation`);
    expect(init?.method).toBe('POST');
    expect(readBody(init)).toEqual({
      email: 'candidato@exemplo.test',
      activationCode: 'AbC7-xY9/Q2',
    });
  });

  it('changes the password with Bearer auth and omits an absent current password', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(200, loginResponse));

    await changeAccountPassword({ newPassword: 'NovaSenha2026' }, 'token-abc');

    const [url, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(url).toBe(`${BASE_URL}/auth/password`);
    expect(init?.method).toBe('PUT');
    expect(headers.get('Authorization')).toBe('Bearer token-abc');
    expect(readBody(init)).toEqual({ newPassword: 'NovaSenha2026' });
  });

  it('sends the current password untouched when it is required', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(200, loginResponse));

    await changeAccountPassword(
      {
        currentPassword: ' Senha atual 1 ',
        newPassword: ' NovaSenha2026 ',
      },
      'token-abc',
    );

    const [, init] = fetchSpy.mock.calls[0];
    expect(readBody(init)).toEqual({
      currentPassword: ' Senha atual 1 ',
      newPassword: ' NovaSenha2026 ',
    });
  });

  it('accepts the 204 response from logout without reading a JSON body', async () => {
    const response = mockResponse(204, undefined);
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(response);

    await expect(logoutSession('token-abc')).resolves.toBeUndefined();

    const [url, init] = fetchSpy.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(url).toBe(`${BASE_URL}/auth/logout`);
    expect(init?.method).toBe('POST');
    expect(headers.get('Authorization')).toBe('Bearer token-abc');
    expect(headers.get('Content-Type')).toBeNull();
    expect(response.json).not.toHaveBeenCalled();
  });

  it('preserves the activation expiry code from a problem+json response', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(
        410,
        {
          type: 'about:blank',
          title: 'Gone',
          status: 410,
          detail: 'O código de ativação expirou.',
          code: 'ACTIVATION_EXPIRED',
        },
        'application/problem+json',
      ),
    );

    await expect(
      activateAccountWithCode({
        email: 'candidato@exemplo.test',
        activationCode: 'codigo',
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 410,
      code: 'ACTIVATION_EXPIRED',
    } satisfies Partial<ApiError>);
  });

  it('keeps a 401 without a JSON body as an ApiError', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(401, undefined, ''));

    await expect(
      loginWithPassword({
        email: 'candidato@exemplo.test',
        password: 'Senha123',
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    } satisfies Partial<ApiError>);
  });
});
