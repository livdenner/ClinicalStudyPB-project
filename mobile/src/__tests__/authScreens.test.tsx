import { router } from 'expo-router';
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';

import RootLayout from '../app/_layout';
import ActivationScreen from '../app/activation';
import ChangePasswordScreen from '../app/change-password';
import HomeScreen from '../app/index';
import InvitationDetailScreen from '../app/invitations/[candidateId]';
import InvitationsScreen from '../app/invitations/index';
import LoginScreen from '../app/login';
import StudiesScreen from '../app/studies/index';
import StudyDetailScreen from '../app/studies/[participantId]';
import VisitDetailScreen from '../app/visits/[visitId]';
import VisitsScreen from '../app/visits/index';
import { ACTIVATION_MESSAGES } from '../auth/activationForm';
import { LOGIN_MESSAGES } from '../auth/loginForm';
import { PASSWORD_MESSAGES } from '../auth/passwordPolicy';
import { AUTH_MESSAGES } from '../services/auth/authErrors';
import type { LoginResponse, UserRole } from '../services/auth/authTypes';
import { STUDY_MESSAGES } from '../services/studies/studyErrors';

const BASE_URL = 'http://localhost:8080/api';

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>;

let storedValue: string | null = null;
let fetchSpy: jest.SpiedFunction<typeof globalThis.fetch>;
const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

function mockHttpResponse(
  status: number,
  body?: unknown,
  contentType = 'application/json',
): Response {
  const effectiveType = status === 204 ? '' : contentType;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: jest.fn((name: string) =>
        name.toLowerCase() === 'content-type' ? effectiveType : null,
      ),
    },
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : ''),
  } as unknown as Response;
}

function loginResponse(
  options: {
    role?: UserRole;
    mustChangePassword?: boolean;
    accessToken?: string;
  } = {},
): LoginResponse {
  const {
    role = 'PARTICIPANT',
    mustChangePassword = false,
    accessToken = 'token.jwt.valido',
  } = options;
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 3600,
    user: {
      id: 7,
      name: 'Raffael Souza',
      email: 'raffael@exemplo.test',
      role,
      active: true,
      mustChangePassword,
    },
  };
}

function storeSession(
  options: {
    role?: UserRole;
    mustChangePassword?: boolean;
    expiresAt?: number;
    accessToken?: string;
  } = {},
): void {
  const {
    role = 'PARTICIPANT',
    mustChangePassword = false,
    expiresAt = Date.now() + 3_600_000,
    accessToken = 'header.payload.signature',
  } = options;

  storedValue = JSON.stringify({
    version: 1,
    accessToken,
    expiresAt,
    user: {
      id: 7,
      name: 'Raffael Souza',
      email: 'raffael@exemplo.test',
      role,
      active: true,
      mustChangePassword,
    },
  });
}

async function renderApp(initialUrl = '/') {
  return renderRouter(
    {
      _layout: RootLayout,
      login: LoginScreen,
      activation: ActivationScreen,
      index: HomeScreen,
      'change-password': ChangePasswordScreen,
      'invitations/index': InvitationsScreen,
      'invitations/[candidateId]': InvitationDetailScreen,
      'studies/index': StudiesScreen,
      'studies/[participantId]': StudyDetailScreen,
      'visits/index': VisitsScreen,
      'visits/[visitId]': VisitDetailScreen,
    },
    { initialUrl },
  );
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = BASE_URL;
  storedValue = null;

  secureStore.isAvailableAsync.mockReset();
  secureStore.getItemAsync.mockReset();
  secureStore.setItemAsync.mockReset();
  secureStore.deleteItemAsync.mockReset();

  secureStore.isAvailableAsync.mockResolvedValue(true);
  secureStore.getItemAsync.mockImplementation(async () => storedValue);
  secureStore.setItemAsync.mockImplementation(async (_key, value) => {
    storedValue = value;
  });
  secureStore.deleteItemAsync.mockImplementation(async () => {
    storedValue = null;
  });

  fetchSpy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => {
      throw new Error('Chamada de rede real bloqueada nos testes.');
    });
});

