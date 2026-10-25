import type {
  AuthSession,
  LoginRequest,
  LoginResponse,
} from "../types/auth";
import { ApiClientError, apiRequest } from "./api/apiClient";

export const AUTH_STORAGE_KEY = "clinicalstudypb.auth.session";

export class AuthApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.code = code;
  }
}

export function isSessionExpired(
  session: AuthSession,
  now: number = Date.now(),
): boolean {
  return !Number.isFinite(session.expiresAt) || session.expiresAt <= now;
}

export function loadStoredSession(now: number = Date.now()): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      !parsed ||
      typeof parsed.accessToken !== "string" ||
      !parsed.accessToken ||
      typeof parsed.expiresAt !== "number" ||
      !parsed.user ||
      typeof parsed.user.email !== "string" ||
      typeof parsed.user.name !== "string" ||
      typeof parsed.user.role !== "string"
    ) {
      clearStoredSession();
      return null;
    }

    const session = parsed as AuthSession;
    if (isSessionExpired(session, now)) {
      clearStoredSession();
      return null;
    }

    return session;
  } catch {
    clearStoredSession();
    return null;
  }
}

export function saveStoredSession(
  response: LoginResponse,
  now: number = Date.now(),
): AuthSession {
  const expiresInMs = Math.max(0, Number(response.expiresIn) || 0) * 1000;
  const session: AuthSession = {
    accessToken: response.accessToken,
    tokenType: response.tokenType || "Bearer",
    expiresAt: now + expiresInMs,
    user: response.user,
  };

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearStoredSession(): void {
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignora falha de acesso ao storage em ambientes restritos.
  }
}

export function getAuthorizationHeader(
  session: AuthSession | null = loadStoredSession(),
): Record<string, string> {
  if (!session || isSessionExpired(session)) {
    return {};
  }

  return {
    Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
  };
}

export async function loginRequest(
  credentials: LoginRequest,
): Promise<LoginResponse> {
  let data: LoginResponse;

  try {
    data = await apiRequest<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: {
        email: credentials.email.trim(),
        password: credentials.password,
      },
    });
  } catch (error) {
    if (!(error instanceof ApiClientError)) {
      throw error;
    }
    if (error.status === null) {
      throw new AuthApiError(
        "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
        0,
        "NETWORK_ERROR",
      );
    }
    if (error.status === 401) {
      throw new AuthApiError(
        error.message,
        401,
        error.code || "INVALID_CREDENTIALS",
      );
    }

    if (error.status === 400) {
      const fieldMsg = error.fieldErrors[0]?.message;
      throw new AuthApiError(
        fieldMsg || error.message,
        400,
        error.code || "INVALID_REQUEST",
      );
    }

    throw new AuthApiError(
      error.message,
      error.status,
      error.code,
    );
  }

  if (!data.user?.active) {
    throw new AuthApiError(
      "Esta conta está inativa. Entre em contato com o administrador.",
      401,
      "INACTIVE_USER",
    );
  }

  return data;
}

export async function logoutRequest(accessToken?: string): Promise<void> {
  if (!accessToken) {
    return;
  }

  try {
    await apiRequest<void>("/api/v1/auth/logout", {
      method: "POST",
      token: accessToken,
    });
  } catch {
    // O JWT é stateless: mesmo sem resposta de rede, o cliente descarta a sessão local.
  }
}
