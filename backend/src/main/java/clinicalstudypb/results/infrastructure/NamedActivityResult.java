package clinicalstudypb.results.infrastructure;

import clinicalstudypb.results.domain.ActivityResult;

/**
 * Projeção de leitura que associa o resultado persistido ao nome atual da atividade prevista.
 *
 * @param result resultado persistido da atividade
 * @param activityName nome atual da atividade no protocolo
 */
public record NamedActivityResult(ActivityResult result, String activityName) {
}
