package clinicalstudypb.consent.domain;

/**
 * Indica que o estado atual impede alterar o consentimento simulado.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-07
 * @version 0.0.1
 */
public class ConsentConflictException extends RuntimeException {
    /**
     * Cria o erro com a regra violada.
     *
     * @param message descrição do conflito
     */
    public ConsentConflictException(String message) {
        super(message);
    }
}
