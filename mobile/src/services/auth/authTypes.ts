/** Perfis de acesso definidos pelo contrato da API. */
export const USER_ROLES = [
  'RESEARCHER',
  'COORDINATOR',
  'ADMINISTRATOR',
  'PARTICIPANT',
] as const;

/** Perfil de acesso de uma conta. */
export type UserRole = (typeof USER_ROLES)[number];

/** Dados públicos do usuário devolvidos pelas rotas de autenticação. */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
}

/**
 * Formato recebido da API antes da normalização da sessão. O contrato
 * documenta `mustChangePassword` como opcional, com padrão `false`.
 */
export interface AuthUserPayload
  extends Omit<AuthUser, 'mustChangePassword'> {
  mustChangePassword?: boolean;
}

/** Corpo aceito por `POST /auth/login`. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Corpo aceito por `POST /auth/activation`. */
export interface ActivationRequest {
  email: string;
  activationCode: string;
}

/** Corpo aceito por `PUT /auth/password`. */
export interface PasswordChangeRequest {
  currentPassword?: string;
  newPassword: string;
}

/** Resposta comum ao login, à ativação e à definição/troca de senha. */
export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUserPayload;
}
