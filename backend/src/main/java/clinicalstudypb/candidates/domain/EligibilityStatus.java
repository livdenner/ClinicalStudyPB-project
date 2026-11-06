package clinicalstudypb.candidates.domain;

/**
 * Resultado atual da avaliação de elegibilidade do candidato.
 *
 * @author Codex
 * @since 2026-11-06
 * @version 0.0.1
 */
public enum EligibilityStatus {
    /** Critérios ainda não foram avaliados. */
    PENDING,
    /** Candidato atende aos critérios do estudo. */
    ELIGIBLE,
    /** Candidato não atende aos critérios do estudo. */
    INELIGIBLE
}
