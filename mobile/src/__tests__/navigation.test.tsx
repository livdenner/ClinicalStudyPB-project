import { router } from 'expo-router';
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  testRouter,
  waitFor,
} from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';

import ActivationScreen from '../app/activation';
import ChangePasswordScreen from '../app/change-password';
import HomeScreen from '../app/index';
import InvitationDetailScreen from '../app/invitations/[candidateId]';
import InvitationsScreen from '../app/invitations/index';
import LoginScreen from '../app/login';
import RootLayout from '../app/_layout';
import StudiesScreen from '../app/studies';
import { ACTIVATION_MESSAGES } from '../auth/activationForm';
import { ApiError } from '../services/api/apiClient';
import { AUTH_MESSAGES } from '../services/auth/authErrors';
import * as authApi from '../services/auth/authApi';
import type { LoginResponse, UserRole } from '../services/auth/authTypes';
import * as studyApi from '../services/studies/studyApi';
import { STUDY_MESSAGES } from '../services/studies/studyErrors';

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../services/auth/authApi', () => ({
  activateAccountWithCode: jest.fn(),
  loginWithPassword: jest.fn(),
  changeAccountPassword: jest.fn(),
  logoutSession: jest.fn(),
}));

jest.mock('../services/studies/studyApi', () => ({
  ...jest.requireActual<typeof import('../services/studies/studyApi')>(
    '../services/studies/studyApi',
  ),
  listMyStudies: jest.fn(),
}));

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const api = authApi as jest.Mocked<typeof authApi>;
const studiesApi = studyApi as jest.Mocked<typeof studyApi>;

let storedValue: string | null = null;

beforeEach(() => {
  api.activateAccountWithCode.mockReset();
  api.loginWithPassword.mockReset();
  api.changeAccountPassword.mockReset();
  api.logoutSession.mockReset();
  studiesApi.listMyStudies.mockReset();
  secureStore.isAvailableAsync.mockReset();
  secureStore.getItemAsync.mockReset();
  secureStore.setItemAsync.mockReset();
  secureStore.deleteItemAsync.mockReset();

  storedValue = null;

  secureStore.isAvailableAsync.mockResolvedValue(true);
  secureStore.getItemAsync.mockImplementation(async () => storedValue);
  secureStore.setItemAsync.mockImplementation(async (_key, value) => {
    storedValue = value;
  });
  secureStore.deleteItemAsync.mockImplementation(async () => {
    storedValue = null;
  });
  api.logoutSession.mockResolvedValue(undefined);
});

