export type StatusConsentimentoApi = "PENDING" | "GRANTED" | "DECLINED";

export type DecisaoConsentimentoApi = "GRANTED" | "DECLINED";

export type DadosConsentimentoSimuladoApi = {
    status: DecisaoConsentimentoApi;
};

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
