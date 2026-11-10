package clinicalstudypb.users.api;

import clinicalstudypb.users.domain.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Dados recebidos pela API para cadastrar um usuário.
 *
 * @param name nome do usuário
 * @param email e-mail único
 * @param password senha que será codificada pelo serviço
 * @param role perfil inicial
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
public record CreateUserRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank String password,
        @NotNull UserRole role
) {
}
