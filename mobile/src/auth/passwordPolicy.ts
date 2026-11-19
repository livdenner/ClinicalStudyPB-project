import type { PasswordChangeRequest } from '../services/auth/authTypes';

/** Mesma regra aplicada pelo backend: letra, número e 8 a 72 caracteres. */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*[0-9]).{8,72}$/;

/** Modo do formulário: primeiro acesso ou troca de uma conta já ativa. */
export type PasswordMode = 'initial' | 'change';

/** Valores digitados, mantidos exatamente como a pessoa escreveu. */
export interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordFormErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export const PASSWORD_MESSAGES = {
  currentRequired: 'Informe a senha atual.',
  newRequired: 'Informe a nova senha.',
  policy:
    'Use de 8 a 72 caracteres, com pelo menos uma letra e um número.',
  confirmRequired: 'Confirme a nova senha.',
  confirmMismatch: 'A confirmação deve ser igual à nova senha.',
} as const;

/**
 * Valida o formulário antes do envio. A senha não é aparada nem convertida;
 * a confirmação existe só na interface e não é enviada à API.
 */
export function validatePasswordForm(
  mode: PasswordMode,
  values: PasswordFormValues,
): PasswordFormErrors {
  const errors: PasswordFormErrors = {};

  if (mode === 'change' && values.currentPassword.length === 0) {
    errors.currentPassword = PASSWORD_MESSAGES.currentRequired;
  }

  if (values.newPassword.length === 0) {
    errors.newPassword = PASSWORD_MESSAGES.newRequired;
  } else if (!PASSWORD_PATTERN.test(values.newPassword)) {
    errors.newPassword = PASSWORD_MESSAGES.policy;
  }

  if (values.confirmPassword.length === 0) {
    errors.confirmPassword = PASSWORD_MESSAGES.confirmRequired;
  } else if (values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = PASSWORD_MESSAGES.confirmMismatch;
  }

  return errors;
}

/** Indica se a validação encontrou algum campo inválido. */
export function hasPasswordFormErrors(errors: PasswordFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Monta o corpo HTTP com `currentPassword` apenas no modo de troca. */
export function toPasswordChangeRequest(
  mode: PasswordMode,
  values: PasswordFormValues,
): PasswordChangeRequest {
  return mode === 'change'
    ? {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }
    : { newPassword: values.newPassword };
}
