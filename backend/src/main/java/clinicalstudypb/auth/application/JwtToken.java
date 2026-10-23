package clinicalstudypb.auth.application;

/** Token de acesso emitido e seu prazo de validade em segundos.
 *
 * @param value token assinado
 * @param expiresIn validade em segundos
 * @author Lívia
 * @since 2026-10-23
 * @version 0.0.1
 */
public record JwtToken(String value, long expiresIn) {
}
