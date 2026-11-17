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

import ChangePasswordScreen from '../app/change-password';
import HomeScreen from '../app/index';
import LoginScreen from '../app/login';
import RootLayout from '../app/_layout';
import StudiesScreen from '../app/studies';
import { AUTH_MESSAGES } from '../services/auth/authErrors';
import * as authApi from '../services/auth/authApi';
import type { LoginResponse, UserRole } from '../services/auth/authTypes';

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../services/auth/authApi', () => ({
  loginWithPassword: jest.fn(),
  changeAccountPassword: jest.fn(),
  logoutSession: jest.fn(),
}));

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const api = authApi as jest.Mocked<typeof authApi>;

let storedValue: string | null = null;

beforeEach(() => {
  api.loginWithPassword.mockReset();
  api.changeAccountPassword.mockReset();
  api.logoutSession.mockReset();
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
      index: HomeScreen,
      studies: StudiesScreen,
      'change-password': ChangePasswordScreen,
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

describe('navegação autenticada do participante', () => {
  it('abre o login e bloqueia rotas privadas sem sessão', async () => {
    await renderApp('/');

    expect(await screen.findByText('Login')).toBeTruthy();
    await waitFor(() => expect(screen).toHavePathname('/login'));

    await act(async () => {
      router.push('/studies');
    });

    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(screen.queryByText('Estudos')).toBeNull();
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

  it('entra como participante e acessa os estudos', async () => {
    api.loginWithPassword.mockResolvedValue(loginResponse());
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

    expect(
      await screen.findByText(
        'Esta tela é apenas um destino provisório para demonstrar a navegação.',
      ),
    ).toBeTruthy();
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
