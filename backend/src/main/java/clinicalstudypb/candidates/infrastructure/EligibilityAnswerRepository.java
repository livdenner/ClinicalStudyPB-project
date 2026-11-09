package clinicalstudypb.candidates.infrastructure;

import clinicalstudypb.candidates.domain.EligibilityAnswer;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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
     * Lista as respostas atuais em ordem estável de critério.
     *
     * @param candidateId candidato avaliado
     * @return respostas do candidato
     */
    List<EligibilityAnswer> findAllByCandidateIdOrderByCriterionIdAsc(Long candidateId);

    /**
     * Remove o conjunto anterior antes de persistir sua substituição na mesma transação.
     *
     * @param candidateId candidato avaliado
     */
    @Modifying
    @Query("delete from EligibilityAnswer answer where answer.candidateId = :candidateId")
    void deleteForCandidate(@Param("candidateId") Long candidateId);

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
