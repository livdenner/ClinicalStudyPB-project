import type { PlannedActivity } from '../protocol/protocolTypes';

/** Estados possíveis de uma visita agendada devolvidos pelo backend. */
export const SCHEDULED_VISIT_STATUSES = [
  'SCHEDULED',
  'DONE',
  'ABSENT',
  'CANCELLED',
] as const;

/** Situação de comparecimento ou agendamento da visita no contrato da API. */
export type ScheduledVisitStatus = (typeof SCHEDULED_VISIT_STATUSES)[number];

/**
 * Visita agendada devolvida por `GET /api/me/visits`.
 * `status` permanece como texto porque a API pode evoluir o enum;
 * a normalização segura ocorre na camada de apresentação.
 */
export interface ParticipantVisit {
  id: number;
  studyId: number;
  studyTitle: string;
  participantId: number;
  plannedVisitId: number;
  plannedVisitName: string;
  scheduledAt: string;
  status: string;
  outcomeAt?: string | null;
  cancellationReason?: string | null;
  activities: PlannedActivity[];
}

/** Resposta de `GET /api/me/visits` dividida em próximas visitas e histórico. */
export interface ParticipantVisits {
  upcoming: ParticipantVisit[];
  history: ParticipantVisit[];
}
