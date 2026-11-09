package clinicalstudypb.candidates.api;

import clinicalstudypb.candidates.application.EligibilityAnswerInput;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Conjunto completo das respostas atuais, conforme o contrato OpenAPI.
 *
 * @param answers respostas sem critérios repetidos, com ao menos um elemento
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
public record EligibilityEvaluationWriteRequest(
        @NotNull @Size(min = 1) List<@NotNull @Valid EligibilityAnswerInput> answers) {
}
