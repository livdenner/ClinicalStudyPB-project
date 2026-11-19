export type StatusConsentimentoApi = "PENDING" | "GRANTED" | "DECLINED";

export const CONSENTIMENTO_LABELS: Record<StatusConsentimentoApi, string> = {
    PENDING: "Pendente",
    GRANTED: "Aceito",
    DECLINED: "Recusado",
};
