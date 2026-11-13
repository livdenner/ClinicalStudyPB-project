package clinicalstudypb.candidates.domain;

/**
 * Indica dados inválidos em operações de candidatura.
 */
public class InvalidCandidateException extends RuntimeException {

    /**
     * Cria a exceção com uma mensagem para a API.
     *
     * @param message descrição da violação
     */
    public InvalidCandidateException(String message) {
        super(message);
    }
}
