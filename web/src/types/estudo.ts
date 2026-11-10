export type DadosEstudoApi = {
    title: string;
    objective: string;
    responsibleUserId: number;
    startDate: string;
    endDate: string;
    participantLimit: number;
};

export type EstadoEstudo = "PLANNING" | "RECRUITMENT" | "EXECUTION" | "CLOSED" | "CANCELLED";

export type FiltroEstadoEstudo = EstadoEstudo | "";

export type EstudoApi = DadosEstudoApi & { id: number; status: EstadoEstudo; version: number };

export type DadosTransicaoEstudoApi = {
    status: EstadoEstudo;
    expectedStatus: EstadoEstudo;
    reason?: string;
};

export type HistoricoEstadoEstudo = {
    id: number;
    actorUserId: number;
    changedAt: string;
    fromStatus: EstadoEstudo;
    toStatus: EstadoEstudo;
    reason: string | null;
};