function storeSession(
  options: {
    role?: UserRole;
    mustChangePassword?: boolean;
    expiresAt?: number;
  } = {},
): void {
  const {
    role = 'PARTICIPANT',
    mustChangePassword = false,
    expiresAt = Date.now() + 3_600_000,
  } = options;

  storedValue = JSON.stringify({
    version: 1,
    accessToken: 'header.payload.signature',
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

function loginResponse(
  role: UserRole = 'PARTICIPANT',
  mustChangePassword = false,
): LoginResponse {
  return {
    accessToken: 'novo.token.assinatura',
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

async function renderApp(initialUrl = '/') {
  return renderRouter(
    {
      _layout: RootLayout,
      login: LoginScreen,
      activation: ActivationScreen,
      index: HomeScreen,
      studies: StudiesScreen,
      'change-password': ChangePasswordScreen,
      'invitations/index': InvitationsScreen,
      'invitations/[candidateId]': InvitationDetailScreen,
    },
    { initialUrl },
  );
}

async function fillLogin(
  email = 'raffael@exemplo.test',
  password = 'Senha12345',
): Promise<void> {
  await fireEvent.changeText(
    screen.getByLabelText('E-mail institucional'),
    email,
  );
  await fireEvent.changeText(screen.getByLabelText('Senha'), password);
  await fireEvent.press(screen.getByText('Entrar'));
}

async function fillActivation(
  email = 'candidato@exemplo.test',
  activationCode = 'K7Q2-9MXA',
): Promise<void> {
  await fireEvent.changeText(
    screen.getByLabelText('E-mail cadastrado'),
    email,
  );
  await fireEvent.changeText(
    screen.getByLabelText('Código de ativação'),
    activationCode,
  );
  await fireEvent.press(screen.getByText('Ativar minha conta'));
}

describe('navegação autenticada do participante', () => {
  it('abre o login e bloqueia rotas privadas sem sessão', async () => {
    await renderApp('/');

    expect(await screen.findByText('Login')).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));

    await act(async () => {
      router.push('/studies');
    });

    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(screen.queryByText('Meus estudos')).toBeNull();
    expect(studiesApi.listMyStudies).not.toHaveBeenCalled();
  });

  it('valida os campos antes de chamar a API', async () => {
    await renderApp('/');
    await screen.findByText('Login');

    await fireEvent.press(screen.getByText('Entrar'));

    expect(
      await screen.findByText('Informe o e-mail institucional.'),
    ).toBeTruthy();
    expect(screen.getByText('Informe a senha.')).toBeTruthy();
    expect(api.loginWithPassword).not.toHaveBeenCalled();
  });

  it('abre o primeiro acesso a partir do login', async () => {
    await renderApp('/');
    await screen.findByText('Login');

    await fireEvent.press(screen.getByText('Ativar conta'));

    expect(await screen.findByText('Primeiro acesso')).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/activation'));
  });

  it('valida o formulário de ativação antes de chamar a API', async () => {
    await renderApp('/activation');
    await screen.findByText('Primeiro acesso');

    await fireEvent.press(screen.getByText('Ativar minha conta'));

    expect(
      await screen.findByText(ACTIVATION_MESSAGES.emailRequired),
    ).toBeTruthy();
    expect(
      screen.getByText(ACTIVATION_MESSAGES.codeRequired),
    ).toBeTruthy();
    expect(api.activateAccountWithCode).not.toHaveBeenCalled();
  });

  it('ativa a conta e encaminha para a definição da senha inicial', async () => {
    api.activateAccountWithCode.mockResolvedValue(
      loginResponse('PARTICIPANT', true),
    );
    await renderApp('/activation');
    await screen.findByText('Primeiro acesso');

    await fillActivation('  candidato@exemplo.test  ', '  K7Q2-9MXA  ');

    expect(await screen.findByText('Defina sua nova senha')).toBeTruthy();
    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );
    expect(api.activateAccountWithCode).toHaveBeenCalledWith({
      email: 'candidato@exemplo.test',
      activationCode: 'K7Q2-9MXA',
    });
    await waitFor(() =>
      expect(JSON.parse(String(storedValue))).toMatchObject({
        user: { mustChangePassword: true },
      }),
    );
  });

  it('explica quando o código de ativação expirou', async () => {
    api.activateAccountWithCode.mockRejectedValue(
      new ApiError('detalhe interno', 410, 'ACTIVATION_EXPIRED'),
    );
    await renderApp('/activation');
    await screen.findByText('Primeiro acesso');

    await fillActivation();

    expect(
      await screen.findByText(AUTH_MESSAGES.activationExpired),
    ).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/activation'));
    expect(storedValue).toBeNull();
  });

  it('mostra a mensagem genérica para um código inválido', async () => {
    api.activateAccountWithCode.mockRejectedValue(
      new ApiError('detalhe interno', 400, 'ACTIVATION_INVALID'),
    );
    await renderApp('/activation');
    await screen.findByText('Primeiro acesso');

    await fillActivation();

    expect(
      await screen.findByText(AUTH_MESSAGES.activationInvalid),
    ).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/activation'));
    expect(storedValue).toBeNull();
  });

  it('não mantém a sessão quando a ativação devolve outro perfil', async () => {
    api.activateAccountWithCode.mockResolvedValue(
      loginResponse('COORDINATOR', true),
    );
    await renderApp('/activation');
    await screen.findByText('Primeiro acesso');

    await fillActivation('coordenador@exemplo.test');

    expect(await screen.findByText(AUTH_MESSAGES.forbidden)).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/activation'));
    expect(storedValue).toBeNull();
  });

  it('bloqueia a ativação quando já existe sessão ativa', async () => {
    storeSession();

    await renderApp('/activation');

    expect(await screen.findByText(/Olá, Raffael!/)).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/'));
  });

  it('entra como participante e acessa os estudos', async () => {
    api.loginWithPassword.mockResolvedValue(loginResponse());
    studiesApi.listMyStudies.mockResolvedValue([]);
    await renderApp('/');
    await screen.findByText('Login');

    await fillLogin();

    expect(await screen.findByText(/Olá, Raffael!/)).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(api.loginWithPassword).toHaveBeenCalledWith({
      email: 'raffael@exemplo.test',
      password: 'Senha12345',
    });

    await testRouter.push('/studies');

    expect(await screen.findByText('Meus estudos')).toBeTruthy();
    expect(await screen.findByText(STUDY_MESSAGES.empty)).toBeTruthy();
  });

  it('leva o primeiro acesso direto para a definição de senha', async () => {
    api.loginWithPassword.mockResolvedValue(loginResponse('PARTICIPANT', true));
    await renderApp('/');
    await screen.findByText('Login');

    await fillLogin();

    expect(await screen.findByText('Defina sua nova senha')).toBeTruthy();
    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );

    await act(async () => {
      router.push('/');
    });

    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );
    expect(screen.queryByText(/Olá, Raffael!/)).toBeNull();
  });

  it('restaura uma sessão restrita somente na definição de senha', async () => {
    storeSession({ mustChangePassword: true });

    await renderApp('/');

    expect(await screen.findByText('Defina sua nova senha')).toBeTruthy();
    await waitFor(() =>
      expect(screen).toHavePathname('/change-password'),
    );
    expect(screen.getByText('Sair')).toBeTruthy();
  });

  it('descarta a sessão vencida e volta ao login', async () => {
    storeSession({ expiresAt: Date.now() - 60_000 });

    await renderApp('/');

    expect(
      await screen.findByText(AUTH_MESSAGES.sessionExpired),
    ).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
    await waitFor(() => expect(storedValue).toBeNull());
  });

  it('recusa uma sessão persistida de outro perfil', async () => {
    storeSession({ role: 'COORDINATOR' });

    await renderApp('/');

    expect(await screen.findByText(AUTH_MESSAGES.forbidden)).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
    await waitFor(() => expect(storedValue).toBeNull());
  });

  it('sai da conta mesmo com falha na API de logout', async () => {
    storeSession();
    api.logoutSession.mockRejectedValue(new Error('offline'));

    await renderApp('/');
    expect(await screen.findByText(/Olá, Raffael!/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Sair'));
    expect(
      await screen.findByText('Deseja sair da sua conta?'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Sair da conta'));

    expect(await screen.findByText('Login')).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));
    await waitFor(() => expect(storedValue).toBeNull());
    expect(api.logoutSession).toHaveBeenCalledWith(
      'header.payload.signature',
    );
  });

  it('conclui o primeiro acesso e chega ao início autenticado', async () => {
    storeSession({ mustChangePassword: true });
    api.changeAccountPassword.mockResolvedValue(loginResponse());

    await renderApp('/');
    await screen.findByText('Defina sua nova senha');

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
    expect(api.changeAccountPassword).toHaveBeenCalledWith(
      { newPassword: 'NovaSenha1' },
      'header.payload.signature',
    );
  });

  it('permite trocar a senha de uma conta já ativa', async () => {
    storeSession();
    api.changeAccountPassword.mockResolvedValue(loginResponse());

    await renderApp('/');
    await screen.findByText(/Olá, Raffael!/);

    await fireEvent.press(screen.getByText('Trocar senha'));
    await screen.findByLabelText('Senha atual');

    await fireEvent.changeText(
      screen.getByLabelText('Senha atual'),
      'SenhaAtual1',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Nova senha'),
      'NovaSenha1',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Confirmar nova senha'),
      'NovaSenha1',
    );
    await fireEvent.press(screen.getByText('Salvar nova senha'));

    expect(await screen.findByText(/Olá, Raffael!/)).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(api.changeAccountPassword).toHaveBeenCalledWith(
      {
        currentPassword: 'SenhaAtual1',
        newPassword: 'NovaSenha1',
      },
      'header.payload.signature',
    );
  });
});
