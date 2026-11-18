package clinicalstudypb.users.domain;

/**
 * Indica que uma operação administrativa sobre uma conta de usuário viola uma regra de proteção (409).
 * O código estável é exposto na propriedade {@code code} do ProblemDetail.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-15
 * @version 0.0.1
 */
public class UserConflictException extends RuntimeException {

    /** Operação de exclusão, desativação ou troca de perfil sobre a própria conta do administrador. */
    public static final String SELF_ACCOUNT_CHANGE_NOT_ALLOWED = "SELF_ACCOUNT_CHANGE_NOT_ALLOWED";

    /** Operação que deixaria o sistema sem nenhum administrador ativo. */
    public static final String LAST_ACTIVE_ADMINISTRATOR = "LAST_ACTIVE_ADMINISTRATOR";

    private final String code;

    /**
     * Cria o conflito com o código contratual e a mensagem explicativa.
     *
     * @param code código estável publicado no contrato OpenAPI
     * @param message descrição legível da regra violada
     */
    public UserConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * Retorna o código estável da regra violada.
     *
     * @return código publicado no contrato
     */
    public String getCode() {
        return code;
    }
}
