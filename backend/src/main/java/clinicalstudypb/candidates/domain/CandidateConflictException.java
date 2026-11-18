package clinicalstudypb.candidates.domain;

/**
 * Indica conflito de negócio ao cadastrar ou consultar um candidato.
 *
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
public class CandidateConflictException extends RuntimeException {

    /** Código estável publicado em {@code ProblemDetail}, quando aplicável. */
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

    /**
     * Cria conflito da Release 2 com código estável para os clientes.
     *
     * @param code código estável de conflito
     * @param message explicação legível do conflito
     */
    public CandidateConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * Retorna o código estável da regra, quando definido no contrato.
     *
     * @return código de erro ou {@code null}
     */
    public String getCode() {
        return code;
    }
}
