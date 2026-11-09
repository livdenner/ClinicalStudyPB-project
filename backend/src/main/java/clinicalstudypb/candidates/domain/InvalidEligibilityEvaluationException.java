package clinicalstudypb.candidates.domain;

/**
 * Indica respostas de elegibilidade inválidas para o estudo e candidato informados.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
public class InvalidEligibilityEvaluationException extends IllegalArgumentException {

    /**
     * Descreve a validação não atendida.
     *
     * @param message explicação para o cliente
     */
    public InvalidEligibilityEvaluationException(String message) {
        super(message);
    }
}
