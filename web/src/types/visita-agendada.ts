/** Situações de visitas agendadas previstas no contrato RF12/RF13. @author Lívia */
export type StatusVisitaAgendada = "SCHEDULED" | "DONE" | "ABSENT" | "CANCELLED";

/** Dados enviados para agendar uma visita do protocolo para um participante. @author Lívia */
export type DadosAgendamentoVisita = {
    plannedVisitId: number;
    scheduledAt: string;
};

/** Agendamento e versão retornados pela API, preservados para consulta. @author Lívia */
export type VisitaAgendada = DadosAgendamentoVisita & {
    id: number;
    studyId: number;
    participantId: number;
    participantName: string;
    plannedVisitName: string;
    status: StatusVisitaAgendada;
    createdByUserId: number;
    createdAt: string;
    version: number;
    outcomeByUserId?: number;
    outcomeAt?: string;
    outcomeNote?: string;
};

export const STATUS_VISITA_LABELS: Record<StatusVisitaAgendada, string> = {
    SCHEDULED: "Agendada",
    DONE: "Realizada",
    ABSENT: "Ausente",
    CANCELLED: "Cancelada",
};
