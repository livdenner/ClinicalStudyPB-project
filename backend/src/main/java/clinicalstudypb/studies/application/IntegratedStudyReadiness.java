package clinicalstudypb.studies.application;

import clinicalstudypb.criteria.application.StudyCriterionService;
import clinicalstudypb.participants.application.ParticipantLookup;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integra critérios e participantes reais na prontidão das transições do estudo.
 * Substitui como implementação principal a prontidão parcial do módulo de critérios.
 *
 * @author Lívia
 * @since 2026-11-09
 * @version 0.0.1
 */
@Service
@Primary
public class IntegratedStudyReadiness implements StudyReadiness {

    private final StudyCriterionService criterionService;
    private final ParticipantLookup participantLookup;

    /**
     * Recebe as consultas públicas dos módulos relacionados.
     *
     * @param criterionService consulta pública dos critérios
     * @param participantLookup consulta pública das inclusões
     */
    public IntegratedStudyReadiness(StudyCriterionService criterionService, ParticipantLookup participantLookup) {
        this.criterionService = criterionService;
        this.participantLookup = participantLookup;
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(readOnly = true)
    public boolean hasInclusionAndExclusionCriteria(Long studyId) {
        return criterionService.hasInclusionAndExclusionCriteria(studyId);
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(readOnly = true)
    public boolean hasIncludedParticipant(Long studyId) {
        return participantLookup.countIncluded(studyId) > 0;
    }
}
