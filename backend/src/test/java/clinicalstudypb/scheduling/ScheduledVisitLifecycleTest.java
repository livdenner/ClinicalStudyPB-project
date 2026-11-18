package clinicalstudypb.scheduling;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import clinicalstudypb.scheduling.application.ScheduledVisitParticipantWithdrawal;
import clinicalstudypb.scheduling.application.ScheduledVisitStudyLifecycle;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import clinicalstudypb.scheduling.infrastructure.ScheduledVisitRepository;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Exercita os adaptadores de ciclo de vida do estudo e retirada sobre o repositório.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-15
 * @version 0.0.1
 */
@ExtendWith(MockitoExtension.class)
class ScheduledVisitLifecycleTest {

    @Mock
    private ScheduledVisitRepository repository;

    @Test
    void studyLifecycleChecksAndCancelsOnlyScheduledVisits() {
        ScheduledVisitStudyLifecycle lifecycle = new ScheduledVisitStudyLifecycle(repository);
        Instant occurredAt = Instant.parse("2026-11-15T12:00:00Z");
        when(repository.existsByStudyIdAndStatus(2L, ScheduledVisitStatus.SCHEDULED)).thenReturn(true);

        assertTrue(lifecycle.hasScheduledVisits(2L));
        lifecycle.cancelPendingScheduledVisits(2L, 7L, occurredAt);

        verify(repository).cancelPendingByStudy(2L, 7L, occurredAt, "Cancelamento do estudo",
                ScheduledVisitStatus.SCHEDULED, ScheduledVisitStatus.CANCELLED);
    }

    @Test
    void withdrawalLifecycleCancelsFutureScheduledVisitsAndReturnsCount() {
        ScheduledVisitParticipantWithdrawal withdrawal = new ScheduledVisitParticipantWithdrawal(repository);
        Instant withdrawnAt = Instant.parse("2026-11-15T12:00:00Z");
        when(repository.cancelFutureByParticipant(2L, 3L, 8L, withdrawnAt, "Retirada do participante",
                ScheduledVisitStatus.SCHEDULED, ScheduledVisitStatus.CANCELLED)).thenReturn(2);

        int cancelled = withdrawal.cancelFutureScheduledVisits(2L, 3L, 8L, withdrawnAt);

        assertEquals(2, cancelled);
    }
}
