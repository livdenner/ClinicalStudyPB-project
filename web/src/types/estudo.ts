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
};
