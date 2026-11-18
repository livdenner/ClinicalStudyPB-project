package clinicalstudypb.consent.domain;

/**
 * Indica que o estado atual impede alterar ou registrar o consentimento simulado.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-07
 * @version 0.0.2
 */
public class ConsentConflictException extends RuntimeException {

    /** A decisão de consentimento já foi registrada anteriormente. */
    public static final String CONSENT_ALREADY_DECIDED = "CONSENT_ALREADY_DECIDED";

    /** A candidatura ainda não concluiu elegibilidade como ELIGIBLE ou já foi incluída. */
    public static final String CONSENT_NOT_AVAILABLE = "CONSENT_NOT_AVAILABLE";

    /** O estudo não está mais em recrutamento. */
    public static final String STUDY_NOT_RECRUITING = "STUDY_NOT_RECRUITING";

    /** Código estável publicado no contrato. */
    private final String code;

    /**
     * Cria o erro com a regra violada sem código específico.
     *
     * @param message descrição do conflito
     */
    public ConsentConflictException(String message) {
        this(null, message);
    }

    /**
     * Cria o erro com código contratual estável e mensagem explicativa.
     *
     * @param code código estável publicado no contrato
     * @param message descrição do conflito
     */
    public ConsentConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * Retorna o código estável da regra violada, quando aplicável.
     *
     * @return código contratual ou {@code null}
     */
    public String getCode() {
        return code;
    }
}
