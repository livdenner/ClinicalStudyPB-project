import {
  USER_ROLES,
  type AuthUser,
  type LoginResponse,
  type UserRole,
} from '../services/auth/authTypes';

/** Sessão mantida pelo aplicativo, com vencimento absoluto em milissegundos. */
export interface AuthSession {
  accessToken: string;
  expiresAt: number;
  user: AuthUser;
}

/** Indica que a API respondeu em um formato que não pode ser usado como sessão. */
export class InvalidAuthResponseError extends Error {
  constructor() {
    super('A resposta de autenticação recebida não pôde ser utilizada.');
    this.name = 'InvalidAuthResponseError';
  }
}

/** Verifica se o valor é um objeto simples, sem arrays ou `null`. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Confere se o valor é um perfil de acesso conhecido pelo aplicativo. */
export function isUserRole(value: unknown): value is UserRole {
  return USER_ROLES.some((role) => role === value);
}

/**
 * Valida e normaliza os dados públicos do usuário. Campos obrigatórios
 * inválidos fazem a leitura falhar em vez de produzir uma sessão incompleta.
 */
export function parseAuthUser(value: unknown): AuthUser | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const { id, name, email, role, active, mustChangePassword } = value;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    return null;
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    return null;
  }
  if (typeof email !== 'string' || email.trim().length === 0) {
    return null;
  }
  if (!isUserRole(role)) {
    return null;
  }
  if (typeof active !== 'boolean') {
    return null;
  }
  if (mustChangePassword !== undefined && typeof mustChangePassword !== 'boolean') {
    return null;
  }

  return {
    id,
    name,
    email,
    role,
    active,
    mustChangePassword: mustChangePassword === true,
  };
}

/**
 * Converte a resposta de autenticação em sessão com vencimento absoluto.
 * O prazo é calculado uma única vez, no recebimento, a partir de `expiresIn`.
 *
 * @param response Resposta de login, ativação ou troca de senha.
 * @param now Instante do recebimento em milissegundos, injetável em testes.
 * @throws {InvalidAuthResponseError} Se o corpo não corresponder ao contrato.
 */
export function createSessionFromLoginResponse(
  response: LoginResponse,
  now: number = Date.now(),
): AuthSession {
  const payload: unknown = response;
  if (!isPlainObject(payload)) {
    throw new InvalidAuthResponseError();
  }

  const { accessToken, tokenType, expiresIn, user } = payload;
  const parsedUser = parseAuthUser(user);
  if (
    typeof accessToken !== 'string' ||
    accessToken.trim().length === 0 ||
    tokenType !== 'Bearer' ||
    typeof expiresIn !== 'number' ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0 ||
    parsedUser === null
  ) {
    throw new InvalidAuthResponseError();
  }

  const expiresAt = now + Math.round(expiresIn * 1000);
  if (!Number.isFinite(expiresAt)) {
    throw new InvalidAuthResponseError();
  }

  return {
    accessToken,
    expiresAt,
    user: parsedUser,
  };
}

/**
 * Informa se a sessão já venceu. Datas inválidas são tratadas como vencidas
 * para nunca liberar uma área privada com base em dados inconsistentes.
 */
export function isSessionExpired(
  session: Pick<AuthSession, 'expiresAt'>,
  now: number = Date.now(),
): boolean {
  return !Number.isFinite(session.expiresAt) || now >= session.expiresAt;
}
