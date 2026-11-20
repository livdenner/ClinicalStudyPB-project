package clinicalstudypb.visits.domain;

/**
 * Indica conflito entre uma alteração e o protocolo atual do estudo.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
public class ProtocolConflictException extends RuntimeException {

    private final String code;

    /**
     * Descreve a regra do protocolo violada.
     *
     * @param message explicação do conflito
     */
    public ProtocolConflictException(String message) {
        super(message);
        this.code = null;
    }

    /**
     * Cria um conflito de protocolo com código estável para a API.
     *
     * @param code código do conflito
     * @param message explicação do conflito
     */
    public ProtocolConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    /** Retorna o código do conflito, quando definido. */
    public String getCode() {
        return code;
    }
}
