import type { StatusConsentimentoApi } from "./consentimento";
import type { EstudoApi } from "./estudo";

export type StatusEstudoCandidato =
    "PLANNING" | "RECRUITMENT" | "EXECUTION" | "CLOSED" | "CANCELLED";

export type EstudoComStatusApi = EstudoApi & {
    status?: StatusEstudoCandidato;
};

export type StatusElegibilidadeApi = "PENDING" | "ELIGIBLE" | "INELIGIBLE";

export type DadosCandidatoApi = {
    name: string;
    age: number;
    email: string;
    phone: string;
};

export type StatusCandidatoApi =
    "INVITED" | "ACTIVE" | "CONSENT_PENDING" | "GRANTED" | "DECLINED" | "INCLUDED" | "CANCELLED";

/** Rótulos da situação consolidada pelo backend, sem inferência local. @author Lívia */
export const SITUACAO_CANDIDATO_LABELS: Record<StatusCandidatoApi, string> = {
    INVITED: "Convidado",
    ACTIVE: "Conta ativa",
    CONSENT_PENDING: "Aguardando decisão",
    GRANTED: "Aceitou",
    DECLINED: "Recusou",
    INCLUDED: "Incluído",
    CANCELLED: "Cancelado",
};

export type AtivacaoCandidatoApi = {
    expiresAt: string;
    expired: boolean;
};

export type CandidatoApi = DadosCandidatoApi & {
    id: number;
    studyId: number;
    userId: number;
    status: StatusCandidatoApi;
    eligibilityStatus: StatusElegibilidadeApi;
    consentStatus: StatusConsentimentoApi;
    activation?: AtivacaoCandidatoApi;
};

/** Resposta exclusiva do cadastro; o código não faz parte dos dados da listagem. @author Lívia */
export type CadastroCandidatoApi = CandidatoApi &
    (
        | { status: "ACTIVE"; activation?: never }
        | {
              status: "INVITED";
              activation: AtivacaoCandidatoApi & { activationCode: string };
          }
    );

export const STATUS_ESTUDO_LABELS: Record<StatusEstudoCandidato, string> = {
    PLANNING: "Planejamento",
    RECRUITMENT: "Em recrutamento",
    EXECUTION: "Em execução",
    CLOSED: "Encerrado",
    CANCELLED: "Cancelado",
};

export const ELEGIBILIDADE_LABELS: Record<StatusElegibilidadeApi, string> = {
    PENDING: "Pendente",
    ELIGIBLE: "Elegível",
    INELIGIBLE: "Inelegível",
};
