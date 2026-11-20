import { apiRequest } from '../api/apiClient';
import { bearerHeader } from '../api/authorization';
import type {
  ActivationRequest,
  LoginRequest,
  LoginResponse,
  PasswordChangeRequest,
} from './authTypes';

// A URL base configurada já termina em `/api`; os caminhos são relativos a ela.

/**
 * Autentica uma conta ativa com e-mail e senha.
 *
 * @param credentials Credenciais digitadas na tela de login.
 * @returns Token, validade e dados públicos da conta.
 */
export async function loginWithPassword(
  credentials: LoginRequest,
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('auth/login', {
    method: 'POST',
    body: {
      email: credentials.email.trim(),
      password: credentials.password,
    },
  });
}

/**
 * Inicia o primeiro acesso do participante com o código de ativação.
 * O código é apenas aparado nas extremidades; o conteúdo interno e as
 * maiúsculas/minúsculas são preservados.
 *
 * @param input E-mail cadastrado e código informado pelo candidato.
 * @returns Sessão restrita até a definição da senha inicial.
 */
export async function activateAccountWithCode(
  input: ActivationRequest,
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('auth/activation', {
    method: 'POST',
    body: {
      email: input.email.trim(),
      activationCode: input.activationCode.trim(),
    },
  });
}

/**
 * Define a senha inicial ou troca a senha da conta autenticada.
 * `currentPassword` só é enviada quando informada; a senha nunca é
 * transformada pelo cliente.
 *
 * @param input Senha atual (quando exigida) e nova senha.
 * @param accessToken Token da sessão que está definindo a senha.
 * @returns Nova sessão sem a restrição de primeiro acesso.
 */
export async function changeAccountPassword(
  input: PasswordChangeRequest,
  accessToken: string,
): Promise<LoginResponse> {
  const body: PasswordChangeRequest = { newPassword: input.newPassword };
  if (input.currentPassword !== undefined) {
    body.currentPassword = input.currentPassword;
  }

  return apiRequest<LoginResponse>('auth/password', {
    method: 'PUT',
    headers: bearerHeader(accessToken),
    body,
  });
}

/**
 * Confirma o encerramento da sessão na API. O JWT é stateless, portanto a
 * limpeza local continua sendo responsabilidade de quem chama esta função,
 * mesmo que a requisição falhe.
 *
 * @param accessToken Token da sessão que será encerrada.
 */
export async function logoutSession(accessToken: string): Promise<void> {
  await apiRequest<void>('auth/logout', {
    method: 'POST',
    headers: bearerHeader(accessToken),
  });
}
