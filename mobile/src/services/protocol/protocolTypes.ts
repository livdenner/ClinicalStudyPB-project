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
