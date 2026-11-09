import type { EstudoApi } from "./estudo";

export type StatusEstudoCandidato = "PLANNING" | "RECRUITMENT" | "EXECUTION" | "CLOSED";

export type EstudoComStatusApi = EstudoApi & {
    status?: StatusEstudoCandidato;
};

export type StatusElegibilidadeApi = "PENDING" | "ELIGIBLE" | "INELIGIBLE";

export type DadosCandidatoApi = {
    name: string;
    age: number;
};

export type CandidatoApi = {
    id: number;
    studyId: number;
    name: string;
    age: number;
    eligibilityStatus: StatusElegibilidadeApi;
};

export const STATUS_ESTUDO_LABELS: Record<StatusEstudoCandidato, string> = {
    PLANNING: "Planejamento",
    RECRUITMENT: "Em recrutamento",
    EXECUTION: "Em execução",
    CLOSED: "Encerrado",
};

export const ELEGIBILIDADE_LABELS: Record<StatusElegibilidadeApi, string> = {
    PENDING: "Pendente",
    ELIGIBLE: "Elegível",
    INELIGIBLE: "Inelegível",
};
