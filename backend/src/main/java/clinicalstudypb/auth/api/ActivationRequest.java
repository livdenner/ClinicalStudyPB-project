package clinicalstudypb.auth.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * E-mail e código informados no primeiro acesso pelo aplicativo.
 *
 * @param email endereço de e-mail da conta convidada
 * @param activationCode código de ativação emitido pelo coordenador
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
public record ActivationRequest(@NotBlank @Email @Size(max = 255) String email,
                                @NotBlank @Size(max = 32) String activationCode) {
}
