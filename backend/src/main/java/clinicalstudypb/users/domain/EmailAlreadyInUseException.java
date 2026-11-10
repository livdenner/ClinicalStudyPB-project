package clinicalstudypb.users.domain;

/**
 * Indica que o e-mail informado já pertence a outro usuário.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
public class EmailAlreadyInUseException extends RuntimeException {

    /**
     * Cria a exceção para o e-mail em conflito.
     *
     * @param email e-mail que já está cadastrado
     */
    public EmailAlreadyInUseException(String email) {
        super("E-mail já cadastrado: " + email);
    }
}
