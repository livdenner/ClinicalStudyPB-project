import {
  hasPasswordFormErrors,
  PASSWORD_MESSAGES,
  toPasswordChangeRequest,
  validatePasswordForm,
  type PasswordFormValues,
} from '../auth/passwordPolicy';

function values(overrides: Partial<PasswordFormValues> = {}): PasswordFormValues {
  return {
    currentPassword: 'SenhaAtual1',
    newPassword: 'NovaSenha1',
    confirmPassword: 'NovaSenha1',
    ...overrides,
  };
}

describe('política de senha do aplicativo', () => {
  it('exige a senha atual apenas no modo de troca', () => {
    expect(
      validatePasswordForm('initial', values({ currentPassword: '' })),
    ).toEqual({});

    expect(
      validatePasswordForm('change', values({ currentPassword: '' })),
    ).toEqual({ currentPassword: PASSWORD_MESSAGES.currentRequired });
  });

  it('exige nova senha e confirmação preenchidas', () => {
    const errors = validatePasswordForm(
      'initial',
      values({ newPassword: '', confirmPassword: '' }),
    );

    expect(errors).toEqual({
      newPassword: PASSWORD_MESSAGES.newRequired,
      confirmPassword: PASSWORD_MESSAGES.confirmRequired,
    });
  });

  it('aplica a regra de letra, número e tamanho', () => {
    const invalidPasswords = [
      'abcdefgh',
      '12345678',
      'abc1234',
      `a1${'x'.repeat(71)}`,
    ];

    for (const newPassword of invalidPasswords) {
      const errors = validatePasswordForm(
        'initial',
        values({ newPassword, confirmPassword: newPassword }),
      );
      expect(errors.newPassword).toBe(PASSWORD_MESSAGES.policy);
    }
  });

  it('aceita uma senha que atende à regra', () => {
    expect(validatePasswordForm('initial', values())).toEqual({});
  });

  it('recusa a confirmação diferente da nova senha', () => {
    const errors = validatePasswordForm(
      'initial',
      values({ confirmPassword: 'OutraSenha1' }),
    );

    expect(errors.confirmPassword).toBe(PASSWORD_MESSAGES.confirmMismatch);
  });

  it('não apara nem altera a senha digitada', () => {
    const typed = '  Senha 123  ';
    const form = values({ newPassword: typed, confirmPassword: typed });
    const request = toPasswordChangeRequest('initial', form);

    expect(validatePasswordForm('initial', form)).toEqual({});
    expect(request.newPassword).toBe(typed);
    expect(request.currentPassword).toBeUndefined();
  });

  it('envia a senha atual somente no modo de troca', () => {
    expect(toPasswordChangeRequest('change', values())).toEqual({
      currentPassword: 'SenhaAtual1',
      newPassword: 'NovaSenha1',
    });
    expect(toPasswordChangeRequest('initial', values())).toEqual({
      newPassword: 'NovaSenha1',
    });
  });

  it('informa quando o formulário tem erros', () => {
    expect(hasPasswordFormErrors({})).toBe(false);
    expect(
      hasPasswordFormErrors({ newPassword: PASSWORD_MESSAGES.newRequired }),
    ).toBe(true);
  });
});
