package clinicalstudypb.scheduling;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import clinicalstudypb.participants.application.ParticipantSchedulingLookup;
import clinicalstudypb.participants.application.ParticipantSchedulingView;
import clinicalstudypb.scheduling.application.ScheduledVisitResult;
import clinicalstudypb.scheduling.application.ScheduledVisitService;
import clinicalstudypb.scheduling.domain.InvalidScheduledVisitException;
import clinicalstudypb.scheduling.domain.ScheduledVisit;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import clinicalstudypb.scheduling.domain.SchedulingConflictException;
import clinicalstudypb.scheduling.domain.VisitOutcome;
import clinicalstudypb.scheduling.infrastructure.ScheduledVisitRepository;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.visits.application.PlannedVisitLookup;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Exercita limites temporais e rejeições do agendamento sem banco.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
@ExtendWith(MockitoExtension.class)
class ScheduledVisitServiceTest {

    private static final Long STUDY_ID = 2L;
    private static final Long PARTICIPANT_ID = 3L;
    private static final Long PLANNED_VISIT_ID = 4L;
    private static final Instant NOW = Instant.parse("2026-11-13T12:00:00Z");

    @Mock
    private ScheduledVisitRepository repository;

    @Mock
    private StudyService studyService;

    @Mock
    private ParticipantSchedulingLookup participants;

    @Mock
    private PlannedVisitLookup plannedVisits;

    @Mock
    private CurrentActor actor;

    private ScheduledVisitService service;

