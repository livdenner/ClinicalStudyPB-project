import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  AUTH_MESSAGES,
  AuthFlowError,
} from '../services/auth/authErrors';
import {
  activateAccountWithCode,
  changeAccountPassword,
  loginWithPassword,
  logoutSession,
} from '../services/auth/authApi';
import type {
  ActivationRequest,
  LoginRequest,
  LoginResponse,
  PasswordChangeRequest,
} from '../services/auth/authTypes';
import {
  createSessionFromLoginResponse,
  InvalidAuthResponseError,
  isSessionExpired,
  type AuthSession,
} from './session';
import type {
  SessionReadResult,
  SessionStorage,
} from './secureSessionStorage';

/** Estados possíveis da sessão do aplicativo. */
export type SessionStatus = 'loading' | 'anonymous' | 'authenticated';

/** Mensagem exibida uma única vez na tela de login. */
export interface SessionNotice {
  tone: 'error' | 'warning' | 'info';
  message: string;
}

interface AuthState {
  status: SessionStatus;
  session: AuthSession | null;
  notice: SessionNotice | null;
  persistenceWarning: string | null;
}

export interface AuthContextValue extends AuthState {
  signIn(credentials: LoginRequest): Promise<AuthSession>;
  activateAccount(input: ActivationRequest): Promise<AuthSession>;
  signOut(): Promise<void>;
  changePassword(input: PasswordChangeRequest): Promise<AuthSession>;
  clearNotice(): void;
}

const INITIAL_STATE: AuthState = {
  status: 'loading',
  session: null,
  notice: null,
  persistenceWarning: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readStoredSession(
  storage: SessionStorage,
): Promise<SessionReadResult> {
  try {
    return await storage.read();
  } catch {
    return { status: 'invalid', reason: 'storage-error' };
  }
}

/** A limpeza é sempre tentada, mas nunca impede a saída da área privada. */
async function clearStoredSession(storage: SessionStorage): Promise<void> {
  try {
    await storage.clear();
  } catch {
    // A Entrega 4 consolida a recuperação de falhas persistentes de armazenamento.
  }
}

async function persistSession(
  storage: SessionStorage,
  session: AuthSession,
): Promise<boolean> {
  try {
    await storage.save(session);
    return true;
  } catch {
    return false;
  }
}

function toSession(response: LoginResponse): AuthSession {
  try {
    return createSessionFromLoginResponse(response);
  } catch (error) {
    if (error instanceof InvalidAuthResponseError) {
      throw new AuthFlowError('INVALID_RESPONSE');
    }
    throw error;
  }
}

function isParticipant(session: AuthSession): boolean {
  return session.user.role === 'PARTICIPANT';
}

interface AuthProviderProps {
  storage: SessionStorage;
}

/**
 * Mantém a sessão do participante em memória e no armazenamento seguro.
 * A restauração ocorre antes de a navegação liberar qualquer rota privada.
 */
export function AuthProvider({
  children,
  storage,
}: PropsWithChildren<AuthProviderProps>) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  useEffect(() => {
    let active = true;

    async function restore(): Promise<void> {
      const result = await readStoredSession(storage);
      if (!active) {
        return;
      }

      if (result.status === 'restored') {
        const restored = result.session;

        if (isSessionExpired(restored)) {
          await clearStoredSession(storage);
          if (!active) {
            return;
          }
          setState({
            status: 'anonymous',
            session: null,
            notice: {
              tone: 'warning',
              message: AUTH_MESSAGES.sessionExpired,
            },
            persistenceWarning: null,
          });
          return;
        }

        if (!isParticipant(restored)) {
          await clearStoredSession(storage);
          if (!active) {
            return;
          }
          setState({
            status: 'anonymous',
            session: null,
            notice: { tone: 'error', message: AUTH_MESSAGES.forbidden },
            persistenceWarning: null,
          });
          return;
        }

        setState({
          status: 'authenticated',
          session: restored,
          notice: null,
          persistenceWarning: null,
        });
        return;
      }

      const restoreFailed =
        result.status === 'invalid' &&
        (result.reason === 'corrupted' ||
          result.reason === 'unsupported-version' ||
          result.reason === 'storage-error');

      setState({
        status: 'anonymous',
        session: null,
        notice: restoreFailed
          ? { tone: 'warning', message: AUTH_MESSAGES.sessionRestoreFailed }
          : null,
        persistenceWarning: null,
      });
    }

    void restore();

    return () => {
      active = false;
    };
  }, [storage]);

  const completeAuthentication = useCallback(
    async (response: LoginResponse): Promise<AuthSession> => {
      const newSession = toSession(response);

      if (!isParticipant(newSession)) {
        // Nenhuma sessão é mantida na memória nem no armazenamento.
        throw new AuthFlowError('ROLE_NOT_ALLOWED');
      }

      const persisted = await persistSession(storage, newSession);
      setState({
        status: 'authenticated',
        session: newSession,
        notice: null,
        persistenceWarning: persisted
          ? null
          : AUTH_MESSAGES.persistenceFailed,
      });
      return newSession;
    },
    [storage],
  );

  const signIn = useCallback(
    async (credentials: LoginRequest): Promise<AuthSession> =>
      completeAuthentication(await loginWithPassword(credentials)),
    [completeAuthentication],
  );

  const activateAccount = useCallback(
    async (input: ActivationRequest): Promise<AuthSession> =>
      completeAuthentication(await activateAccountWithCode(input)),
    [completeAuthentication],
  );

  const signOut = useCallback(async (): Promise<void> => {
    const token = state.session?.accessToken ?? null;

    setState({
      status: 'anonymous',
      session: null,
      notice: null,
      persistenceWarning: null,
    });

    await clearStoredSession(storage);

    if (token !== null) {
      try {
        await logoutSession(token);
      } catch {
        // O JWT é stateless: a falha ao confirmar o logout não mantém a sessão.
      }
    }
  }, [state.session, storage]);

  const changePassword = useCallback(
    async (input: PasswordChangeRequest): Promise<AuthSession> => {
      const current = state.session;
      if (current === null) {
        throw new AuthFlowError('SESSION_EXPIRED');
      }

      if (isSessionExpired(current)) {
        await clearStoredSession(storage);
        setState({
          status: 'anonymous',
          session: null,
          notice: { tone: 'warning', message: AUTH_MESSAGES.sessionExpired },
          persistenceWarning: null,
        });
        throw new AuthFlowError('SESSION_EXPIRED');
      }

      const response = await changeAccountPassword(input, current.accessToken);
      const newSession = toSession(response);

      if (!isParticipant(newSession)) {
        throw new AuthFlowError('ROLE_NOT_ALLOWED');
      }

      const persisted = await persistSession(storage, newSession);
      setState({
        status: 'authenticated',
        session: newSession,
        notice: null,
        persistenceWarning: persisted
          ? null
          : AUTH_MESSAGES.persistenceFailed,
      });
      return newSession;
    },
    [state.session, storage],
  );

  const clearNotice = useCallback((): void => {
    setState((previous) =>
      previous.notice === null ? previous : { ...previous, notice: null },
    );
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      activateAccount,
      signOut,
      changePassword,
      clearNotice,
    }),
    [state, signIn, activateAccount, signOut, changePassword, clearNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Acessa a sessão atual e as ações de autenticação. */
export function useSession(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error('useSession precisa ser usado dentro de AuthProvider.');
  }
  return value;
}
