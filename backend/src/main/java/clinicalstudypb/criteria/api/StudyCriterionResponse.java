package clinicalstudypb.criteria.api;

import clinicalstudypb.criteria.domain.CriterionType;
import clinicalstudypb.criteria.domain.StudyCriterion;

/**
 * Representação pública de um critério de estudo.
 *
 * @param id identificador do critério
 * @param studyId identificador do estudo
 * @param type classificação
 * @param description descrição
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
public record StudyCriterionResponse(Long id, Long studyId, CriterionType type, String description) {

    /**
     * Converte a entidade persistida para o contrato da API.
     *
     * @param criterion entidade de critério
     * @return resposta pública
     */
    public static StudyCriterionResponse from(StudyCriterion criterion) {
        return new StudyCriterionResponse(criterion.getId(), criterion.getStudyId(),
                criterion.getType(), criterion.getDescription());
    }
}
