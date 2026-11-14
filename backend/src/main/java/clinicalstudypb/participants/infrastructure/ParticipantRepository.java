package clinicalstudypb.participants.infrastructure;

import clinicalstudypb.participants.domain.Participant;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Persistência dos vínculos de inclusão de candidatos como participantes.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
public interface ParticipantRepository extends JpaRepository<Participant, Long> {

    /**
     * Confere a existência do vínculo dentro do estudo indicado.
     *
     * @param studyId estudo do candidato
     * @param candidateId candidato consultado
     * @return verdadeiro se o candidato já foi incluído
     */
    boolean existsByStudyIdAndCandidateId(Long studyId, Long candidateId);

    /**
     * Conta as inclusões persistidas de um estudo.
     *
     * @param studyId estudo consultado
     * @return quantidade de participantes incluídos
     */
    long countByStudyId(Long studyId);

    /**
     * Lista os vínculos persistidos somente no estudo solicitado.
     *
     * @param studyId estudo consultado
     * @return participantes em ordem estável de inclusão
     */
    List<Participant> findAllByStudyIdOrderByIdAsc(Long studyId);

    /**
     * Busca um vínculo pelo identificador e pelo estudo.
     *
     * @param id participante consultado
     * @param studyId estudo da rota
     * @return vínculo do estudo
     */
    Optional<Participant> findByIdAndStudyId(Long id, Long studyId);

    /**
     * Bloqueia um vínculo participante-estudo para escrita concorrente.
     *
     * @param id participante consultado
     * @param studyId estudo da rota
     * @return vínculo bloqueado no estudo
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Participant p WHERE p.id = :id AND p.studyId = :studyId")
    Optional<Participant> findByIdAndStudyIdForUpdate(@Param("id") Long id, @Param("studyId") Long studyId);
}
