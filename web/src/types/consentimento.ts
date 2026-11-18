export type StatusConsentimentoApi = "PENDING" | "GRANTED" | "DECLINED";

export type ConsentimentoSimuladoApi = {
    studyId: number;
    candidateId: number;
    status: StatusConsentimentoApi;
    recordedAt?: string;
};

export const CONSENTIMENTO_LABELS: Record<StatusConsentimentoApi, string> = {
    PENDING: "Pendente",
    GRANTED: "Aceito",
    DECLINED: "Recusado",
};
