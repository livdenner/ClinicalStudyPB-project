/** Valores digitados na tela de primeiro acesso, preservados como digitados. */
export interface ActivationFormValues {
  email: string;
  activationCode: string;
}

export interface ActivationFormErrors {
  email?: string;
  activationCode?: string;
}

export const ACTIVATION_MESSAGES = {
  emailRequired: 'Informe o e-mail cadastrado pelo coordenador.',
  emailInvalid: 'Informe um e-mail válido.',
  codeRequired: 'Informe o código de ativação.',
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida apenas o necessário para enviar a ativação. O e-mail é aparado para
 * a checagem de formato; o código só precisa ter conteúdo, pois o contrato
 * diferencia maiúsculas de minúsculas e o envio preserva o valor digitado.
 */
export function validateActivationForm(
  values: ActivationFormValues,
): ActivationFormErrors {
  const errors: ActivationFormErrors = {};
  const email = values.email.trim();

  if (email.length === 0) {
    errors.email = ACTIVATION_MESSAGES.emailRequired;
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = ACTIVATION_MESSAGES.emailInvalid;
  }

  if (values.activationCode.trim().length === 0) {
    errors.activationCode = ACTIVATION_MESSAGES.codeRequired;
  }

  return errors;
}

/** Indica se a validação encontrou algum campo inválido. */
export function hasActivationFormErrors(
  errors: ActivationFormErrors,
): boolean {
  return Object.keys(errors).length > 0;
}
