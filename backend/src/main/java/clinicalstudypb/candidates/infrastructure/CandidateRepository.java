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
    List<Candidate> findAllByStudyIdOrderByIdAsc(Long studyId);

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

    /**
     * Confere a chave de duplicidade antes de gravar.
     *
     * @param studyId identificador do estudo
     * @param nameKey nome normalizado
     * @param age idade informada
     * @return verdadeiro se já existir candidato com os mesmos dados
     */
    boolean existsByStudyIdAndNameKeyAndAge(Long studyId, String nameKey, Integer age);
}
