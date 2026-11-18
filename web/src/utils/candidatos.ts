import type { CandidatoApi } from "../types/candidato";

/** Confere as condições do candidato retornadas pela API para oferecer inclusão. @author Lívia */
export function candidatoPodeSerIncluido(candidato: CandidatoApi): boolean {
    return (
        candidato.status === "GRANTED" &&
        candidato.consentStatus === "GRANTED" &&
        candidato.eligibilityStatus === "ELIGIBLE"
    );
}
