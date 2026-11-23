import type { PlannedVisit } from '../protocol/protocolTypes';

/** Estados possíveis de um estudo clínico devolvidos pelo backend. */
export const STUDY_STATUSES = [
  'PLANNING',
  'RECRUITMENT',
  'EXECUTION',
  'CLOSED',
  'CANCELLED',
] as const;

/** Situação do estudo clínico no contrato da API. */
export type StudyStatus = (typeof STUDY_STATUSES)[number];

/** Situações possíveis da participação do usuário em um estudo. */
export const PARTICIPATION_STATUSES = ['ACTIVE', 'WITHDRAWN'] as const;

/** Situação da participação do participante autenticado. */
export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];

/**
 * Participação devolvida por `GET /api/me/studies`.
 * `studyStatus` e `participationStatus` permanecem como texto porque a API pode
 * evoluir esses enums; a normalização segura ocorre na camada de apresentação.
 */
export interface ParticipantStudy {
  participantId: number;
  studyId: number;
  studyTitle: string;
  studyObjective: string;
  studyStatus: string;
  startDate: string;
  endDate: string;
  responsibleName: string;
  participationStatus: string;
  includedAt: string;
  withdrawnAt?: string | null;
  plannedVisits: PlannedVisit[];
}
