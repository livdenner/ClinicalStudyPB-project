package clinicalstudypb.shared;

/**
 * Indica que um recurso solicitado não foi encontrado.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
public class ResourceNotFoundException extends RuntimeException {
    /**
     * Cria a exceção com uma mensagem para o cliente.
     *
     * @param message descrição do recurso ausente
     */
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
