import { ApiError } from '../api/apiClient';

/** Tela ou operação que originou o erro de autenticação. */
export type AuthErrorContext = 'login' | 'activation' | 'password' | 'session';

/** Falhas detectadas pelo próprio aplicativo antes ou depois da API. */
export type AuthFlowErrorCode =
  | 'ROLE_NOT_ALLOWED'
  | 'SESSION_EXPIRED'
  | 'INVALID_RESPONSE';

/**
 * Mensagens genéricas exibidas pelo aplicativo. Nenhuma delas revela a
 * existência de uma conta, detalhes internos ou o conteúdo do token.
 */
export const AUTH_MESSAGES = {
  invalidCredentials:
    'E-mail ou senha inválidos. Verifique os dados e tente novamente.',
  activationInvalid:
    'E-mail ou código de ativação inválidos. Confira os dados informados.',
  activationExpired:
    'O código de ativação expirou. Solicite um novo código ao coordenador.',
  passwordPolicy:
    'A nova senha deve ter de 8 a 72 caracteres, com pelo menos uma letra e um número.',
  currentPasswordInvalid:
    'A senha atual não foi confirmada. Confira e tente novamente.',
  passwordChangeRequired: 'Defina uma nova senha para continuar.',
  sessionExpired: 'Sua sessão expirou. Entre novamente.',
  forbidden: 'Acesso negado a este aplicativo.',
  serviceUnavailable:
    'O serviço está indisponível no momento. Tente novamente.',
  network:
    'Não foi possível conectar ao serviço. Verifique sua internet e tente novamente.',
  sessionRestoreFailed:
    'Não foi possível restaurar a sua sessão. Entre novamente.',
  persistenceFailed:
    'A sessão não pôde ser salva no dispositivo. Se fechar o aplicativo, será necessário entrar novamente.',
  unexpected: 'Não foi possível concluir a operação. Tente novamente.',
} as const;

function messageForFlowError(code: AuthFlowErrorCode): string {
  switch (code) {
    case 'ROLE_NOT_ALLOWED':
      return AUTH_MESSAGES.forbidden;
    case 'SESSION_EXPIRED':
      return AUTH_MESSAGES.sessionExpired;
    default:
      return AUTH_MESSAGES.unexpected;
  }
}

/** Erro de fluxo de autenticação com mensagem segura para a interface. */
export class AuthFlowError extends Error {
  constructor(readonly code: AuthFlowErrorCode) {
    super(messageForFlowError(code));
    this.name = 'AuthFlowError';
  }
}

/**
 * Traduz um erro de autenticação para uma mensagem segura e acionável.
 * A decisão usa o código estável e o status HTTP, nunca o texto da API.
 *
 * @param error Erro lançado pelo cliente HTTP ou por outra camada.
 * @param context Operação de origem, para distinguir login de sessão expirada.
 */
export function getAuthErrorMessage(
  error: unknown,
  context: AuthErrorContext,
): string {
  if (error instanceof AuthFlowError) {
    return error.message;
  }

  if (error instanceof ApiError) {
    switch (error.code) {
      case 'INVALID_CREDENTIALS':
        return AUTH_MESSAGES.invalidCredentials;
      case 'ACTIVATION_INVALID':
        return AUTH_MESSAGES.activationInvalid;
      case 'ACTIVATION_EXPIRED':
        return AUTH_MESSAGES.activationExpired;
      case 'PASSWORD_POLICY':
        return AUTH_MESSAGES.passwordPolicy;
      case 'CURRENT_PASSWORD_INVALID':
        return AUTH_MESSAGES.currentPasswordInvalid;
      case 'PASSWORD_CHANGE_REQUIRED':
        return AUTH_MESSAGES.passwordChangeRequired;
      case 'UNAUTHORIZED':
        return AUTH_MESSAGES.sessionExpired;
      case 'FORBIDDEN':
        return AUTH_MESSAGES.forbidden;
      default:
        break;
    }

    if (error.status === 401) {
      return context === 'login' || context === 'activation'
        ? AUTH_MESSAGES.invalidCredentials
        : AUTH_MESSAGES.sessionExpired;
    }
    if (error.status === 403) {
      return AUTH_MESSAGES.forbidden;
    }
    if (error.status >= 500) {
      return AUTH_MESSAGES.serviceUnavailable;
    }
    return AUTH_MESSAGES.unexpected;
  }

  if (error instanceof TypeError) {
    return AUTH_MESSAGES.network;
  }

  return AUTH_MESSAGES.unexpected;
}
