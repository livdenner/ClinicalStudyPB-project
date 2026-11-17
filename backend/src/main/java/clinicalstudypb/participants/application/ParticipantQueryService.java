package clinicalstudypb.participants.application;

import clinicalstudypb.participants.domain.Participant;
import clinicalstudypb.participants.infrastructure.ParticipantRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Consulta inclusões reais para proteger alterações posteriores de elegibilidade e lista as
 * participações da conta autenticada (RF17).
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
@Service
public class ParticipantQueryService implements ParticipantLookup {

    private final ParticipantRepository participantRepository;

    /**
     * Recebe a persistência de participantes.
     *
     * @param participantRepository repositório interno do módulo
     */
    public ParticipantQueryService(ParticipantRepository participantRepository) {
        this.participantRepository = participantRepository;
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(readOnly = true)
    public boolean isIncluded(Long studyId, Long candidateId) {
        return participantRepository.existsByStudyIdAndCandidateId(studyId, candidateId);
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(readOnly = true)
    public long countIncluded(Long studyId) {
        return participantRepository.countByStudyId(studyId);
    }

    /**
     * Lista as participações da conta autenticada, ativas ou retiradas (RF17, T23.1).
     *
     * @param userId conta dona das candidaturas, vinda do token
     * @return participações da inclusão mais recente para a mais antiga
     */
    @Transactional(readOnly = true)
    public List<Participant> listByAccount(Long userId) {
        return participantRepository.findAllByAccountOrderByIncludedAtDesc(userId);
    }
}
