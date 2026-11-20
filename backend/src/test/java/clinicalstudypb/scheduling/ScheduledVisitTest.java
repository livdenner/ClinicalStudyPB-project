package clinicalstudypb.scheduling;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import clinicalstudypb.scheduling.domain.InvalidScheduledVisitException;
import clinicalstudypb.scheduling.domain.ScheduledVisit;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import clinicalstudypb.scheduling.domain.SchedulingConflictException;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;

/**
 * Comprova as transições válidas e inválidas de estado diretamente na entidade {@link ScheduledVisit}.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-19
 * @version 0.0.1
 */
class ScheduledVisitTest {

    private static final Instant SCHEDULED_AT = Instant.parse("2027-06-01T12:00:00Z");
    private static final Instant CREATED_AT = Instant.parse("2026-11-18T12:00:00Z");
    private static final Instant INITIAL_OUTCOME_AT = Instant.parse("2027-06-01T13:00:00Z");
    private static final Instant ATTEMPTED_OUTCOME_AT = Instant.parse("2027-06-01T14:00:00Z");

    @Test
    void scheduledToDoneRecordsOutcomeMetadata() {
        ScheduledVisit visit = scheduledVisit();

        visit.registerOutcome(ScheduledVisitStatus.DONE, 7L, INITIAL_OUTCOME_AT, "Visita concluída");

        assertEquals(ScheduledVisitStatus.DONE, visit.getStatus());
        assertEquals(7L, visit.getOutcomeByUserId());
        assertEquals(INITIAL_OUTCOME_AT, visit.getOutcomeAt());
        assertEquals("Visita concluída", visit.getOutcomeNote());
    }

    @Test
    void scheduledToAbsentRecordsOutcomeMetadata() {
        ScheduledVisit visit = scheduledVisit();

        visit.registerOutcome(ScheduledVisitStatus.ABSENT, 7L, INITIAL_OUTCOME_AT, null);

        assertEquals(ScheduledVisitStatus.ABSENT, visit.getStatus());
        assertEquals(7L, visit.getOutcomeByUserId());
        assertEquals(INITIAL_OUTCOME_AT, visit.getOutcomeAt());
        assertNull(visit.getOutcomeNote());
    }

    @Test
    void scheduledToCancelledRecordsOutcomeMetadata() {
        ScheduledVisit visit = scheduledVisit();

        visit.registerOutcome(ScheduledVisitStatus.CANCELLED, 7L, INITIAL_OUTCOME_AT, "Reagendada");

        assertEquals(ScheduledVisitStatus.CANCELLED, visit.getStatus());
        assertEquals(7L, visit.getOutcomeByUserId());
        assertEquals(INITIAL_OUTCOME_AT, visit.getOutcomeAt());
        assertEquals("Reagendada", visit.getOutcomeNote());
    }

    @ParameterizedTest
    @NullSource
    @EnumSource(value = ScheduledVisitStatus.class, names = "SCHEDULED")
    void scheduledToNonFinalStatusIsRejectedWithoutChangingState(ScheduledVisitStatus invalidTarget) {
        ScheduledVisit visit = scheduledVisit();

        InvalidScheduledVisitException error = assertThrows(InvalidScheduledVisitException.class,
                () -> visit.registerOutcome(invalidTarget, 7L, INITIAL_OUTCOME_AT, "Tentativa"));

        assertEquals("INVALID_VISIT_OUTCOME", error.getCode());
        assertEquals(ScheduledVisitStatus.SCHEDULED, visit.getStatus());
        assertNull(visit.getOutcomeByUserId());
        assertNull(visit.getOutcomeAt());
        assertNull(visit.getOutcomeNote());
    }

    @Test
    void doneToDoneIsRejectedPreservingFinalState() {
        assertFinalTransitionRejected(ScheduledVisitStatus.DONE, ScheduledVisitStatus.DONE);
    }

    @Test
    void doneToAbsentIsRejectedPreservingFinalState() {
        assertFinalTransitionRejected(ScheduledVisitStatus.DONE, ScheduledVisitStatus.ABSENT);
    }

    @Test
    void doneToCancelledIsRejectedPreservingFinalState() {
        assertFinalTransitionRejected(ScheduledVisitStatus.DONE, ScheduledVisitStatus.CANCELLED);
    }

    @Test
    void absentToDoneIsRejectedPreservingFinalState() {
        assertFinalTransitionRejected(ScheduledVisitStatus.ABSENT, ScheduledVisitStatus.DONE);
    }

    @Test
    void absentToAbsentIsRejectedPreservingFinalState() {
        assertFinalTransitionRejected(ScheduledVisitStatus.ABSENT, ScheduledVisitStatus.ABSENT);
    }

    @Test
    void absentToCancelledIsRejectedPreservingFinalState() {
        assertFinalTransitionRejected(ScheduledVisitStatus.ABSENT, ScheduledVisitStatus.CANCELLED);
    }

    @Test
    void cancelledToDoneIsRejectedPreservingFinalState() {
        assertFinalTransitionRejected(ScheduledVisitStatus.CANCELLED, ScheduledVisitStatus.DONE);
    }

    @Test
    void cancelledToAbsentIsRejectedPreservingFinalState() {
        assertFinalTransitionRejected(ScheduledVisitStatus.CANCELLED, ScheduledVisitStatus.ABSENT);
    }

    @Test
    void cancelledToCancelledIsRejectedPreservingFinalState() {
        assertFinalTransitionRejected(ScheduledVisitStatus.CANCELLED, ScheduledVisitStatus.CANCELLED);
    }

    private void assertFinalTransitionRejected(ScheduledVisitStatus initialFinalStatus,
                                               ScheduledVisitStatus attemptedStatus) {
        ScheduledVisit visit = scheduledVisit();
        visit.registerOutcome(initialFinalStatus, 10L, INITIAL_OUTCOME_AT, "Registro original");

        SchedulingConflictException error = assertThrows(SchedulingConflictException.class,
                () -> visit.registerOutcome(attemptedStatus, 99L, ATTEMPTED_OUTCOME_AT, "Sobrescrita"));

        assertEquals("VISIT_OUTCOME_FINAL", error.getCode());
        assertEquals(initialFinalStatus, visit.getStatus());
        assertEquals(10L, visit.getOutcomeByUserId());
        assertEquals(INITIAL_OUTCOME_AT, visit.getOutcomeAt());
        assertEquals("Registro original", visit.getOutcomeNote());
    }

    private ScheduledVisit scheduledVisit() {
        return new ScheduledVisit(2L, 3L, 4L, SCHEDULED_AT, 6L, CREATED_AT);
    }
}
