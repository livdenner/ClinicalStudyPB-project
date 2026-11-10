package clinicalstudypb.auth.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** Dados enviados para autenticar uma conta.
 *
 * @param email e-mail da conta
 * @param password senha em texto recebida somente para validação
 * @author Lívia
 * @since 2026-10-23
 * @version 0.0.1
 */
public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank String password
) {
}
