package clinicalstudypb.candidates.infrastructure;

import clinicalstudypb.candidates.domain.EligibilityAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Persistência das respostas de elegibilidade dos candidatos.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
public interface EligibilityAnswerRepository extends JpaRepository<EligibilityAnswer, Long> {

    /**
     * Verifica se um estudo possui respostas de elegibilidade registradas.
     *
     * @param studyId identificador do estudo
     * @return verdadeiro se existe ao menos uma resposta
     */
    @Query(value = "SELECT EXISTS (SELECT 1 FROM eligibility_answers ea "
            + "JOIN candidates c ON c.id = ea.candidate_id WHERE c.study_id = :studyId)", nativeQuery = true)
    boolean existsForStudy(@Param("studyId") Long studyId);
}
