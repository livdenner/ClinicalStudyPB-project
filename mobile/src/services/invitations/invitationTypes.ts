/**
 * Situações de convite expostas pelas rotas `/api/me/invitations`.
 * O contrato referencia o enum amplo `CandidateStatus`, mas estas rotas
 * devolvem apenas os três estados visíveis abaixo.
 */
export const VISIBLE_INVITATION_STATUSES = [
  'CONSENT_PENDING',
  'GRANTED',
  'DECLINED',
] as const;

/** Situação de um convite visível no aplicativo. */
export type VisibleInvitationStatus =
  (typeof VISIBLE_INVITATION_STATUSES)[number];

/** Decisão que o participante pode registrar. */
export type InvitationDecision = Extract<
  VisibleInvitationStatus,
  'GRANTED' | 'DECLINED'
>;

/**
 * Resumo de um convite devolvido por `GET /api/me/invitations`.
 * `status` permanece como texto porque a API pode evoluir o enum; a
 * normalização segura acontece antes de qualquer decisão na interface.
 */
export interface StudyInvitationSummary {
  candidateId: number;
  studyId: number;
  studyTitle: string;
  status: string;
  decidedAt?: string;
}

/** Atividade prevista em uma visita do protocolo. */
export interface PlannedActivity {
  id: number;
  name: string;
  description: string;
  position: number;
}

/** Visita prevista do protocolo, com data civil `YYYY-MM-DD`. */
export interface PlannedVisit {
  id: number;
  studyId: number;
  name: string;
  plannedDate: string;
  position: number;
  activities: PlannedActivity[];
}

/** Detalhe devolvido por `GET /api/me/invitations/{candidateId}`. */
export interface StudyInvitation extends StudyInvitationSummary {
  studyObjective: string;
  startDate: string;
  endDate: string;
  responsibleName: string;
  plannedVisits: PlannedVisit[];
  termText: string;
}

/** Corpo aceito por `POST /api/me/invitations/{candidateId}/decision`. */
export interface InvitationDecisionRequest {
  status: InvitationDecision;
}
