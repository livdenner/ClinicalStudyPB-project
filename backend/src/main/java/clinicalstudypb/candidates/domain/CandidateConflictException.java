package clinicalstudypb.candidates.domain;

/**
 * Indica conflito de negócio ao cadastrar ou consultar um candidato.
 *
 * @author Codex
 * @since 2026-11-06
 * @version 0.0.1
 */
public class CandidateConflictException extends RuntimeException {

    /**
     * Cria a exceção com uma mensagem para a API.
     *
     * @param message descrição do conflito
     */
    public CandidateConflictException(String message) {
        super(message);
    }
}
