import { colors } from '../../theme/colors';
import { formatCivilDate } from '../format/dateFormat';
import {
  PARTICIPATION_STATUSES,
  STUDY_STATUSES,
  type ParticipationStatus,
  type StudyStatus,
} from './studyTypes';

/** Estado do estudo exibido na interface, incluindo valores desconhecidos. */
export type StudyDisplayStatus = StudyStatus | 'UNKNOWN';

/** Situação da participação exibida na interface, incluindo desconhecidos. */
export type ParticipationDisplayStatus = ParticipationStatus | 'UNKNOWN';

/** Aparência semântica de um selo com texto, fundo, borda opcional e símbolo. */
export interface BadgeVisual {
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  symbol: string;
}

/** Rótulos visíveis para estados de estudo conforme a tabela do PBI-24. */
export const STUDY_STATUS_LABELS: Record<StudyDisplayStatus, string> = {
  PLANNING: 'Planejamento',
  RECRUITMENT: 'Recrutamento',
  EXECUTION: 'Em execução',
  CLOSED: 'Encerrado',
  CANCELLED: 'Cancelado',
  UNKNOWN: 'Situação não reconhecida',
};

/** Rótulos visíveis da participação, mantidos distintos do estado do estudo. */
export const PARTICIPATION_STATUS_LABELS: Record<
  ParticipationDisplayStatus,
  string
> = {
  ACTIVE: 'Participação ativa',
  WITHDRAWN: 'Participação retirada',
  UNKNOWN: 'Participação não reconhecida',
};

const STUDY_STATUS_VISUALS: Record<StudyDisplayStatus, BadgeVisual> = {
  PLANNING: {
    backgroundColor: colors.surface,
    borderColor: colors.neutralBorder,
    textColor: colors.neutral,
    symbol: '✎',
  },
  RECRUITMENT: {
    backgroundColor: colors.studyRecruitmentSoft,
    textColor: colors.studyRecruitment,
    symbol: '+',
  },
  EXECUTION: {
    backgroundColor: colors.infoSoft,
    textColor: colors.info,
    symbol: '▶',
  },
  CLOSED: {
    backgroundColor: colors.studyClosedSoft,
    textColor: colors.studyClosed,
    symbol: '■',
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

const PARTICIPATION_STATUS_VISUALS: Record<
  ParticipationDisplayStatus,
  BadgeVisual
> = {
  ACTIVE: {
    backgroundColor: colors.infoSoft,
    textColor: colors.info,
    symbol: '•',
  },
  WITHDRAWN: {
    backgroundColor: colors.neutralSoft,
    textColor: colors.neutral,
    symbol: '•',
  },
  UNKNOWN: {
    backgroundColor: colors.neutralSoft,
    textColor: colors.neutral,
    symbol: '•',
  },
};

function isKnownStudyStatus(value: unknown): value is StudyStatus {
  return STUDY_STATUSES.includes(value as StudyStatus);
}

function isKnownParticipationStatus(
  value: unknown,
): value is ParticipationStatus {
  return PARTICIPATION_STATUSES.includes(value as ParticipationStatus);
}

/**
 * Normaliza o estado do estudo devolvido pela API, convertendo valores não
 * reconhecidos em `UNKNOWN` sem inventar estado válido.
 */
export function normalizeStudyStatus(
  status: string | null | undefined,
): StudyDisplayStatus {
  return isKnownStudyStatus(status) ? status : 'UNKNOWN';
}

/** Rótulo traduzido do estado do estudo normalizado. */
export function studyStatusLabel(status: string | null | undefined): string {
  return STUDY_STATUS_LABELS[normalizeStudyStatus(status)];
}

/** Aparência semântica do estado do estudo conforme a tabela do PBI-24. */
export function getStudyStatusVisual(
  status: string | null | undefined,
): BadgeVisual {
  return STUDY_STATUS_VISUALS[normalizeStudyStatus(status)];
}

/**
 * Normaliza a situação da participação devolvida pela API, mantendo-a separada
 * do estado do estudo.
 */
export function normalizeParticipationStatus(
  status: string | null | undefined,
): ParticipationDisplayStatus {
  return isKnownParticipationStatus(status) ? status : 'UNKNOWN';
}

/** Rótulo traduzido da situação da participação normalizada. */
export function participationStatusLabel(
  status: string | null | undefined,
): string {
  return PARTICIPATION_STATUS_LABELS[normalizeParticipationStatus(status)];
}

/** Aparência semântica da situação da participação (informativa/neutra). */
export function getParticipationStatusVisual(
  status: string | null | undefined,
): BadgeVisual {
  return PARTICIPATION_STATUS_VISUALS[normalizeParticipationStatus(status)];
}

/**
 * Valida o identificador de participação recebido na rota antes de consultar
 * ou exibir dados do participante.
 *
 * @param value Parâmetro recebido do Expo Router.
 * @returns Inteiro positivo seguro ou `null` quando inválido.
 */
export function parseParticipantId(
  value: string | string[] | null | undefined,
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null || !/^[0-9]+$/.test(raw)) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Formata o período civil do estudo (`DD/MM/AAAA a DD/MM/AAAA`) sem deslocar
 * os dias por fuso horário.
 */
export function formatStudyPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string | null {
  const start = formatCivilDate(startDate);
  const end = formatCivilDate(endDate);
  const parts = [start, end].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(' a ') : null;
}
