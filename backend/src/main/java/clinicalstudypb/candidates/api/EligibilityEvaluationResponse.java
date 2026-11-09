package clinicalstudypb.candidates.api;

import clinicalstudypb.candidates.application.EligibilityEvaluationResult;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/**
 * Representação HTTP da avaliação, sem expor entidades nem autoria recebida do cliente.
 *
 * @param studyId estudo do candidato
 * @param candidateId candidato avaliado
 * @param status resultado atual
 * @param answers respostas atuais ordenadas por critério
 * @param evaluatedAt última avaliação, omitida antes da primeira resposta
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
@Schema(name = "EligibilityEvaluation")
public record EligibilityEvaluationResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long studyId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long candidateId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) EligibilityStatus status,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AnswerResponse> answers,
                                           @JsonInclude(JsonInclude.Include.NON_NULL) Instant evaluatedAt) {

    /**
     * Converte o resultado da aplicação no formato previsto pelo contrato.
     *
     * @param result avaliação consultada ou registrada
     * @return representação HTTP
     */
    public static EligibilityEvaluationResponse from(EligibilityEvaluationResult result) {
        List<AnswerResponse> answers = result.answers().stream()
                .map(answer -> new AnswerResponse(answer.getCriterionId(), answer.isMatches())).toList();
        return new EligibilityEvaluationResponse(result.studyId(), result.candidateId(), result.status(),
                answers, result.evaluatedAt());
    }

    /**
     * Resposta de um critério no formato público da API.
     *
     * @param criterionId critério avaliado
     * @param matches se a condição se aplica ao candidato
     * @author Lívia
     */
    @Schema(name = "EligibilityAnswer")
    public record AnswerResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long criterionId,
                                 @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean matches) {
    }
}
