import { ApiError } from '../services/api/apiClient';
import { InvalidVisitsResponseError } from '../services/visits/visitApi';
import {
  getVisitLoadErrorMessage,
  VISIT_MESSAGES,
} from '../services/visits/visitErrors';
import {
  getVisitStatusVisual,
  normalizeVisitStatus,
  parseVisitId,
  visitStatusLabel,
} from '../services/visits/visitPresentation';
import { colors } from '../theme/colors';

describe('visitPresentation', () => {
  it('mapeia estados conhecidos e desconhecidos com rótulos e cores semânticas', () => {
    expect(visitStatusLabel('SCHEDULED')).toBe('Agendada');
    expect(getVisitStatusVisual('SCHEDULED')).toMatchObject({
      backgroundColor: colors.neutralSoft,
      borderColor: colors.neutralBorder,
      textColor: colors.neutral,
    });

    expect(visitStatusLabel('DONE')).toBe('Realizada');
    expect(getVisitStatusVisual('DONE')).toMatchObject({
      backgroundColor: colors.successSoft,
      textColor: colors.success,
    });

    expect(visitStatusLabel('ABSENT')).toBe('Ausente');
    expect(getVisitStatusVisual('ABSENT')).toMatchObject({
      backgroundColor: colors.warningSoft,
      textColor: colors.warning,
    });

    expect(visitStatusLabel('CANCELLED')).toBe('Cancelada');
    expect(getVisitStatusVisual('CANCELLED')).toMatchObject({
      backgroundColor: colors.errorSoft,
      textColor: colors.error,
    });

    expect(normalizeVisitStatus('UNKNOWN_VALUE')).toBe('UNKNOWN');
    expect(normalizeVisitStatus(null)).toBe('UNKNOWN');
    expect(normalizeVisitStatus(undefined)).toBe('UNKNOWN');
    expect(visitStatusLabel('UNKNOWN_VALUE')).toBe('Situação não reconhecida');
    expect(getVisitStatusVisual('UNKNOWN_VALUE')).toMatchObject({
      backgroundColor: colors.neutralSoft,
      textColor: colors.neutral,
    });
  });

  it('valida o identificador de visita vindo da rota sem aceitar texto arbitrário', () => {
    expect(parseVisitId('15')).toBe(15);
    expect(parseVisitId(['15', '99'])).toBe(15);
    expect(parseVisitId('0')).toBeNull();
    expect(parseVisitId('-5')).toBeNull();
    expect(parseVisitId('15abc')).toBeNull();
    expect(parseVisitId('9007199254740992')).toBeNull();
    expect(parseVisitId(undefined)).toBeNull();
    expect(parseVisitId(null)).toBeNull();
  });

  it('traduz erros ao carregar visitas sem vazar detalhes internos', () => {
    expect(
      getVisitLoadErrorMessage(new InvalidVisitsResponseError(), 'list'),
    ).toBe(VISIT_MESSAGES.invalidResponse);

    const forbidden = getVisitLoadErrorMessage(
      new ApiError('stack trace secreto', 403, 'FORBIDDEN'),
      'list',
    );
    expect(forbidden).toBe(VISIT_MESSAGES.forbidden);
    expect(forbidden).not.toContain('secreto');

    expect(getVisitLoadErrorMessage(new ApiError('down', 503), 'list')).toBe(
      VISIT_MESSAGES.serviceUnavailable,
    );
    expect(getVisitLoadErrorMessage(new ApiError('bad', 400), 'list')).toBe(
      VISIT_MESSAGES.listFailed,
    );
    expect(getVisitLoadErrorMessage(new Error('network'), 'list')).toBe(
      VISIT_MESSAGES.listFailed,
    );

    expect(getVisitLoadErrorMessage(new ApiError('not found', 404), 'detail')).toBe(
      VISIT_MESSAGES.detailFailed,
    );
    expect(getVisitLoadErrorMessage(new Error('timeout'), 'detail')).toBe(
      VISIT_MESSAGES.detailFailed,
    );
  });
});
