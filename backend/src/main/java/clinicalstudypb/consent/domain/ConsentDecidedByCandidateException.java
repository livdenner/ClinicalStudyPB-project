package clinicalstudypb.consent.domain;

/**
 * Indica tentativa de uso da rota descontinuada de consentimento do coordenador (HTTP 403).
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-17
 * @version 0.0.1
 */
public class ConsentDecidedByCandidateException extends RuntimeException {

    /** Código estável publicado no contrato para a rota descontinuada de consentimento. */
    public static final String CODE = "CONSENT_DECIDED_BY_CANDIDATE";

    /**
     * Cria a exceção informando que a decisão pertence exclusivamente ao candidato.
     */
    public ConsentDecidedByCandidateException() {
        super("A decisão de consentimento é registrada apenas pelo candidato autenticado.");
    }

    /**
     * Retorna o código estável publicado no contrato.
     *
     * @return {@value #CODE}
     */
    public String getCode() {
        return CODE;
    }
}
