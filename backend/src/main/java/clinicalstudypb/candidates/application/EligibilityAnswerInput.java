package clinicalstudypb.candidates.application;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * Resposta informada para um critério de elegibilidade.
 *
 * @param criterionId critério avaliado
 * @param matches se a condição descrita pelo critério se aplica ao candidato
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
@Schema(name = "EligibilityAnswerWriteRequest")
public record EligibilityAnswerInput(@NotNull @Positive Long criterionId, @NotNull Boolean matches) {
}
