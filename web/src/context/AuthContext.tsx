import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearStoredSession,
  isSessionExpired,
  loadStoredSession,
  loginRequest,
  logoutRequest,
  saveStoredSession,
} from "../services/auth";
import type { AuthenticatedUser, AuthSession } from "../types/auth";

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  sessionExpiredMessage: string | null;
  login: (email: string, password: string) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
  clearSessionExpiredMessage: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    loadStoredSession(),
  );
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    const remainingMs = session.expiresAt - Date.now();
    if (remainingMs <= 0) {
      clearStoredSession();
      setSession(null);
      setSessionExpiredMessage(
        "Sua sessão expirou. Faça login novamente para continuar.",
      );
      return;
    }

    const timerId = window.setTimeout(() => {
      clearStoredSession();
      setSession(null);
      setSessionExpiredMessage(
        "Sua sessão expirou. Faça login novamente para continuar.",
      );
    }, remainingMs);

    return () => window.clearTimeout(timerId);
  }, [session]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest({ email, password });
    const newSession = saveStoredSession(response);
    setSessionExpiredMessage(null);
    setSession(newSession);
    return newSession.user;
  }, []);

  const logout = useCallback(async () => {
    const currentToken = session?.accessToken;
    clearStoredSession();
    setSession(null);
    setSessionExpiredMessage(null);
    await logoutRequest(currentToken);
  }, [session?.accessToken]);

  const clearSessionExpiredMessage = useCallback(() => {
    setSessionExpiredMessage(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const validSession =
      session && !isSessionExpired(session) ? session : null;

    return {
      session: validSession,
      user: validSession?.user ?? null,
      isAuthenticated: Boolean(validSession),
      sessionExpiredMessage,
      login,
      logout,
      clearSessionExpiredMessage,
    };
  }, [session, sessionExpiredMessage, login, logout, clearSessionExpiredMessage]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider.");
  }
  return context;
}
