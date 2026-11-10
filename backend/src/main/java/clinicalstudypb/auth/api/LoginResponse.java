package clinicalstudypb.auth.api;

import clinicalstudypb.users.api.UserResponse;

/** Resposta de autenticação com o token e os dados públicos do usuário.
 *
 * @param accessToken token JWT para chamadas protegidas
 * @param tokenType tipo de token, Bearer
 * @param expiresIn validade em segundos
 * @param user dados públicos da conta
 * @author Lívia
 * @since 2026-10-23
 * @version 0.0.1
 */
public record LoginResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        UserResponse user
) {
}
