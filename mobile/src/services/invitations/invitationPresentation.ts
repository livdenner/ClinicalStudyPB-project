import {
  VISIBLE_INVITATION_STATUSES,
  type VisibleInvitationStatus,
} from './invitationTypes';

export { formatCivilDate, formatDateTime } from '../format/dateFormat';

/** Situação exibida na interface, incluindo valores não reconhecidos. */
export type InvitationDisplayStatus = VisibleInvitationStatus | 'UNKNOWN';

/** Rótulos visíveis; o texto acompanha a cor para não depender só dela. */
export const INVITATION_STATUS_LABELS: Record<
  InvitationDisplayStatus,
  string
> = {
  CONSENT_PENDING: 'Aguardando sua decisão',
  GRANTED: 'Consentimento aceito',
  DECLINED: 'Consentimento recusado',
  UNKNOWN: 'Situação não reconhecida',
};

function isVisibleStatus(value: unknown): value is VisibleInvitationStatus {
  return VISIBLE_INVITATION_STATUSES.includes(
    value as VisibleInvitationStatus,
  );
}

/**
 * Normaliza a situação recebida da API. Um valor desconhecido nunca é
 * convertido em pendência, para não liberar uma decisão indevida.
 *
 * @param status Valor bruto devolvido pelo servidor.
 * @returns Situação segura para a interface.
 */
export function normalizeInvitationStatus(
  status: string | null | undefined,
): InvitationDisplayStatus {
  return isVisibleStatus(status) ? status : 'UNKNOWN';
}

/** Indica se o convite ainda aceita uma decisão do participante. */
export function isPendingInvitation(
  status: string | null | undefined,
): boolean {
  return normalizeInvitationStatus(status) === 'CONSENT_PENDING';
}

/** Rótulo traduzido da situação normalizada. */
export function invitationStatusLabel(
  status: string | null | undefined,
): string {
  return INVITATION_STATUS_LABELS[normalizeInvitationStatus(status)];
}

/**
 * Valida o parâmetro de rota antes de qualquer consulta à API.
 *
 * @param value Parâmetro recebido do Expo Router.
 * @returns Identificador positivo ou `null` quando inválido.
 */
export function parseCandidateId(
  value: string | string[] | null | undefined,
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null || !/^[0-9]+$/.test(raw)) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
