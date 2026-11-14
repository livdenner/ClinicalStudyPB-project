package clinicalstudypb.participants.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * Corpo da retirada do participante (RF16). O limite de 500 caracteres é conferido pelo
 * serviço depois de remover os espaços nas extremidades.
 *
 * @param reason motivo da retirada; obrigatório
 * @author Allan Guilherme
 * @since 2026-11-14
 * @version 0.0.1
 */
@Schema(name = "ParticipantWithdrawalRequest", requiredProperties = {"reason"})
public record ParticipantWithdrawalRequest(
        @NotBlank
        @Schema(minLength = 1, maxLength = 500,
                description = "Motivo da retirada; espaços nas extremidades são removidos")
        String reason) {
}
