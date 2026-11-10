package clinicalstudypb.candidates.application;

import clinicalstudypb.candidates.domain.EligibilityAnswer;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import java.time.Instant;
import java.util.List;

/**
 * Retrato consistente do resultado e das respostas atuais de um candidato.
 *
 * @param studyId estudo do candidato
 * @param candidateId candidato avaliado
 * @param status resultado atual
 * @param answers respostas ordenadas por critério
 * @param evaluatedAt instante da última avaliação, ou nulo antes da primeira
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
public record EligibilityEvaluationResult(Long studyId, Long candidateId, EligibilityStatus status,
                                          List<EligibilityAnswer> answers, Instant evaluatedAt) {
}
