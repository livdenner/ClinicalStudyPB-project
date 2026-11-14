package clinicalstudypb.participants.domain;

/**
 * Indica que o estado atual do estudo ou do participante impede a retirada (409).
 * O código estável é exposto no campo {@code code} do ProblemDetail.
 *
 * @author Allan Guilherme
 * @since 2026-11-14
 * @version 0.0.1
 */
public class WithdrawalConflictException extends RuntimeException {

    /** Participante já retirado anteriormente. */
    public static final String PARTICIPANT_ALREADY_WITHDRAWN = "PARTICIPANT_ALREADY_WITHDRAWN";

    /** Estudo encerrado ou cancelado, somente leitura. */
    public static final String STUDY_READ_ONLY = "STUDY_READ_ONLY";

    private final String code;

    /**
     * Cria o conflito com o código da regra violada.
     *
     * @param code código estável publicado no contrato
     * @param message descrição legível do conflito
     */
    public WithdrawalConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * Retorna o código estável da regra violada.
     *
     * @return código publicado no contrato
     */
    public String getCode() {
        return code;
    }
}
