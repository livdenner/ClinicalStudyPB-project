import {
  hasLoginFormErrors,
  LOGIN_MESSAGES,
  validateLoginForm,
} from '../auth/loginForm';

describe('validação do formulário de login', () => {
  it('exige e-mail e senha', () => {
    expect(validateLoginForm({ email: '', password: '' })).toEqual({
      email: LOGIN_MESSAGES.emailRequired,
      password: LOGIN_MESSAGES.passwordRequired,
    });
  });

  it('recusa um e-mail sem formato válido', () => {
    expect(
      validateLoginForm({ email: 'participante', password: 'Senha12345' }),
    ).toEqual({ email: LOGIN_MESSAGES.emailInvalid });
  });

  it('aceita e-mail com espaços nas extremidades sem alterar a senha', () => {
    const password = '  Senha 123  ';

    expect(
      validateLoginForm({ email: '  raffael@exemplo.test  ', password }),
    ).toEqual({});
  });

  it('informa quando o formulário tem erros', () => {
    expect(hasLoginFormErrors({})).toBe(false);
    expect(
      hasLoginFormErrors({ email: LOGIN_MESSAGES.emailRequired }),
    ).toBe(true);
  });
});
