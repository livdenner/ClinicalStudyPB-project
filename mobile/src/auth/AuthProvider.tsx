import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  classifyAuthenticatedFailure,
  withPasswordChangeRequired,
} from './authenticatedSession';
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
import { useSessionExpiration } from './useSessionExpiration';

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
  /**
   * Executa uma chamada autenticada com o token da sessão atual. O provider
   * confere o vencimento antes da chamada, invalida a sessão uma única vez em
   * caso de 401 e descarta respostas de sessões que já foram substituídas.
   */
  runAuthenticated<T>(operation: (accessToken: string) => Promise<T>): Promise<T>;
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

/** A limpeza é sempre tentada e o retorno indica se o registro foi removido. */
async function clearStoredSession(storage: SessionStorage): Promise<boolean> {
  try {
    await storage.clear();
    return true;
  } catch {
    return false;
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
  const persistedRef = useRef(false);
  const sessionRef = useRef<AuthSession | null>(null);
  /**
   * Identidade da sessão. Cresce ao autenticar, sair ou invalidar e permite
   * descartar respostas de uma sessão que já não é a atual.
   */
  const generationRef = useRef(0);
  /** Identidade da tentativa de autenticação (login, ativação ou senha). */
  const attemptRef = useRef(0);

  useEffect(() => {
    let active = true;

    async function restore(): Promise<void> {
      const result = await readStoredSession(storage);
      if (!active) {
        return;
      }

      persistedRef.current = false;

      if (result.status === 'restored') {
        const restored = result.session;

        if (isSessionExpired(restored)) {
          persistedRef.current = false;
          await clearStoredSession(storage);
          if (!active) {
            return;
          }
          sessionRef.current = null;
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
          persistedRef.current = false;
          await clearStoredSession(storage);
          if (!active) {
            return;
          }
          sessionRef.current = null;
          setState({
            status: 'anonymous',
            session: null,
            notice: { tone: 'error', message: AUTH_MESSAGES.forbidden },
            persistenceWarning: null,
          });
          return;
        }

        persistedRef.current = true;
        generationRef.current += 1;
        sessionRef.current = restored;
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

  /**
   * Encerra a sessão atual e limpa o armazenamento. A geração é trocada antes
   * da limpeza para que requisições e callbacks antigos não afetem a próxima
   * sessão; chamadas concorrentes de invalidação, portanto, só limpam uma vez.
   */
  const invalidateSession = useCallback(
    async (notice: SessionNotice): Promise<void> => {
      attemptRef.current += 1;
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      const wasPersisted = persistedRef.current;
      persistedRef.current = false;
      sessionRef.current = null;

      setState({
        status: 'anonymous',
        session: null,
        notice,
        persistenceWarning: null,
      });

      const cleared = await clearStoredSession(storage);
      if (
        !cleared &&
        wasPersisted &&
        generationRef.current === generation
      ) {
        setState((previous) =>
          previous.status === 'anonymous'
            ? {
                ...previous,
                notice: {
                  tone: 'warning',
                  message: AUTH_MESSAGES.sessionCleanupFailed,
                },
              }
            : previous,
        );
      }
    },
    [storage],
  );

  const requirePasswordChange = useCallback(
    async (session: AuthSession): Promise<void> => {
      if (sessionRef.current !== session) {
        return;
      }

      const updated = withPasswordChangeRequired(session);
      if (updated === session) {
        return;
      }

      sessionRef.current = updated;
      setState((previous) =>
        previous.status === 'authenticated' && previous.session === session
          ? { ...previous, session: updated }
          : previous,
      );

      const persisted = await persistSession(storage, updated);
      if (sessionRef.current !== updated) {
        // A sessão mudou durante a gravação: preserva a sessão mais recente
        // em vez de deixar o registro antigo no armazenamento.
        const current = sessionRef.current;
        if (current !== null) {
          await persistSession(storage, current);
        }
        return;
      }

      persistedRef.current = persisted;
      setState((previous) =>
        previous.session === updated
          ? {
              ...previous,
              persistenceWarning: persisted
                ? null
                : AUTH_MESSAGES.persistenceFailed,
            }
          : previous,
      );
    },
    [storage],
  );

  /**
   * Executa a operação com o token atual e aplica a política central:
   * 401 invalida a sessão; `PASSWORD_CHANGE_REQUIRED` apenas restringe;
   * 403 e falhas de rede/servidor não apagam a sessão.
   */
  const runAuthenticated = useCallback(
    async <T,>(
      operation: (accessToken: string) => Promise<T>,
    ): Promise<T> => {
      const current = sessionRef.current;
      if (current === null) {
        throw new AuthFlowError('SESSION_EXPIRED');
      }

      if (isSessionExpired(current)) {
        await invalidateSession({
          tone: 'warning',
          message: AUTH_MESSAGES.sessionExpired,
        });
        throw new AuthFlowError('SESSION_EXPIRED');
      }

      const generation = generationRef.current;

      let result: T;
      try {
        result = await operation(current.accessToken);
      } catch (error) {
        if (generation !== generationRef.current) {
          throw new AuthFlowError('STALE_REQUEST');
        }

        switch (classifyAuthenticatedFailure(error)) {
          case 'unauthorized':
            await invalidateSession({
              tone: 'warning',
              message: AUTH_MESSAGES.sessionExpired,
            });
            throw new AuthFlowError('SESSION_EXPIRED');
          case 'password-change-required':
            await requirePasswordChange(current);
            throw new AuthFlowError('PASSWORD_CHANGE_REQUIRED');
          default:
            throw error;
        }
      }

      if (generation !== generationRef.current) {
        throw new AuthFlowError('STALE_REQUEST');
      }

      return result;
    },
    [invalidateSession, requirePasswordChange],
  );

  const completeAuthentication = useCallback(
    async (response: LoginResponse, attempt: number): Promise<AuthSession> => {
      const newSession = toSession(response);

      if (!isParticipant(newSession)) {
        // Nenhuma sessão é mantida na memória nem no armazenamento.
        throw new AuthFlowError('ROLE_NOT_ALLOWED');
      }

      if (attempt !== attemptRef.current) {
        throw new AuthFlowError('STALE_REQUEST');
      }

      if (isSessionExpired(newSession)) {
        await clearStoredSession(storage);
        throw new AuthFlowError('SESSION_EXPIRED');
      }

      const persisted = await persistSession(storage, newSession);

      if (attempt !== attemptRef.current) {
        // A resposta ficou obsoleta enquanto era gravada, por exemplo após
        // sair ou após outro login. Sem sessão atual, o registro é removido
        // para não ressuscitar o acesso; com sessão mais nova, ela é regravada.
        const current = sessionRef.current;
        if (current === null) {
          await clearStoredSession(storage);
        } else {
          await persistSession(storage, current);
        }
        throw new AuthFlowError('STALE_REQUEST');
      }

      generationRef.current += 1;
      sessionRef.current = newSession;
      persistedRef.current = persisted;
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
    async (credentials: LoginRequest): Promise<AuthSession> => {
      const attempt = attemptRef.current + 1;
      attemptRef.current = attempt;
      const response = await loginWithPassword(credentials);
      return completeAuthentication(response, attempt);
    },
    [completeAuthentication],
  );

  const activateAccount = useCallback(
    async (input: ActivationRequest): Promise<AuthSession> => {
      const attempt = attemptRef.current + 1;
      attemptRef.current = attempt;
      const response = await activateAccountWithCode(input);
      return completeAuthentication(response, attempt);
    },
    [completeAuthentication],
  );

  const signOut = useCallback(async (): Promise<void> => {
    attemptRef.current += 1;
    generationRef.current += 1;
    const generation = generationRef.current;
    const token = sessionRef.current?.accessToken ?? null;
    const wasPersisted = persistedRef.current;
    persistedRef.current = false;
    sessionRef.current = null;

    setState({
      status: 'anonymous',
      session: null,
      notice: null,
      persistenceWarning: null,
    });

    const cleared = await clearStoredSession(storage);
    if (
      !cleared &&
      wasPersisted &&
      generationRef.current === generation
    ) {
      setState((previous) =>
        previous.status === 'anonymous' && previous.session === null
          ? {
              ...previous,
              notice: {
                tone: 'warning',
                message: AUTH_MESSAGES.sessionCleanupFailed,
              },
            }
          : previous,
      );
    }

    if (token !== null) {
      try {
        await logoutSession(token);
      } catch {
        // O JWT é stateless: a falha ao confirmar o logout não mantém a sessão.
      }
    }
  }, [storage]);

  const changePassword = useCallback(
    async (input: PasswordChangeRequest): Promise<AuthSession> => {
      const attempt = attemptRef.current + 1;
      attemptRef.current = attempt;

      const response = await runAuthenticated((accessToken) =>
        changeAccountPassword(input, accessToken),
      );

      return completeAuthentication(response, attempt);
    },
    [runAuthenticated, completeAuthentication],
  );

  const clearNotice = useCallback((): void => {
    setState((previous) =>
      previous.notice === null ? previous : { ...previous, notice: null },
    );
  }, []);

  const handleExpiration = useCallback((): void => {
    if (sessionRef.current === null) {
      return;
    }

    void invalidateSession({
      tone: 'warning',
      message: AUTH_MESSAGES.sessionExpired,
    });
  }, [invalidateSession]);

  useSessionExpiration({
    expiresAt:
      state.status === 'authenticated'
        ? state.session?.expiresAt ?? null
        : null,
    onExpire: handleExpiration,
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      activateAccount,
      signOut,
      changePassword,
      runAuthenticated,
      clearNotice,
    }),
    [
      state,
      signIn,
      activateAccount,
      signOut,
      changePassword,
      runAuthenticated,
      clearNotice,
    ],
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
