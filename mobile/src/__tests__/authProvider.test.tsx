import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { AuthProvider, useSession } from '../auth/AuthProvider';
import type { AuthSession } from '../auth/session';
import type {
  SessionReadResult,
  SessionStorage,
} from '../auth/secureSessionStorage';
import { ApiError } from '../services/api/apiClient';
import { AUTH_MESSAGES, AuthFlowError } from '../services/auth/authErrors';
import * as authApi from '../services/auth/authApi';
import type {
  LoginResponse,
  UserRole,
} from '../services/auth/authTypes';

jest.mock('../services/auth/authApi', () => ({
  activateAccountWithCode: jest.fn(),
  loginWithPassword: jest.fn(),
  changeAccountPassword: jest.fn(),
  logoutSession: jest.fn(),
}));

const api = authApi as jest.Mocked<typeof authApi>;

const VALIDITY_MS = 3_600_000;

function createSession(
  overrides: Partial<AuthSession> = {},
  user: Partial<AuthSession['user']> = {},
): AuthSession {
  return {
    accessToken: 'header.payload.signature',
    expiresAt: Date.now() + VALIDITY_MS,
    user: {
      id: 7,
      name: 'Raffael Souza',
      email: 'raffael@exemplo.test',
      role: 'PARTICIPANT',
      active: true,
      mustChangePassword: false,
      ...user,
    },
    ...overrides,
  };
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

function createStorage(readResult: SessionReadResult = { status: 'empty' }) {
  return {
    read: jest.fn(async (): Promise<SessionReadResult> => readResult),
    save: jest.fn(async (_session: AuthSession): Promise<void> => {}),
    clear: jest.fn(async (): Promise<void> => {}),
  };
}

function renderAuth(storage: SessionStorage) {
  return renderHook(() => useSession(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <AuthProvider storage={storage}>{children}</AuthProvider>
    ),
  });
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function captureAppStateListeners(): Array<(status: AppStateStatus) => void> {
  const listeners: Array<(status: AppStateStatus) => void> = [];

  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation(
      ((event: string, handler: (status: AppStateStatus) => void) => {
        if (event === 'change') {
          listeners.push(handler);
        }
        return { remove: jest.fn() };
      }) as typeof AppState.addEventListener,
    );

  return listeners;
}

describe('RF02/RF03 — AuthProvider', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    api.logoutSession.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('restaura uma sessão de participante válida antes de liberar a área privada', async () => {
    const stored = createSession();
    const storage = createStorage({ status: 'restored', session: stored });

    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    expect(result.current.session).toEqual(stored);
    expect(result.current.notice).toBeNull();
    expect(storage.clear).not.toHaveBeenCalled();
  });

  it('descarta uma sessão vencida e avisa no login', async () => {
    const stored = createSession({ expiresAt: Date.now() - 60_000 });
    const storage = createStorage({ status: 'restored', session: stored });

    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    expect(result.current.session).toBeNull();
    expect(result.current.notice).toEqual({
      tone: 'warning',
      message: AUTH_MESSAGES.sessionExpired,
    });
    expect(storage.clear).toHaveBeenCalledTimes(1);
  });

  it('recusa uma sessão persistida de outro perfil e a remove', async () => {
    const stored = createSession({}, { role: 'RESEARCHER' });
    const storage = createStorage({ status: 'restored', session: stored });

    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    expect(result.current.session).toBeNull();
    expect(result.current.notice).toEqual({
      tone: 'error',
      message: AUTH_MESSAGES.forbidden,
    });
    expect(storage.clear).toHaveBeenCalledTimes(1);
  });

  it('não libera outro perfil nem quando a limpeza do registro falha', async () => {
    const stored = createSession({}, { role: 'RESEARCHER' });
    const storage = createStorage({ status: 'restored', session: stored });
    storage.clear.mockRejectedValueOnce(new Error('keychain bloqueado'));

    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    expect(result.current.session).toBeNull();
    expect(result.current.notice).toEqual({
      tone: 'error',
      message: AUTH_MESSAGES.forbidden,
    });
  });

  it('avisa quando o registro persistido está corrompido', async () => {
    const storage = createStorage({ status: 'invalid', reason: 'corrupted' });

    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    expect(result.current.notice).toEqual({
      tone: 'warning',
      message: AUTH_MESSAGES.sessionRestoreFailed,
    });
  });

  it('não trata armazenamento indisponível na web como falha de sessão', async () => {
    const storage = createStorage({ status: 'invalid', reason: 'unavailable' });

    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    expect(result.current.notice).toBeNull();
  });

  it('mantém em memória uma sessão de primeiro acesso e a persiste', async () => {
    api.loginWithPassword.mockResolvedValue(loginResponse('PARTICIPANT', true));
    const storage = createStorage();
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    let signed: AuthSession | null = null;
    await act(async () => {
      signed = await result.current.signIn({
        email: 'raffael@exemplo.test',
        password: 'Senha12345',
      });
    });

    expect(signed).not.toBeNull();
    expect((signed as AuthSession | null)?.user.mustChangePassword).toBe(true);
    expect(result.current.status).toBe('authenticated');
    expect(api.loginWithPassword).toHaveBeenCalledWith({
      email: 'raffael@exemplo.test',
      password: 'Senha12345',
    });
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'novo.token.assinatura' }),
    );
    expect(result.current.persistenceWarning).toBeNull();
  });

  it('ativa o primeiro acesso com o código e mantém a sessão restrita', async () => {
    api.activateAccountWithCode.mockResolvedValue(
      loginResponse('PARTICIPANT', true),
    );
    const storage = createStorage();
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    let activated: AuthSession | null = null;
    await act(async () => {
      activated = await result.current.activateAccount({
        email: 'candidato@exemplo.test',
        activationCode: 'K7Q2-9MXA',
      });
    });

    expect(activated).not.toBeNull();
    expect((activated as AuthSession | null)?.user.mustChangePassword).toBe(
      true,
    );
    expect(result.current.status).toBe('authenticated');
    expect(api.activateAccountWithCode).toHaveBeenCalledWith({
      email: 'candidato@exemplo.test',
      activationCode: 'K7Q2-9MXA',
    });
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'novo.token.assinatura' }),
    );
    expect(result.current.persistenceWarning).toBeNull();
  });

  it('não mantém a sessão quando a ativação devolve outro perfil', async () => {
    api.activateAccountWithCode.mockResolvedValue(
      loginResponse('COORDINATOR', true),
    );
    const storage = createStorage();
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    let caught: unknown = null;
    await act(async () => {
      try {
        await result.current.activateAccount({
          email: 'coordenador@exemplo.test',
          activationCode: 'K7Q2-9MXA',
        });
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(AuthFlowError);
    expect((caught as AuthFlowError).code).toBe('ROLE_NOT_ALLOWED');
    expect(result.current.status).toBe('anonymous');
    expect(result.current.session).toBeNull();
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('converte uma resposta inválida de ativação em erro seguro', async () => {
    api.activateAccountWithCode.mockResolvedValue({
      ...loginResponse('PARTICIPANT', true),
      accessToken: '   ',
    });
    const storage = createStorage();
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    let caught: unknown = null;
    await act(async () => {
      try {
        await result.current.activateAccount({
          email: 'candidato@exemplo.test',
          activationCode: 'K7Q2-9MXA',
        });
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(AuthFlowError);
    expect((caught as AuthFlowError).code).toBe('INVALID_RESPONSE');
    expect(result.current.status).toBe('anonymous');
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('não mantém sessão de um perfil que não é participante', async () => {
    api.loginWithPassword.mockResolvedValue(loginResponse('COORDINATOR'));
    const storage = createStorage();
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    let caught: unknown = null;
    await act(async () => {
      try {
        await result.current.signIn({
          email: 'coordenador@exemplo.test',
          password: 'Senha12345',
        });
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(AuthFlowError);
    expect((caught as AuthFlowError).code).toBe('ROLE_NOT_ALLOWED');
    expect(result.current.status).toBe('anonymous');
    expect(result.current.session).toBeNull();
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('mantém o novo acesso em memória quando a persistência falha', async () => {
    api.loginWithPassword.mockResolvedValue(loginResponse());
    const storage = createStorage();
    storage.save.mockRejectedValueOnce(new Error('write failure'));
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    await act(async () => {
      await result.current.signIn({
        email: 'raffael@exemplo.test',
        password: 'Senha12345',
      });
    });

    expect(result.current.status).toBe('authenticated');
    expect(result.current.persistenceWarning).toBe(
      AUTH_MESSAGES.persistenceFailed,
    );
  });

  it('converte uma resposta de autenticação inválida em erro seguro', async () => {
    api.loginWithPassword.mockResolvedValue({
      ...loginResponse(),
      expiresIn: 0,
    });
    const storage = createStorage();
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    let caught: unknown = null;
    await act(async () => {
      try {
        await result.current.signIn({
          email: 'raffael@exemplo.test',
          password: 'Senha12345',
        });
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(AuthFlowError);
    expect((caught as AuthFlowError).code).toBe('INVALID_RESPONSE');
    expect(result.current.status).toBe('anonymous');
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('sai localmente mesmo quando a API de logout falha', async () => {
    const stored = createSession();
    const storage = createStorage({ status: 'restored', session: stored });
    api.logoutSession.mockRejectedValue(new Error('offline'));
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.session).toBeNull();
    expect(result.current.notice).toBeNull();
    expect(storage.clear).toHaveBeenCalledTimes(1);
    expect(api.logoutSession).toHaveBeenCalledWith(stored.accessToken);
  });

  it('avisa quando a sessão não pôde ser limpa do armazenamento', async () => {
    const stored = createSession();
    const storage = createStorage({ status: 'restored', session: stored });
    storage.clear.mockRejectedValueOnce(new Error('keychain bloqueado'));
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.session).toBeNull();
    expect(result.current.notice).toEqual({
      tone: 'warning',
      message: AUTH_MESSAGES.sessionCleanupFailed,
    });
    expect(api.logoutSession).toHaveBeenCalledWith(stored.accessToken);
  });

  it('continua negando a sessão vencida mesmo quando a limpeza falha', async () => {
    const stored = createSession({ expiresAt: Date.now() - 60_000 });
    const storage = createStorage({ status: 'restored', session: stored });
    storage.clear.mockRejectedValueOnce(new Error('keychain bloqueado'));
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    expect(result.current.session).toBeNull();
    expect(result.current.notice).toEqual({
      tone: 'warning',
      message: AUTH_MESSAGES.sessionExpired,
    });
  });

  it('não avisa falha de limpeza quando a sessão existia apenas em memória', async () => {
    api.loginWithPassword.mockResolvedValue(loginResponse());
    const storage = createStorage();
    storage.save.mockRejectedValueOnce(new Error('disco cheio'));
    storage.clear.mockRejectedValueOnce(new Error('keychain bloqueado'));
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    await act(async () => {
      await result.current.signIn({
        email: 'raffael@exemplo.test',
        password: 'Senha12345',
      });
    });
    expect(result.current.persistenceWarning).toBe(
      AUTH_MESSAGES.persistenceFailed,
    );

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.notice).toBeNull();
  });

  it('substitui a sessão restrita ao definir a senha inicial', async () => {
    const stored = createSession({}, { mustChangePassword: true });
    const storage = createStorage({ status: 'restored', session: stored });
    api.changeAccountPassword.mockResolvedValue(loginResponse());
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.changePassword({ newPassword: 'NovaSenha1' });
    });

    expect(api.changeAccountPassword).toHaveBeenCalledWith(
      { newPassword: 'NovaSenha1' },
      stored.accessToken,
    );
    expect(result.current.session?.user.mustChangePassword).toBe(false);
    expect(result.current.session?.accessToken).toBe('novo.token.assinatura');
    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(result.current.persistenceWarning).toBeNull();
  });

  it('mantém a sessão atualizada em memória quando a persistência falha após a troca de senha', async () => {
    const stored = createSession({}, { mustChangePassword: true });
    const storage = createStorage({ status: 'restored', session: stored });
    api.changeAccountPassword.mockResolvedValue(loginResponse());
    storage.save.mockRejectedValueOnce(new Error('disco cheio'));
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.changePassword({ newPassword: 'NovaSenha1' });
    });

    expect(result.current.status).toBe('authenticated');
    expect(result.current.session?.accessToken).toBe('novo.token.assinatura');
    expect(result.current.persistenceWarning).toBe(
      AUTH_MESSAGES.persistenceFailed,
    );
  });

  it('encerra a sessão que venceu antes da troca de senha', async () => {
    const stored = createSession();
    const storage = createStorage({ status: 'restored', session: stored });
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    jest.spyOn(Date, 'now').mockReturnValue(stored.expiresAt + 1);

    await act(async () => {
      await expect(
        result.current.changePassword({ newPassword: 'NovaSenha1' }),
      ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.notice?.message).toBe(AUTH_MESSAGES.sessionExpired);
    expect(storage.clear).toHaveBeenCalledTimes(1);
    expect(api.changeAccountPassword).not.toHaveBeenCalled();
  });

  it('recusa a troca de senha sem sessão ativa', async () => {
    const storage = createStorage();
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.status).toBe('anonymous'));

    await act(async () => {
      await expect(
        result.current.changePassword({ newPassword: 'NovaSenha1' }),
      ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    });

    expect(api.changeAccountPassword).not.toHaveBeenCalled();
  });

  it('limpa o aviso depois que ele foi lido', async () => {
    const storage = createStorage({ status: 'invalid', reason: 'corrupted' });
    const { result } = await renderAuth(storage);

    await waitFor(() => expect(result.current.notice).not.toBeNull());

    await act(() => {
      result.current.clearNotice();
    });

    expect(result.current.notice).toBeNull();
  });

  describe('RF02/RF03 — chamadas autenticadas', () => {
    it('executa a operação com o token da sessão atual', async () => {
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      const operation = jest.fn(async (accessToken: string) => {
        expect(accessToken).toBe(stored.accessToken);
        return 'ok';
      });

      let received: string | null = null;
      await act(async () => {
        received = await result.current.runAuthenticated(operation);
      });

      expect(received).toBe('ok');
      expect(operation).toHaveBeenCalledWith(stored.accessToken);
      expect(storage.clear).not.toHaveBeenCalled();
    });

    it('invalida a sessão uma única vez em um 401 autenticado', async () => {
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      const operation = jest.fn(async () => {
        throw new ApiError('Token ausente ou inválido.', 401, 'UNAUTHORIZED');
      });

      await act(async () => {
        await expect(
          result.current.runAuthenticated(operation),
        ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
      });

      expect(result.current.status).toBe('anonymous');
      expect(result.current.session).toBeNull();
      expect(result.current.notice).toEqual({
        tone: 'warning',
        message: AUTH_MESSAGES.sessionExpired,
      });
      expect(storage.clear).toHaveBeenCalledTimes(1);
    });

    it('trata um 401 sem código e sem corpo legível como expiração', async () => {
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      await act(async () => {
        await expect(
          result.current.runAuthenticated(async () => {
            throw new ApiError('A API respondeu com status 401.', 401);
          }),
        ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
      });

      expect(result.current.status).toBe('anonymous');
      expect(storage.clear).toHaveBeenCalledTimes(1);
    });

    it('não mantém a sessão quando a limpeza após o 401 falha', async () => {
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      storage.clear.mockRejectedValueOnce(new Error('keychain bloqueado'));
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      await act(async () => {
        await expect(
          result.current.runAuthenticated(async () => {
            throw new ApiError('expirado', 401);
          }),
        ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
      });

      expect(result.current.status).toBe('anonymous');
      expect(result.current.session).toBeNull();
      expect(result.current.notice).toEqual({
        tone: 'warning',
        message: AUTH_MESSAGES.sessionCleanupFailed,
      });
    });

    it('invalida uma única vez diante de dois 401 simultâneos', async () => {
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      const first = deferred<void>();
      const second = deferred<void>();
      let firstCall!: Promise<void>;
      let secondCall!: Promise<void>;

      await act(async () => {
        firstCall = result.current.runAuthenticated(() => first.promise);
        secondCall = result.current.runAuthenticated(() => second.promise);
      });

      const settled = Promise.allSettled([firstCall, secondCall]);
      await act(async () => {
        first.reject(new ApiError('expirado', 401));
        second.reject(new ApiError('expirado', 401));
        await settled;
      });

      const outcomes = (await settled).map((outcome) =>
        outcome.status === 'rejected'
          ? (outcome.reason as AuthFlowError).code
          : 'fulfilled',
      );

      expect(outcomes.sort()).toEqual(['SESSION_EXPIRED', 'STALE_REQUEST']);
      expect(storage.clear).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe('anonymous');
    });

    it('descarta uma resposta que chega depois do logout', async () => {
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      const pending = deferred<string>();
      let call!: Promise<string>;
      await act(async () => {
        call = result.current.runAuthenticated(() => pending.promise);
      });

      await act(async () => {
        await result.current.signOut();
      });

      await act(async () => {
        pending.resolve('resposta atrasada');
        await expect(call).rejects.toMatchObject({ code: 'STALE_REQUEST' });
      });

      expect(result.current.status).toBe('anonymous');
      expect(result.current.session).toBeNull();
      expect(result.current.notice).toBeNull();
    });

    it('não apaga o token novo quando um 401 atrasado chega após outro login', async () => {
      const stored = createSession({ accessToken: 'token.antigo' });
      const storage = createStorage({ status: 'restored', session: stored });
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      const pending = deferred<void>();
      let call!: Promise<void>;
      await act(async () => {
        call = result.current.runAuthenticated(() => pending.promise);
      });

      await act(async () => {
        await result.current.signOut();
      });
      const clearsAfterSignOut = storage.clear.mock.calls.length;

      api.loginWithPassword.mockResolvedValue(loginResponse());
      await act(async () => {
        await result.current.signIn({
          email: 'raffael@exemplo.test',
          password: 'Senha12345',
        });
      });
      expect(result.current.status).toBe('authenticated');

      await act(async () => {
        pending.reject(new ApiError('expirado', 401));
        await expect(call).rejects.toMatchObject({ code: 'STALE_REQUEST' });
      });

      expect(result.current.status).toBe('authenticated');
      expect(result.current.session?.accessToken).toBe('novo.token.assinatura');
      expect(storage.clear).toHaveBeenCalledTimes(clearsAfterSignOut);
    });

    it('não apaga o token novo quando um 401 atrasado chega após a troca de senha', async () => {
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      api.changeAccountPassword.mockResolvedValue(loginResponse());
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      const pending = deferred<void>();
      let call!: Promise<void>;
      await act(async () => {
        call = result.current.runAuthenticated(() => pending.promise);
      });

      await act(async () => {
        await result.current.changePassword({ newPassword: 'NovaSenha1' });
      });
      expect(result.current.session?.accessToken).toBe('novo.token.assinatura');

      await act(async () => {
        pending.reject(new ApiError('expirado', 401));
        await expect(call).rejects.toMatchObject({ code: 'STALE_REQUEST' });
      });

      expect(result.current.status).toBe('authenticated');
      expect(result.current.session?.accessToken).toBe('novo.token.assinatura');
      expect(storage.clear).not.toHaveBeenCalled();
    });

    it('restrição de senha não invalida a sessão', async () => {
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      await act(async () => {
        await expect(
          result.current.runAuthenticated(async () => {
            throw new ApiError(
              'Defina sua senha para continuar.',
              403,
              'PASSWORD_CHANGE_REQUIRED',
            );
          }),
        ).rejects.toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
      });

      expect(result.current.status).toBe('authenticated');
      expect(result.current.session?.user.mustChangePassword).toBe(true);
      expect(storage.clear).not.toHaveBeenCalled();
      expect(storage.save).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: stored.accessToken,
          user: expect.objectContaining({ mustChangePassword: true }),
        }),
      );
    });

    it('acesso negado por perfil não invalida a sessão', async () => {
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      const forbidden = new ApiError('Perfil sem permissão.', 403, 'FORBIDDEN');

      await act(async () => {
        await expect(
          result.current.runAuthenticated(async () => {
            throw forbidden;
          }),
        ).rejects.toBe(forbidden);
      });

      expect(result.current.status).toBe('authenticated');
      expect(result.current.session?.accessToken).toBe(stored.accessToken);
      expect(storage.clear).not.toHaveBeenCalled();
    });

    it('falha de rede não invalida a sessão', async () => {
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      const networkError = new TypeError('Network request failed');

      await act(async () => {
        await expect(
          result.current.runAuthenticated(async () => {
            throw networkError;
          }),
        ).rejects.toBe(networkError);
      });

      expect(result.current.status).toBe('authenticated');
      expect(storage.clear).not.toHaveBeenCalled();
    });

    it('falha de servidor não invalida a sessão', async () => {
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      const unavailable = new ApiError('indisponível', 503);

      await act(async () => {
        await expect(
          result.current.runAuthenticated(async () => {
            throw unavailable;
          }),
        ).rejects.toBe(unavailable);
      });

      expect(result.current.status).toBe('authenticated');
      expect(storage.clear).not.toHaveBeenCalled();
    });

    it('confere a expiração antes de iniciar a chamada', async () => {
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      jest.spyOn(Date, 'now').mockReturnValue(stored.expiresAt);
      const operation = jest.fn(async () => 'não deveria executar');

      await act(async () => {
        await expect(
          result.current.runAuthenticated(operation),
        ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
      });

      expect(operation).not.toHaveBeenCalled();
      expect(result.current.status).toBe('anonymous');
      expect(result.current.notice?.message).toBe(AUTH_MESSAGES.sessionExpired);
      expect(storage.clear).toHaveBeenCalledTimes(1);
    });

    it('não executa chamada autenticada sem sessão', async () => {
      const storage = createStorage();
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('anonymous'));

      const operation = jest.fn(async () => 'não deveria executar');

      await act(async () => {
        await expect(
          result.current.runAuthenticated(operation),
        ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
      });

      expect(operation).not.toHaveBeenCalled();
      expect(storage.clear).not.toHaveBeenCalled();
    });
  });

  describe('RF02 — expiração por tempo', () => {
    it('encerra a sessão quando o timer alcança o vencimento', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-18T12:00:00.000Z'));
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      const { result, unmount } = await renderAuth(storage);
      await act(async () => {});
      expect(result.current.status).toBe('authenticated');

      await act(async () => {
        jest.advanceTimersByTime(VALIDITY_MS + 1);
      });

      expect(result.current.status).toBe('anonymous');
      expect(result.current.session).toBeNull();
      expect(result.current.notice?.message).toBe(AUTH_MESSAGES.sessionExpired);
      expect(storage.clear).toHaveBeenCalledTimes(1);
      unmount();
    });

    it('encerra a sessão ao voltar ao primeiro plano depois do vencimento', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-18T12:00:00.000Z'));
      const listeners = captureAppStateListeners();
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      const { result, unmount } = await renderAuth(storage);
      await act(async () => {});
      expect(result.current.status).toBe('authenticated');

      jest.setSystemTime(new Date(stored.expiresAt + 1_000));
      await act(async () => {
        for (const listener of listeners) {
          listener('active');
        }
      });

      expect(result.current.status).toBe('anonymous');
      expect(result.current.notice?.message).toBe(AUTH_MESSAGES.sessionExpired);
      expect(storage.clear).toHaveBeenCalledTimes(1);
      unmount();
    });

    it('mantém a sessão ao voltar ao primeiro plano antes do vencimento', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-18T12:00:00.000Z'));
      const listeners = captureAppStateListeners();
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      const { result, unmount } = await renderAuth(storage);
      await act(async () => {});
      expect(result.current.status).toBe('authenticated');

      jest.setSystemTime(new Date(stored.expiresAt - 60_000));
      await act(async () => {
        for (const listener of listeners) {
          listener('active');
        }
      });

      expect(result.current.status).toBe('authenticated');
      expect(storage.clear).not.toHaveBeenCalled();
      unmount();
    });

    it('cancela o timer ao sair e não invalida duas vezes', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-18T12:00:00.000Z'));
      const stored = createSession();
      const storage = createStorage({ status: 'restored', session: stored });
      const { result, unmount } = await renderAuth(storage);
      await act(async () => {});
      expect(result.current.status).toBe('authenticated');

      await act(async () => {
        await result.current.signOut();
      });
      const clearsAfterSignOut = storage.clear.mock.calls.length;

      await act(async () => {
        jest.advanceTimersByTime(VALIDITY_MS + 10);
      });

      expect(storage.clear).toHaveBeenCalledTimes(clearsAfterSignOut);
      expect(result.current.status).toBe('anonymous');
      expect(result.current.notice).toBeNull();
      unmount();
    });
  });

  describe('RF02 — respostas tardias de autenticação', () => {
    it('não autentica quando o login responde depois do logout', async () => {
      const storage = createStorage();
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('anonymous'));

      const pending = deferred<LoginResponse>();
      api.loginWithPassword.mockReturnValue(pending.promise);

      let call!: Promise<AuthSession>;
      await act(async () => {
        call = result.current.signIn({
          email: 'raffael@exemplo.test',
          password: 'Senha12345',
        });
      });

      await act(async () => {
        await result.current.signOut();
      });
      const clearsAfterSignOut = storage.clear.mock.calls.length;

      await act(async () => {
        pending.resolve(loginResponse());
        await expect(call).rejects.toMatchObject({ code: 'STALE_REQUEST' });
      });

      expect(result.current.status).toBe('anonymous');
      expect(result.current.session).toBeNull();
      expect(storage.save).not.toHaveBeenCalled();
      expect(storage.clear).toHaveBeenCalledTimes(clearsAfterSignOut);
    });

    it('não autentica quando a ativação responde depois do logout', async () => {
      const storage = createStorage();
      const { result } = await renderAuth(storage);
      await waitFor(() => expect(result.current.status).toBe('anonymous'));

      const pending = deferred<LoginResponse>();
      api.activateAccountWithCode.mockReturnValue(pending.promise);

      let call!: Promise<AuthSession>;
      await act(async () => {
        call = result.current.activateAccount({
          email: 'candidato@exemplo.test',
          activationCode: 'K7Q2-9MXA',
        });
      });

      await act(async () => {
        await result.current.signOut();
      });

      await act(async () => {
        pending.resolve(loginResponse('PARTICIPANT', true));
        await expect(call).rejects.toMatchObject({ code: 'STALE_REQUEST' });
      });

      expect(result.current.status).toBe('anonymous');
      expect(result.current.session).toBeNull();
      expect(storage.save).not.toHaveBeenCalled();
    });
  });
});
