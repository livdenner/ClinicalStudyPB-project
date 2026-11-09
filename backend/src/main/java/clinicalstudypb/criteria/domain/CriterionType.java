package clinicalstudypb.criteria.domain;

/**
 * Classificação de um critério do protocolo.
 *
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
public enum CriterionType {
    /** Condição que o candidato deve satisfazer. */
    INCLUSION,
    /** Condição que impede a participação quando satisfeita. */
    EXCLUSION
}
