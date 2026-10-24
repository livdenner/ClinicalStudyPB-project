package clinicalstudypb.auth.api;

/** Erro público retornado pelos endpoints de autenticação.
 *
 * @param code código estável do erro
 * @param message mensagem legível
 * @author Lívia
 * @since 2026-10-23
 * @version 0.0.1
 */
public record AuthErrorResponse(String code, String message) {
}
