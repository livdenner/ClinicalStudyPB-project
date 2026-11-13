package clinicalstudypb.candidates.domain;

/**
 * Indica conflito de negócio ao cadastrar ou consultar um candidato.
 *
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
public class CandidateConflictException extends RuntimeException {

    private final String code;

    /**
     * Cria a exceção com uma mensagem para a API.
     *
     * @param message descrição do conflito
     */
    public CandidateConflictException(String message) {
        super(message);
        this.code = null;
    }

    /** Cria conflito da Release 2 com código estável para os clientes. */
    public CandidateConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    /** Código estável da regra, quando definido no contrato. */
    public String getCode() {
        return code;
    }
}
