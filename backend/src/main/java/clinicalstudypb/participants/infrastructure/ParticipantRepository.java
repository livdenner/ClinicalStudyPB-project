package clinicalstudypb.participants.infrastructure;

import clinicalstudypb.participants.domain.Participant;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
