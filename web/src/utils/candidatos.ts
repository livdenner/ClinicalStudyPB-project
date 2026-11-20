import type { CandidatoApi, StatusCandidatoApi } from "../types/candidato";

const SITUACOES_CANCELAVEIS: readonly StatusCandidatoApi[] = [
    "INVITED",
    "ACTIVE",
    "CONSENT_PENDING",
    "GRANTED",
    "DECLINED",
];

/** Confere a situação retornada pela API para oferecer cancelamento antes da inclusão. @author Lívia */
export function candidatoPodeSerCancelado(candidato: CandidatoApi): boolean {
    return SITUACOES_CANCELAVEIS.includes(candidato.status);
}

/** Confere as condições do candidato retornadas pela API para oferecer inclusão. @author Lívia */
export function candidatoPodeSerIncluido(candidato: CandidatoApi): boolean {
    return (
        candidato.status === "GRANTED" &&
        candidato.consentStatus === "GRANTED" &&
        candidato.eligibilityStatus === "ELIGIBLE"
    );
}
