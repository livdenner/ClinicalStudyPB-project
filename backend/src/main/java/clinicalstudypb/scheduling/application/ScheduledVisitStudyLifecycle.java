package clinicalstudypb.scheduling.application;

import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import clinicalstudypb.scheduling.infrastructure.ScheduledVisitRepository;
import clinicalstudypb.studies.application.StudySchedulingLifecycle;
import java.time.Instant;
import org.springframework.stereotype.Component;

/**
 * Integra visitas agendadas às mudanças de estado do estudo sem criar ciclo entre serviços.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
@Component
public class ScheduledVisitStudyLifecycle implements StudySchedulingLifecycle {

    private static final String CANCELLATION_NOTE = "Cancelamento do estudo";

    private final ScheduledVisitRepository repository;

    /**
     * Recebe o repositório de agendamentos.
     *
     * @param repository repositório de agendamentos
     */
    public ScheduledVisitStudyLifecycle(ScheduledVisitRepository repository) {
        this.repository = repository;
    }

    @Override
    public boolean hasScheduledVisits(Long studyId) {
        return repository.existsByStudyIdAndStatus(studyId, ScheduledVisitStatus.SCHEDULED);
    }

    @Override
    public void cancelPendingScheduledVisits(Long studyId, Long actorUserId, Instant occurredAt) {
        repository.cancelPendingByStudy(studyId, actorUserId, occurredAt, CANCELLATION_NOTE,
                ScheduledVisitStatus.SCHEDULED, ScheduledVisitStatus.CANCELLED);
    }
}
