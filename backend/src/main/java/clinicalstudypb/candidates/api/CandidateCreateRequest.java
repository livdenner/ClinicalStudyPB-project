package clinicalstudypb.candidates.api;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Dados recebidos para cadastrar um candidato.
 *
 * @param name nome do candidato
 * @param age idade informada
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
public record CandidateCreateRequest(@NotBlank @Size(max = 120) String name,
                                     @NotNull @Min(1) @Max(130) Integer age) {
}
