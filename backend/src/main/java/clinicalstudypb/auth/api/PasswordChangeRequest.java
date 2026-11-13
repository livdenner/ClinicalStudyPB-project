package clinicalstudypb.auth.api;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Dados enviados para definir a senha no primeiro acesso ou alterar a senha atual.
 *
 * @param currentPassword senha atual, obrigatória quando {@code mustChangePassword=false}
 * @param newPassword nova senha (8 a 72 caracteres, com ao menos uma letra e um número)
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
public record PasswordChangeRequest(
        @Schema(description = "Obrigatória quando mustChangePassword=false",
                accessMode = Schema.AccessMode.WRITE_ONLY)
        String currentPassword,
        @Schema(
                description = "8 a 72 caracteres, com ao menos uma letra e um número",
                minLength = 8,
                maxLength = 72,
                pattern = "^(?=.*[A-Za-z])(?=.*[0-9]).{8,72}$",
                accessMode = Schema.AccessMode.WRITE_ONLY)
        String newPassword
) {
}
