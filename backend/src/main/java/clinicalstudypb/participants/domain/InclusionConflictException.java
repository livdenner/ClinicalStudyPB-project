package clinicalstudypb.participants.domain;

/**
 * Indica que uma pré-condição de inclusão de participante não foi atendida.
 *
 * @author Lívia
 * @since 2026-11-09
 * @version 0.0.1
 */
public class InclusionConflictException extends RuntimeException {

    /**
     * Descreve a pré-condição que impediu a inclusão.
     *
     * @param message motivo da recusa, sem dados internos de persistência
     */
    public InclusionConflictException(String message) {
        super(message);
    }
}
