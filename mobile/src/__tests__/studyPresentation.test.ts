import { ApiError } from '../services/api/apiClient';
import {
  formatCivilDate,
  formatDateTime,
} from '../services/format/dateFormat';
import { InvalidStudiesResponseError } from '../services/studies/studyApi';
import {
  getStudyLoadErrorMessage,
  STUDY_MESSAGES,
} from '../services/studies/studyErrors';
import {
  getParticipationStatusVisual,
  getStudyStatusVisual,
  normalizeParticipationStatus,
  normalizeStudyStatus,
  participationStatusLabel,
  studyStatusLabel,
} from '../services/studies/studyPresentation';
import { colors } from '../theme/colors';

describe('studyPresentation', () => {
  it('mapeia estados conhecidos e desconhecidos conforme a tabela do PBI-24', () => {
    expect(studyStatusLabel('PLANNING')).toBe('Planejamento');
    expect(getStudyStatusVisual('PLANNING')).toMatchObject({
      backgroundColor: colors.surface,
      borderColor: colors.neutralBorder,
      textColor: colors.neutral,
    });

    expect(studyStatusLabel('RECRUITMENT')).toBe('Recrutamento');
    expect(getStudyStatusVisual('RECRUITMENT')).toMatchObject({
      backgroundColor: colors.studyRecruitmentSoft,
      textColor: colors.studyRecruitment,
    });

    expect(studyStatusLabel('EXECUTION')).toBe('Em execução');
    expect(getStudyStatusVisual('EXECUTION')).toMatchObject({
      backgroundColor: colors.infoSoft,
      textColor: colors.info,
    });

    expect(studyStatusLabel('CLOSED')).toBe('Encerrado');
    expect(getStudyStatusVisual('CLOSED')).toMatchObject({
      backgroundColor: colors.studyClosedSoft,
      textColor: colors.studyClosed,
    });

    expect(studyStatusLabel('CANCELLED')).toBe('Cancelado');
    expect(getStudyStatusVisual('CANCELLED')).toMatchObject({
      backgroundColor: colors.errorSoft,
      textColor: colors.error,
    });

    for (const unknown of ['ARCHIVED', '', null, undefined]) {
      expect(normalizeStudyStatus(unknown)).toBe('UNKNOWN');
      expect(studyStatusLabel(unknown)).toBe('Situação não reconhecida');
      expect(getStudyStatusVisual(unknown)).toMatchObject({
        backgroundColor: colors.neutralSoft,
        textColor: colors.neutral,
      });
    }
  });

  it('mantém a situação da participação separada do estado do estudo', () => {
    expect(participationStatusLabel('ACTIVE')).toBe('Participação ativa');
    expect(getParticipationStatusVisual('ACTIVE')).toMatchObject({
      backgroundColor: colors.infoSoft,
      textColor: colors.info,
    });

    expect(participationStatusLabel('WITHDRAWN')).toBe(
      'Participação retirada',
    );
    expect(getParticipationStatusVisual('WITHDRAWN')).toMatchObject({
      backgroundColor: colors.neutralSoft,
      textColor: colors.neutral,
    });

    expect(normalizeParticipationStatus('EXECUTION')).toBe('UNKNOWN');
    expect(participationStatusLabel(undefined)).toBe(
      'Participação não reconhecida',
    );
    expect(getParticipationStatusVisual(null)).toMatchObject({
      backgroundColor: colors.neutralSoft,
      textColor: colors.neutral,
    });

    for (const status of [
      'PLANNING',
      'RECRUITMENT',
      'EXECUTION',
      'CLOSED',
      'CANCELLED',
      'UNKNOWN',
    ]) {
      const visual = getStudyStatusVisual(status);
      expect(visual.backgroundColor).not.toBe(colors.successSoft);
      expect(visual.textColor).not.toBe(colors.success);
    }
  });

  it('traduz falhas de consulta sem expor mensagens internas da API', () => {
    const forbidden = new ApiError('detalhe interno', 403, 'FORBIDDEN');
    const serverError = new ApiError('NullPointerException', 500);
    const badRequest = new ApiError('stack trace', 400);

    expect(getStudyLoadErrorMessage(new InvalidStudiesResponseError())).toBe(
      STUDY_MESSAGES.invalidResponse,
    );
    expect(getStudyLoadErrorMessage(forbidden)).toBe(STUDY_MESSAGES.forbidden);
    expect(getStudyLoadErrorMessage(serverError)).toBe(
      STUDY_MESSAGES.serviceUnavailable,
    );
    expect(getStudyLoadErrorMessage(badRequest)).toBe(
      STUDY_MESSAGES.listFailed,
    );
    expect(
      getStudyLoadErrorMessage(new TypeError('Network request failed')),
    ).toBe(STUDY_MESSAGES.listFailed);
    expect(getStudyLoadErrorMessage(new Error('erro interno'))).toBe(
      STUDY_MESSAGES.listFailed,
    );

    expect(getStudyLoadErrorMessage(forbidden)).not.toContain('detalhe interno');
    expect(getStudyLoadErrorMessage(serverError)).not.toContain(
      'NullPointerException',
    );
  });

  it('formata data civil sem deslocamento por fuso e instante no fuso local', () => {
    expect(formatCivilDate('2027-02-01')).toBe('01/02/2027');
    expect(formatCivilDate('2026-13-01')).toBeNull();
    expect(formatCivilDate(undefined)).toBeNull();

    const local = new Date(2026, 10, 10, 14, 5, 0);
    expect(formatDateTime(local.toISOString())).toBe('10/11/2026 14:05');
    expect(formatDateTime('invalido')).toBeNull();
  });
});
