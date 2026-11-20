import {
  formatCivilDate,
  formatDateTime,
  invitationStatusLabel,
  isPendingInvitation,
  normalizeInvitationStatus,
  parseCandidateId,
} from '../services/invitations/invitationPresentation';

describe('invitationPresentation', () => {
  it('mantém pendência apenas para o valor exato do contrato', () => {
    expect(isPendingInvitation('CONSENT_PENDING')).toBe(true);
    expect(isPendingInvitation('GRANTED')).toBe(false);
    expect(isPendingInvitation('DECLINED')).toBe(false);
    expect(isPendingInvitation('INVITED')).toBe(false);
    expect(isPendingInvitation(undefined)).toBe(false);
  });

  it('trata situação desconhecida sem assumir pendência', () => {
    expect(normalizeInvitationStatus('ACTIVE')).toBe('UNKNOWN');
    expect(normalizeInvitationStatus('')).toBe('UNKNOWN');
    expect(normalizeInvitationStatus(null)).toBe('UNKNOWN');
    expect(invitationStatusLabel('INCLUDED')).toBe(
      'Situação não reconhecida',
    );
  });

  it('traduz as três situações visíveis', () => {
    expect(invitationStatusLabel('CONSENT_PENDING')).toBe(
      'Aguardando sua decisão',
    );
    expect(invitationStatusLabel('GRANTED')).toBe('Consentimento aceito');
    expect(invitationStatusLabel('DECLINED')).toBe(
      'Consentimento recusado',
    );
  });

  it('valida o identificador da rota antes de consultar', () => {
    expect(parseCandidateId('31')).toBe(31);
    expect(parseCandidateId(['31', '32'])).toBe(31);
    expect(parseCandidateId(' 31')).toBeNull();
    expect(parseCandidateId('31.0')).toBeNull();
    expect(parseCandidateId('abc')).toBeNull();
    expect(parseCandidateId('0')).toBeNull();
    expect(parseCandidateId('-1')).toBeNull();
    expect(parseCandidateId(undefined)).toBeNull();
    expect(parseCandidateId('')).toBeNull();
  });

  it('formata data civil sem deslocar o dia pelo fuso', () => {
    expect(formatCivilDate('2026-11-17')).toBe('17/11/2026');
    expect(formatCivilDate('2026-01-01')).toBe('01/01/2026');
    expect(formatCivilDate('2026-13-01')).toBeNull();
    expect(formatCivilDate('17/11/2026')).toBeNull();
    expect(formatCivilDate(undefined)).toBeNull();
  });

  it('formata o instante da decisão no fuso local', () => {
    const local = new Date(2026, 10, 17, 9, 5, 0);

    expect(formatDateTime(local.toISOString())).toBe('17/11/2026 09:05');
    expect(formatDateTime('data-invalida')).toBeNull();
    expect(formatDateTime(undefined)).toBeNull();
  });
});
