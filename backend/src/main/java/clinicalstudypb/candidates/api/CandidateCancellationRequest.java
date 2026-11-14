package clinicalstudypb.candidates.api;

import jakarta.validation.constraints.NotBlank;

/**
 * Justificativa informada para cancelar uma candidatura antes da inclusão.
 *
 * @param reason motivo do cancelamento; espaços nas extremidades são removidos
 */
public record CandidateCancellationRequest(@NotBlank String reason) {
}
