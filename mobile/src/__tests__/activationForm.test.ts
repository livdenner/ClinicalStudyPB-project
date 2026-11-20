import {
  ACTIVATION_MESSAGES,
  hasActivationFormErrors,
  validateActivationForm,
} from '../auth/activationForm';

describe('validação do formulário de primeiro acesso', () => {
  it('exige o e-mail e o código de ativação', () => {
    expect(
      validateActivationForm({ email: '', activationCode: '' }),
    ).toEqual({
      email: ACTIVATION_MESSAGES.emailRequired,
      activationCode: ACTIVATION_MESSAGES.codeRequired,
    });
  });

  it('recusa um e-mail sem formato válido', () => {
    expect(
      validateActivationForm({
        email: 'candidato',
        activationCode: 'K7Q2-9MXA',
      }),
    ).toEqual({ email: ACTIVATION_MESSAGES.emailInvalid });
  });

  it('recusa um código formado apenas por espaços', () => {
    expect(
      validateActivationForm({
        email: 'candidato@exemplo.test',
        activationCode: '   ',
      }),
    ).toEqual({ activationCode: ACTIVATION_MESSAGES.codeRequired });
  });

  it('aceita e-mail com espaços nas extremidades e preserva o código', () => {
    expect(
      validateActivationForm({
        email: '  candidato@exemplo.test  ',
        activationCode: 'K7Q2-9MXA',
      }),
    ).toEqual({});
  });

  it('informa quando o formulário tem erros', () => {
    expect(hasActivationFormErrors({})).toBe(false);
    expect(
      hasActivationFormErrors({
        activationCode: ACTIVATION_MESSAGES.codeRequired,
      }),
    ).toBe(true);
  });
});
