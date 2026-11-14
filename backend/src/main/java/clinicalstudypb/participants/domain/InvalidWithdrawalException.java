package clinicalstudypb.participants.domain;

/**
 * Indica que os dados enviados para a retirada são inválidos (400).
 *
 * @author Allan Guilherme
 * @since 2026-11-14
 * @version 0.0.1
 */
public class InvalidWithdrawalException extends RuntimeException {

    /**
     * Cria a exceção com a regra de validação não atendida.
     *
     * @param message descrição legível da validação
     */
    public InvalidWithdrawalException(String message) {
        super(message);
    }
}