    @BeforeEach
    void setUp() {
        service = new ScheduledVisitService(repository, studyService, participants,
                plannedVisits, actor, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void acceptsLastStudyDayInFortalezaEvenWhenInstantIsNextUtcDay() {
        allowStudyAndParticipant(activeParticipant());
        when(plannedVisits.findNameByStudyAndId(STUDY_ID, PLANNED_VISIT_ID))
                .thenReturn(Optional.of("Visita final"));
        when(actor.userId()).thenReturn(7L);
        when(repository.saveAndFlush(any(ScheduledVisit.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ScheduledVisitResult result = service.schedule(STUDY_ID, PARTICIPANT_ID, PLANNED_VISIT_ID,
                Instant.parse("2027-07-01T01:00:00Z"));

        assertEquals(Instant.parse("2027-07-01T01:00:00Z"), result.visit().getScheduledAt());
        assertEquals(ScheduledVisitStatus.SCHEDULED, result.visit().getStatus());
    }

    @Test
    void rejectsInstantWhoseFortalezaDateIsAfterStudyEnd() {
        allowStudyAndParticipant(activeParticipant());
        when(plannedVisits.findNameByStudyAndId(STUDY_ID, PLANNED_VISIT_ID))
                .thenReturn(Optional.of("Visita final"));

        InvalidScheduledVisitException error = assertThrows(InvalidScheduledVisitException.class,
                () -> service.schedule(STUDY_ID, PARTICIPANT_ID, PLANNED_VISIT_ID,
                        Instant.parse("2027-07-01T03:00:00Z")));

        assertEquals("VISIT_DATE_OUTSIDE_STUDY_PERIOD", error.getCode());
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void rejectsVisitAtCurrentInstant() {
        allowStudyAndParticipant(activeParticipant());
        when(plannedVisits.findNameByStudyAndId(STUDY_ID, PLANNED_VISIT_ID))
                .thenReturn(Optional.of("Visita final"));

        InvalidScheduledVisitException error = assertThrows(InvalidScheduledVisitException.class,
                () -> service.schedule(STUDY_ID, PARTICIPANT_ID, PLANNED_VISIT_ID, NOW));

        assertEquals("VISIT_DATE_NOT_FUTURE", error.getCode());
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void rejectsWithdrawnParticipantBeforeCreatingVisit() {
        allowStudyAndParticipant(new ParticipantSchedulingView(
                PARTICIPANT_ID, STUDY_ID, "Pessoa teste", true));

        SchedulingConflictException error = assertThrows(SchedulingConflictException.class,
                () -> service.schedule(STUDY_ID, PARTICIPANT_ID, PLANNED_VISIT_ID,
                        Instant.parse("2027-06-01T12:00:00Z")));

        assertEquals("PARTICIPANT_WITHDRAWN", error.getCode());
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void rejectsAlreadyScheduledVisit() {
        allowStudyAndParticipant(activeParticipant());
        when(plannedVisits.findNameByStudyAndId(STUDY_ID, PLANNED_VISIT_ID))
                .thenReturn(Optional.of("Visita final"));
        when(repository.existsByParticipantIdAndPlannedVisitIdAndStatusIn(
                PARTICIPANT_ID, PLANNED_VISIT_ID,
                EnumSet.of(ScheduledVisitStatus.SCHEDULED, ScheduledVisitStatus.DONE)))
                .thenReturn(true);

        SchedulingConflictException error = assertThrows(SchedulingConflictException.class,
                () -> service.schedule(STUDY_ID, PARTICIPANT_ID, PLANNED_VISIT_ID,
                        Instant.parse("2027-06-01T12:00:00Z")));

        assertEquals("VISIT_ALREADY_SCHEDULED", error.getCode());
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void rejectsPlanningStudy() {
        Study study = study();
        when(studyService.lockForScheduling(STUDY_ID)).thenReturn(study);
        when(participants.lockForScheduling(STUDY_ID, PARTICIPANT_ID))
                .thenReturn(activeParticipant());

        SchedulingConflictException error = assertThrows(SchedulingConflictException.class,
                () -> service.schedule(STUDY_ID, PARTICIPANT_ID, PLANNED_VISIT_ID,
                        Instant.parse("2027-06-01T12:00:00Z")));

        assertEquals("STUDY_STATUS_DOES_NOT_ALLOW_SCHEDULING", error.getCode());
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void recordsFinalOutcomeWithNormalizedNoteAndAuthor() {
        ScheduledVisit visit = pendingVisit();
        allowOutcome(visit, StudyStatus.EXECUTION);
        when(actor.userId()).thenReturn(7L);
        when(repository.saveAndFlush(visit)).thenReturn(visit);
        when(plannedVisits.findNameByStudyAndId(STUDY_ID, PLANNED_VISIT_ID))
                .thenReturn(Optional.of("Visita final"));

        ScheduledVisitResult result = service.recordOutcome(
                STUDY_ID, PARTICIPANT_ID, 8L, 0L, VisitOutcome.CANCELLED, "  Imprevisto  ");

        assertEquals(ScheduledVisitStatus.CANCELLED, result.visit().getStatus());
        assertEquals("Imprevisto", result.visit().getOutcomeNote());
        assertEquals(7L, result.visit().getOutcomeByUserId());
        assertEquals(NOW, result.visit().getOutcomeAt());
    }

    @Test
    void rejectsCancellationWithoutReasonBeforeSaving() {
        InvalidScheduledVisitException error = assertThrows(InvalidScheduledVisitException.class,
                () -> service.recordOutcome(STUDY_ID, PARTICIPANT_ID, 8L, 0L,
                        VisitOutcome.CANCELLED, "   "));

        assertEquals("CANCELLATION_REASON_REQUIRED", error.getCode());
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void checksVersionBeforeAlreadyFinalOutcome() {
        ScheduledVisit visit = pendingVisit();
        visit.registerOutcome(ScheduledVisitStatus.DONE, 7L, NOW, null);
        allowOutcome(visit, StudyStatus.EXECUTION);

        SchedulingConflictException outdated = assertThrows(SchedulingConflictException.class,
                () -> service.recordOutcome(STUDY_ID, PARTICIPANT_ID, 8L, 1L,
                        VisitOutcome.ABSENT, null));
        SchedulingConflictException finalOutcome = assertThrows(SchedulingConflictException.class,
                () -> service.recordOutcome(STUDY_ID, PARTICIPANT_ID, 8L, 0L,
                        VisitOutcome.ABSENT, null));

        assertEquals("VERSION_MISMATCH", outdated.getCode());
        assertEquals("VISIT_OUTCOME_FINAL", finalOutcome.getCode());
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void rejectsReadOnlyStudyBeforeCheckingVersion() {
        ScheduledVisit visit = pendingVisit();
        allowOutcome(visit, StudyStatus.CANCELLED);

        SchedulingConflictException error = assertThrows(SchedulingConflictException.class,
                () -> service.recordOutcome(STUDY_ID, PARTICIPANT_ID, 8L, 2L,
                        VisitOutcome.DONE, null));

        assertEquals("STUDY_READ_ONLY", error.getCode());
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void allowsOutcomeForWithdrawnParticipantStillHoldingPendingVisit() {
        ScheduledVisit visit = pendingVisit();
        Study study = mock(Study.class);
        when(study.getStatus()).thenReturn(StudyStatus.EXECUTION);
        when(studyService.lockForScheduling(STUDY_ID)).thenReturn(study);
        when(participants.lockForScheduling(STUDY_ID, PARTICIPANT_ID))
                .thenReturn(new ParticipantSchedulingView(PARTICIPANT_ID, STUDY_ID, "Pessoa teste", true));
        when(repository.findByIdAndStudyIdAndParticipantIdForUpdate(8L, STUDY_ID, PARTICIPANT_ID))
                .thenReturn(Optional.of(visit));
        when(actor.userId()).thenReturn(7L);
        when(repository.saveAndFlush(visit)).thenReturn(visit);

        ScheduledVisitResult result = service.recordOutcome(
                STUDY_ID, PARTICIPANT_ID, 8L, 0L, VisitOutcome.ABSENT, null);

        assertEquals(ScheduledVisitStatus.ABSENT, result.visit().getStatus());
    }

    private ScheduledVisit pendingVisit() {
        ScheduledVisit visit = new ScheduledVisit(STUDY_ID, PARTICIPANT_ID, PLANNED_VISIT_ID,
                Instant.parse("2027-06-01T12:00:00Z"), 6L, NOW);
        ReflectionTestUtils.setField(visit, "version", 0L);
        return visit;
    }

    private void allowOutcome(ScheduledVisit visit, StudyStatus status) {
        Study study = mock(Study.class);
        when(study.getStatus()).thenReturn(status);
        when(studyService.lockForScheduling(STUDY_ID)).thenReturn(study);
        when(participants.lockForScheduling(STUDY_ID, PARTICIPANT_ID)).thenReturn(activeParticipant());
        when(repository.findByIdAndStudyIdAndParticipantIdForUpdate(8L, STUDY_ID, PARTICIPANT_ID))
                .thenReturn(Optional.of(visit));
    }

    private void allowStudyAndParticipant(ParticipantSchedulingView participant) {
        Study study = study();
        study.advanceStatus(StudyStatus.RECRUITMENT);
        when(studyService.lockForScheduling(STUDY_ID)).thenReturn(study);
        when(participants.lockForScheduling(STUDY_ID, PARTICIPANT_ID)).thenReturn(participant);
    }

    private ParticipantSchedulingView activeParticipant() {
        return new ParticipantSchedulingView(PARTICIPANT_ID, STUDY_ID, "Pessoa teste", false);
    }

    private Study study() {
        return new Study("Estudo", "Objetivo", 5L,
                LocalDate.of(2027, 6, 1), LocalDate.of(2027, 6, 30), 10);
    }
}
