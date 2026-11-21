import { type BadgeVisual, colors } from '../../theme/colors';
import { parseRoutePositiveId } from '../protocol/protocolValidation';
import {
  SCHEDULED_VISIT_STATUSES,
  type ScheduledVisitStatus,
} from './visitTypes';

/** Situação da visita exibida na interface, incluindo valores desconhecidos. */
export type VisitDisplayStatus = ScheduledVisitStatus | 'UNKNOWN';

/** Rótulos visíveis das situações de visita conforme contrato do projeto. */
export const VISIT_STATUS_LABELS: Record<VisitDisplayStatus, string> = {
  SCHEDULED: 'Agendada',
  DONE: 'Realizada',
  ABSENT: 'Ausente',
  CANCELLED: 'Cancelada',
  UNKNOWN: 'Situação não reconhecida',
};

const VISIT_STATUS_VISUALS: Record<VisitDisplayStatus, BadgeVisual> = {
  SCHEDULED: {
    backgroundColor: colors.neutralSoft,
    borderColor: colors.neutralBorder,
    textColor: colors.neutral,
    symbol: '•',
  },
  DONE: {
    backgroundColor: colors.successSoft,
    textColor: colors.success,
    symbol: '✓',
  },
  ABSENT: {
    backgroundColor: colors.warningSoft,
    textColor: colors.warning,
    symbol: '!',
  },
  CANCELLED: {
    backgroundColor: colors.errorSoft,
    textColor: colors.error,
    symbol: '×',
  },
  UNKNOWN: {
    backgroundColor: colors.neutralSoft,
    textColor: colors.neutral,
    symbol: '•',
  },
};

function isKnownVisitStatus(value: unknown): value is ScheduledVisitStatus {
  return SCHEDULED_VISIT_STATUSES.includes(value as ScheduledVisitStatus);
}

/**
 * Normaliza a situação da visita devolvida pela API, convertendo valores não
 * reconhecidos em `UNKNOWN` sem inventar desfecho ou agendamento válido.
 */
export function normalizeVisitStatus(
  status: string | null | undefined,
): VisitDisplayStatus {
  return isKnownVisitStatus(status) ? status : 'UNKNOWN';
}

/** Rótulo traduzido da situação da visita normalizada. */
export function visitStatusLabel(status: string | null | undefined): string {
  return VISIT_STATUS_LABELS[normalizeVisitStatus(status)];
}

/** Aparência semântica da situação da visita (neutra, sucesso, atenção ou erro). */
export function getVisitStatusVisual(
  status: string | null | undefined,
): BadgeVisual {
  return VISIT_STATUS_VISUALS[normalizeVisitStatus(status)];
}

/**
 * Valida o identificador da visita recebido na rota antes de exibir detalhes.
 *
 * @param value Parâmetro recebido do Expo Router.
 * @returns Inteiro positivo seguro ou `null` quando inválido.
 */
export function parseVisitId(
  value: string | string[] | null | undefined,
): number | null {
  return parseRoutePositiveId(value);
}
