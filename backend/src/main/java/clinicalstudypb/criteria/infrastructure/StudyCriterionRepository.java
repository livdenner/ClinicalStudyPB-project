package clinicalstudypb.criteria.infrastructure;

import clinicalstudypb.criteria.domain.CriterionType;
import clinicalstudypb.criteria.domain.StudyCriterion;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Persistência e consultas de critérios sem acessar repositórios de outros módulos.
 *
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
public interface StudyCriterionRepository extends JpaRepository<StudyCriterion, Long> {

    /**
     * Lista critérios do estudo em ordem estável.
     *
     * @param studyId identificador do estudo
     * @return critérios encontrados
     */
    List<StudyCriterion> findAllByStudyIdOrderByIdAsc(Long studyId);

    /**
     * Busca um critério somente dentro do estudo informado.
     *
     * @param id identificador do critério
     * @param studyId identificador do estudo
     * @return critério, quando pertence ao estudo
     */
    Optional<StudyCriterion> findByIdAndStudyId(Long id, Long studyId);

    /**
     * Confere se o estudo possui um critério de determinado tipo.
     *
     * @param studyId identificador do estudo
     * @param type tipo do critério
     * @return verdadeiro quando existe ao menos um
     */
    boolean existsByStudyIdAndType(Long studyId, CriterionType type);
}
