package clinicalstudypb.candidates.infrastructure;

import clinicalstudypb.candidates.domain.Candidate;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Persistência e consultas de candidatos sem expor repositórios de outros módulos.
 *
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
public interface CandidateRepository extends JpaRepository<Candidate, Long> {

    /**
     * Lista os candidatos do estudo em ordem estável de cadastro.
     *
     * @param studyId identificador do estudo
     * @return candidatos do estudo
     */
    /** Lista os candidatos do estudo incluindo cancelados, na ordem de cadastro. */
    List<Candidate> findAllByStudyIdOrderByIdAsc(Long studyId);

    /** Lista os candidatos não cancelados do estudo, na ordem de cadastro. */
    List<Candidate> findAllByStudyIdAndCancelledAtIsNullOrderByIdAsc(Long studyId);

    /**
     * Busca um candidato somente dentro do estudo indicado.
     *
     * @param id identificador do candidato
     * @param studyId identificador do estudo
     * @return candidato quando pertence ao estudo
     */
    Optional<Candidate> findByIdAndStudyId(Long id, Long studyId);

    /**
     * Bloqueia o candidato durante a troca de consentimento ou inclusão.
     *
     * @param id identificador do candidato
     * @param studyId identificador do estudo
     * @return candidato pertencente ao estudo, quando existe
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Candidate c where c.id = :id and c.studyId = :studyId")
    Optional<Candidate> findForConsentUpdate(@Param("id") Long id, @Param("studyId") Long studyId);

    /** Impede vincular a mesma conta duas vezes ao mesmo estudo enquanto houver candidatura não cancelada. */
    boolean existsByStudyIdAndUserIdAndCancelledAtIsNull(Long studyId, Long userId);

    /** Verifica se a conta possui alguma candidatura não cancelada em qualquer estudo. */
    boolean existsByUserIdAndCancelledAtIsNull(Long userId);
}