afterEach(() => {
  jest.restoreAllMocks();
  if (originalBaseUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  } else {
    process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});

describe('RF02/RF03 — telas de autenticação, troca de senha e sessão expirada (HTTP simulado)', () => {
  it('RF02: autentica participante via POST /api/auth/login simulado e persiste sessão sem vazar senha', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockHttpResponse(200, loginResponse({ accessToken: 'jwt.participante.1' })),
    );

    await renderApp('/');
    await screen.findByText('Login');

    await fireEvent.changeText(
      screen.getByLabelText('E-mail institucional'),
      '  raffael@exemplo.test  ',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Senha'),
      'SenhaForte1',
    );
    await fireEvent.press(screen.getByText('Entrar'));

    expect(await screen.findByText(/Olá, Raffael!/)).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/'));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/auth/login`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'raffael@exemplo.test',
      password: 'SenhaForte1',
    });
    expect(storedValue).toContain('jwt.participante.1');
    expect(storedValue).not.toContain('SenhaForte1');
  });

  it('RF02: exibe erro seguro para 401 no login sem vazar texto da API e limpa erro ao alterar campos', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockHttpResponse(
        401,
        { code: 'INVALID_CREDENTIALS', detail: 'detalhe secreto do banco' },
        'application/problem+json',
      ),
    );

    await renderApp('/');
    await screen.findByText('Login');

    await fireEvent.press(screen.getByText('Entrar'));
    expect(
      await screen.findByText(LOGIN_MESSAGES.emailRequired),
    ).toBeTruthy();
    expect(screen.getByText(LOGIN_MESSAGES.passwordRequired)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();

    await fireEvent.changeText(
      screen.getByLabelText('E-mail institucional'),
      'raffael@exemplo.test',
    );
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'Errada123');
    expect(screen.queryByText(LOGIN_MESSAGES.emailRequired)).toBeNull();
    expect(screen.queryByText(LOGIN_MESSAGES.passwordRequired)).toBeNull();

    await fireEvent.press(screen.getByText('Entrar'));

    expect(
      await screen.findByText(AUTH_MESSAGES.invalidCredentials),
    ).toBeTruthy();
    expect(screen.queryByText(/detalhe secreto/)).toBeNull();
    expect(storedValue).toBeNull();

    await fireEvent.changeText(
      screen.getByLabelText('Senha'),
      'OutraSenha1',
    );
    expect(screen.queryByText(AUTH_MESSAGES.invalidCredentials)).toBeNull();
  });

  it('RF02: trata 503 e falha de rede (TypeError) no login sem criar sessão', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockHttpResponse(503, { message: 'indisponível' }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await renderApp('/login');
    await screen.findByText('Login');

    await fireEvent.changeText(
      screen.getByLabelText('E-mail institucional'),
      'raffael@exemplo.test',
    );
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'SenhaForte1');

    await fireEvent.press(screen.getByText('Entrar'));
    expect(
      await screen.findByText(AUTH_MESSAGES.serviceUnavailable),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Entrar'));
    expect(await screen.findByText(AUTH_MESSAGES.network)).toBeTruthy();
    expect(storedValue).toBeNull();
  });

  it('RF03: recusa login de perfil não participante (COORDINATOR) na tela de login sem salvar sessão', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockHttpResponse(200, loginResponse({ role: 'COORDINATOR' })),
    );

    await renderApp('/login');
    await screen.findByText('Login');

    await fireEvent.changeText(
      screen.getByLabelText('E-mail institucional'),
      'coord@exemplo.test',
    );
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'SenhaForte1');
    await fireEvent.press(screen.getByText('Entrar'));

    expect(await screen.findByText(AUTH_MESSAGES.forbidden)).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(storedValue).toBeNull();
  });

  it('RF02: ativa conta por código via POST /api/auth/activation simulado e encaminha para definição de senha', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockHttpResponse(
        200,
        loginResponse({
          mustChangePassword: true,
          accessToken: 'jwt.restrito.1',
        }),
      ),
    );

    await renderApp('/activation');
    await screen.findByText('Primeiro acesso');

    await fireEvent.changeText(
      screen.getByLabelText('E-mail cadastrado'),
      '  raffael@exemplo.test  ',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Código de ativação'),
      '  K7Q2-9mXa  ',
    );
    await fireEvent.press(screen.getByText('Ativar minha conta'));

    expect(await screen.findByText('Defina sua nova senha')).toBeTruthy();
    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/auth/activation`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'raffael@exemplo.test',
      activationCode: 'K7Q2-9mXa',
    });
  });

  it('RF02: trata 503 e falha de rede na ativação, limpa erro de validação ao digitar e volta ao login', async () => {
    fetchSpy
      .mockResolvedValueOnce(mockHttpResponse(503, { message: 'indisponível' }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await renderApp('/activation');
    await screen.findByText('Primeiro acesso');

    await fireEvent.press(screen.getByText('Ativar minha conta'));
    expect(
      await screen.findByText(ACTIVATION_MESSAGES.emailRequired),
    ).toBeTruthy();
    expect(screen.getByText(ACTIVATION_MESSAGES.codeRequired)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();

    await fireEvent.changeText(
      screen.getByLabelText('E-mail cadastrado'),
      'raffael@exemplo.test',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Código de ativação'),
      'K7Q2-9MXA',
    );
    expect(screen.queryByText(ACTIVATION_MESSAGES.emailRequired)).toBeNull();
    expect(screen.queryByText(ACTIVATION_MESSAGES.codeRequired)).toBeNull();

    await fireEvent.press(screen.getByText('Ativar minha conta'));
    expect(
      await screen.findByText(AUTH_MESSAGES.serviceUnavailable),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Ativar minha conta'));
    expect(await screen.findByText(AUTH_MESSAGES.network)).toBeTruthy();

    await fireEvent.press(screen.getByText('Voltar ao login'));
    expect(await screen.findByText('Login')).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
  });

  it('RF02/RF03 (CA): bloqueia todo o fluxo privado antes da troca de senha obrigatória e só libera após PUT /api/auth/password', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        mockHttpResponse(
          200,
          loginResponse({
            mustChangePassword: true,
            accessToken: 'jwt.restrito',
          }),
        ),
      )
      .mockResolvedValueOnce(
        mockHttpResponse(
          200,
          loginResponse({
            mustChangePassword: false,
            accessToken: 'jwt.liberado',
          }),
        ),
      )
      .mockResolvedValueOnce(mockHttpResponse(200, []));

    await renderApp('/activation');
    await screen.findByText('Primeiro acesso');

    await fireEvent.changeText(
      screen.getByLabelText('E-mail cadastrado'),
      'raffael@exemplo.test',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Código de ativação'),
      'K7Q2-9MXA',
    );
    await fireEvent.press(screen.getByText('Ativar minha conta'));

    expect(await screen.findByText('Defina sua nova senha')).toBeTruthy();

    for (const privateRoute of [
      '/',
      '/invitations',
      '/invitations/31',
      '/studies',
      '/studies/11',
      '/visits',
      '/visits/15',
    ] as const) {
      await act(async () => {
        router.push(privateRoute);
      });
      await waitFor(() =>
        expect(screen).toHavePathname('/change-password'),
      );
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByText('Definir senha'));
    expect(await screen.findByText(PASSWORD_MESSAGES.newRequired)).toBeTruthy();
    expect(screen.getByText(PASSWORD_MESSAGES.confirmRequired)).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await fireEvent.changeText(screen.getByLabelText('Nova senha'), 'fraca');
    await fireEvent.changeText(
      screen.getByLabelText('Confirmar nova senha'),
      'outra123',
    );
    await fireEvent.press(screen.getByText('Definir senha'));
    const policyError = await screen.findByText(PASSWORD_MESSAGES.policy);
    expect(policyError.props.accessibilityRole).toBe('alert');
    expect(screen.getByText(PASSWORD_MESSAGES.confirmMismatch)).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await fireEvent.changeText(
      screen.getByLabelText('Nova senha'),
      'NovaSenha1',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Confirmar nova senha'),
      'NovaSenha1',
    );
    await fireEvent.press(screen.getByText('Definir senha'));

    expect(await screen.findByText(/Olá, Raffael!/)).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/'));

    const [pwdUrl, pwdInit] = fetchSpy.mock.calls[1];
    const pwdHeaders = pwdInit?.headers as Headers;
    const pwdBody = JSON.parse(String(pwdInit?.body)) as Record<
      string,
      unknown
    >;
    expect(pwdUrl).toBe(`${BASE_URL}/auth/password`);
    expect(pwdInit?.method).toBe('PUT');
    expect(pwdHeaders.get('Authorization')).toBe('Bearer jwt.restrito');
    expect(pwdBody).toEqual({ newPassword: 'NovaSenha1' });
    expect('currentPassword' in pwdBody).toBe(false);

    await fireEvent.press(screen.getByText('Ver estudos'));
    await waitFor(() => expect(screen).toHavePathname('/studies'));
    expect(await screen.findByText(STUDY_MESSAGES.empty)).toBeTruthy();

    const [studiesUrl, studiesInit] = fetchSpy.mock.calls[2];
    const studiesHeaders = studiesInit?.headers as Headers;
    expect(studiesUrl).toBe(`${BASE_URL}/me/studies`);
    expect(studiesHeaders.get('Authorization')).toBe('Bearer jwt.liberado');
  });

  it('RF02/RF03: trata erros de API (503 e rede) na definição de senha inicial mantendo bloqueio e permite sair com confirmação', async () => {
    storeSession({ mustChangePassword: true, accessToken: 'jwt.restrito.2' });
    fetchSpy
      .mockResolvedValueOnce(mockHttpResponse(503, { message: 'indisponível' }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(mockHttpResponse(204));

    await renderApp('/');
    expect(await screen.findByText('Defina sua nova senha')).toBeTruthy();

    await fireEvent.changeText(
      screen.getByLabelText('Nova senha'),
      'NovaSenha1',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Confirmar nova senha'),
      'NovaSenha1',
    );

    await fireEvent.press(screen.getByText('Definir senha'));
    expect(
      await screen.findByText(AUTH_MESSAGES.serviceUnavailable),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Definir senha'));
    expect(await screen.findByText(AUTH_MESSAGES.network)).toBeTruthy();
    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );

    await fireEvent.press(screen.getByText('Sair'));
    expect(
      await screen.findByText('Deseja sair da sua conta?'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Cancelar'));
    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );

    await fireEvent.press(screen.getByText('Sair'));
    await fireEvent.press(screen.getByText('Sair da conta'));

    expect(await screen.findByText('Login')).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(storedValue).toBeNull();
    expect(fetchSpy.mock.calls[2][0]).toBe(`${BASE_URL}/auth/logout`);
  });

  it('RF02: valida formulário e trata erros de API na troca de senha de conta ativa (CURRENT_PASSWORD_INVALID, PASSWORD_POLICY, 401) e permite voltar', async () => {
    storeSession({ accessToken: 'jwt.ativo.1' });
    fetchSpy
      .mockResolvedValueOnce(
        mockHttpResponse(
          400,
          { code: 'CURRENT_PASSWORD_INVALID', detail: 'senha atual errada' },
          'application/problem+json',
        ),
      )
      .mockResolvedValueOnce(
        mockHttpResponse(
          400,
          { code: 'PASSWORD_POLICY', detail: 'fora da política' },
          'application/problem+json',
        ),
      )
      .mockResolvedValueOnce(
        mockHttpResponse(
          401,
          { code: 'UNAUTHORIZED', detail: 'expirado' },
          'application/problem+json',
        ),
      );

    await renderApp('/');
    expect(await screen.findByText(/Olá, Raffael!/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Trocar senha'));
    await screen.findByLabelText('Senha atual');

    await fireEvent.press(screen.getByText('Salvar nova senha'));
    expect(
      await screen.findByText(PASSWORD_MESSAGES.currentRequired),
    ).toBeTruthy();
    expect(screen.getByText(PASSWORD_MESSAGES.newRequired)).toBeTruthy();
    expect(screen.getByText(PASSWORD_MESSAGES.confirmRequired)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Senha atual'), 'Errada1');
    await fireEvent.changeText(
      screen.getByLabelText('Nova senha'),
      'NovaSenha1',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Confirmar nova senha'),
      'NovaSenha1',
    );
    await fireEvent.press(screen.getByText('Salvar nova senha'));

    expect(
      await screen.findByText(AUTH_MESSAGES.currentPasswordInvalid),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Salvar nova senha'));
    expect(await screen.findByText(AUTH_MESSAGES.passwordPolicy)).toBeTruthy();

    await fireEvent.press(screen.getByText('Voltar'));
    expect(await screen.findByText(/Olá, Raffael!/)).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/'));

    await fireEvent.press(screen.getByText('Trocar senha'));
    await screen.findByLabelText('Senha atual');
    await fireEvent.changeText(screen.getByLabelText('Senha atual'), 'Atual123');
    await fireEvent.changeText(
      screen.getByLabelText('Nova senha'),
      'NovaSenha2',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Confirmar nova senha'),
      'NovaSenha2',
    );
    await fireEvent.press(screen.getByText('Salvar nova senha'));

    expect(await screen.findByText(AUTH_MESSAGES.sessionExpired)).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(storedValue).toBeNull();
  });

  it('RF02: encerra sessão com aviso no login quando GET /api/me/studies retorna 401 e limpa aviso ao digitar', async () => {
    storeSession();
    fetchSpy.mockResolvedValueOnce(
      mockHttpResponse(
        401,
        { code: 'UNAUTHORIZED', detail: 'Token expirado no servidor.' },
        'application/problem+json',
      ),
    );

    await renderApp('/');
    expect(await screen.findByText(/Olá, Raffael!/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Ver estudos'));

    expect(await screen.findByText(AUTH_MESSAGES.sessionExpired)).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(screen.queryByText(/Token expirado no servidor/)).toBeNull();
    expect(storedValue).toBeNull();

    await fireEvent.changeText(
      screen.getByLabelText('E-mail institucional'),
      'raffael@exemplo.test',
    );
    expect(screen.queryByText(AUTH_MESSAGES.sessionExpired)).toBeNull();
  });

  it('RF02: descarta sessão expirada no armazenamento ao iniciar e volta ao login sem chamadas HTTP', async () => {
    storeSession({ expiresAt: Date.now() - 60_000 });

    await renderApp('/');

    expect(await screen.findByText(AUTH_MESSAGES.sessionExpired)).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(storedValue).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
