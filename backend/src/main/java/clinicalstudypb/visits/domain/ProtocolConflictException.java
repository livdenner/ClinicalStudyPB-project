package clinicalstudypb.visits.domain;

/**
 * Indica conflito entre uma alteração e o protocolo atual do estudo.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
public class ProtocolConflictException extends RuntimeException {

    /**
     * Descreve a regra do protocolo violada.
     *
     * @param message explicação do conflito
     */
    public ProtocolConflictException(String message) {
        super(message);
    }
}
