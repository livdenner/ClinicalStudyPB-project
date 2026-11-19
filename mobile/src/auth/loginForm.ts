/** Valores digitados na tela de login, preservados como o usuário escreveu. */
export interface LoginFormValues {
  email: string;
  password: string;
}

export interface LoginFormErrors {
  email?: string;
  password?: string;
}

export const LOGIN_MESSAGES = {
  emailRequired: 'Informe o e-mail institucional.',
  emailInvalid: 'Informe um e-mail válido.',
  passwordRequired: 'Informe a senha.',
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida apenas o necessário para enviar as credenciais. O e-mail é aparado
 * para a checagem de formato; a senha nunca é transformada.
 */
export function validateLoginForm(values: LoginFormValues): LoginFormErrors {
  const errors: LoginFormErrors = {};
  const email = values.email.trim();

  if (email.length === 0) {
    errors.email = LOGIN_MESSAGES.emailRequired;
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = LOGIN_MESSAGES.emailInvalid;
  }

  if (values.password.length === 0) {
    errors.password = LOGIN_MESSAGES.passwordRequired;
  }

  return errors;
}

/** Indica se a validação encontrou algum campo inválido. */
export function hasLoginFormErrors(errors: LoginFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
