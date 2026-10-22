package clinicalstudypb.users.api;

import clinicalstudypb.users.domain.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Dados recebidos pela API para atualizar um usuário.
 *
 * @param name novo nome
 * @param email novo e-mail
 * @param role novo perfil
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
public record UpdateUserRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Email @Size(max = 255) String email,
        @NotNull UserRole role
) {
}
