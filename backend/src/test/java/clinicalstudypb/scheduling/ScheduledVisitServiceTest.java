package clinicalstudypb.scheduling;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
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
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.visits.application.PlannedVisitLookup;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Exercita limites temporais, partições de equivalência e consultas do agendamento sem banco.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.2
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
    void scheduledToDoneNormalizesBlankNoteToNullAndFallsBackToEmptyVisitName() {
        ScheduledVisit visit = pendingVisit();
        allowOutcome(visit, StudyStatus.EXECUTION);
        when(actor.userId()).thenReturn(7L);
        when(repository.saveAndFlush(visit)).thenReturn(visit);
        when(plannedVisits.findNameByStudyAndId(STUDY_ID, PLANNED_VISIT_ID)).thenReturn(Optional.empty());

        ScheduledVisitResult result = service.recordOutcome(
                STUDY_ID, PARTICIPANT_ID, 8L, 0L, VisitOutcome.DONE, "   ");

        assertEquals(ScheduledVisitStatus.DONE, result.visit().getStatus());
        assertNull(result.visit().getOutcomeNote());
        assertEquals(7L, result.visit().getOutcomeByUserId());
        assertEquals(NOW, result.visit().getOutcomeAt());
        assertEquals("", result.plannedVisitName());
    }

    @Test
    void scheduledToDoneAcceptsRecruitmentStudyAndStripsNote() {
        ScheduledVisit visit = pendingVisit();
        allowOutcome(visit, StudyStatus.RECRUITMENT);
        when(actor.userId()).thenReturn(7L);
        when(repository.saveAndFlush(visit)).thenReturn(visit);
        when(plannedVisits.findNameByStudyAndId(STUDY_ID, PLANNED_VISIT_ID))
                .thenReturn(Optional.of("Visita inicial"));

        ScheduledVisitResult result = service.recordOutcome(
                STUDY_ID, PARTICIPANT_ID, 8L, 0L, VisitOutcome.DONE, "  Sem intercorrências  ");

        assertEquals(ScheduledVisitStatus.DONE, result.visit().getStatus());
        assertEquals("Sem intercorrências", result.visit().getOutcomeNote());
        assertEquals("Visita inicial", result.plannedVisitName());
    }

    @Test
    void scheduledToAbsentRecordsAuthorAndInstantWithoutNote() {
        ScheduledVisit visit = pendingVisit();
        allowOutcome(visit, StudyStatus.EXECUTION);
        when(actor.userId()).thenReturn(7L);
        when(repository.saveAndFlush(visit)).thenReturn(visit);
        when(plannedVisits.findNameByStudyAndId(STUDY_ID, PLANNED_VISIT_ID))
                .thenReturn(Optional.of("Visita intermediária"));

        ScheduledVisitResult result = service.recordOutcome(
                STUDY_ID, PARTICIPANT_ID, 8L, 0L, VisitOutcome.ABSENT, null);

        assertEquals(ScheduledVisitStatus.ABSENT, result.visit().getStatus());
        assertNull(result.visit().getOutcomeNote());
        assertEquals(7L, result.visit().getOutcomeByUserId());
        assertEquals(NOW, result.visit().getOutcomeAt());
    }

    @Test
    void scheduledToCancelledAccepts500CharacterBoundaryNote() {
        ScheduledVisit visit = pendingVisit();
        allowOutcome(visit, StudyStatus.EXECUTION);
        when(actor.userId()).thenReturn(7L);
        when(repository.saveAndFlush(visit)).thenReturn(visit);
        when(plannedVisits.findNameByStudyAndId(STUDY_ID, PLANNED_VISIT_ID))
                .thenReturn(Optional.of("Visita final"));
        String exactBoundary = "a".repeat(500);

        ScheduledVisitResult result = service.recordOutcome(
                STUDY_ID, PARTICIPANT_ID, 8L, 0L, VisitOutcome.CANCELLED, "  " + exactBoundary + "  ");

        assertEquals(ScheduledVisitStatus.CANCELLED, result.visit().getStatus());
        assertEquals(exactBoundary, result.visit().getOutcomeNote());
    }

    @Test
    void rejectsNullOutcomeBeforeLockingStudy() {
        InvalidScheduledVisitException error = assertThrows(InvalidScheduledVisitException.class,
                () -> service.recordOutcome(STUDY_ID, PARTICIPANT_ID, 8L, 0L, null, "Observação"));

        assertEquals("INVALID_VISIT_OUTCOME", error.getCode());
        verifyNoInteractions(studyService, participants, repository);
    }

    @Test
    void rejectsOutcomeNoteLongerThan500CharactersBeforeLockingStudy() {
        InvalidScheduledVisitException error = assertThrows(InvalidScheduledVisitException.class,
                () -> service.recordOutcome(STUDY_ID, PARTICIPANT_ID, 8L, 0L,
                        VisitOutcome.DONE, "a".repeat(501)));

        assertEquals("INVALID_OUTCOME_NOTE", error.getCode());
        verifyNoInteractions(studyService, participants, repository);
    }

    @Test
    void rejectsOutcomeWhenScheduledVisitNotFoundInScope() {
        Study study = mock(Study.class);
        when(studyService.lockForScheduling(STUDY_ID)).thenReturn(study);
        when(participants.lockForScheduling(STUDY_ID, PARTICIPANT_ID)).thenReturn(activeParticipant());
        when(repository.findByIdAndStudyIdAndParticipantIdForUpdate(8L, STUDY_ID, PARTICIPANT_ID))
                .thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.recordOutcome(STUDY_ID, PARTICIPANT_ID, 8L, 0L, VisitOutcome.DONE, null));
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void rejectsNullExpectedVersionWithVersionMismatch() {
        ScheduledVisit visit = pendingVisit();
        allowOutcome(visit, StudyStatus.EXECUTION);

        SchedulingConflictException error = assertThrows(SchedulingConflictException.class,
                () -> service.recordOutcome(STUDY_ID, PARTICIPANT_ID, 8L, null, VisitOutcome.DONE, null));

        assertEquals("VERSION_MISMATCH", error.getCode());
        verify(repository, never()).saveAndFlush(any());
    }

    @ParameterizedTest
    @EnumSource(value = StudyStatus.class, names = {"CLOSED", "CANCELLED"})
    void rejectsReadOnlyStudyBeforeCheckingVersion(StudyStatus status) {
        ScheduledVisit visit = pendingVisit();
        allowOutcome(visit, status);

        SchedulingConflictException error = assertThrows(SchedulingConflictException.class,
                () -> service.recordOutcome(STUDY_ID, PARTICIPANT_ID, 8L, 2L,
                        VisitOutcome.DONE, null));

        assertEquals("STUDY_READ_ONLY", error.getCode());
        verify(repository, never()).saveAndFlush(any());
    }

    @ParameterizedTest(name = "{0} -> {1}")
    @MethodSource("invalidFinalOutcomeTransitions")
    void rejectsTransitionFromAnyFinalStatusWithoutModifyingVisit(
            ScheduledVisitStatus initialFinalStatus,
            VisitOutcome attemptedOutcome) {
        ScheduledVisit visit = pendingVisit();
        Instant initialAt = NOW.minusSeconds(60);
        visit.registerOutcome(initialFinalStatus, 11L, initialAt, "Motivo inicial");
        allowOutcome(visit, StudyStatus.EXECUTION);
        String validNote = attemptedOutcome == VisitOutcome.CANCELLED ? "Nova justificativa" : "Nova nota";

        SchedulingConflictException error = assertThrows(SchedulingConflictException.class,
                () -> service.recordOutcome(STUDY_ID, PARTICIPANT_ID, 8L, 0L, attemptedOutcome, validNote));

        assertEquals("VISIT_OUTCOME_FINAL", error.getCode());
        assertEquals(initialFinalStatus, visit.getStatus());
        assertEquals(11L, visit.getOutcomeByUserId());
        assertEquals(initialAt, visit.getOutcomeAt());
        assertEquals("Motivo inicial", visit.getOutcomeNote());
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

    @Test
    void acceptsExecutionStudyAtStartDateMidnightFortalezaAndTruncatesSubMicros() {
        Study execution = studyInStatus(StudyStatus.EXECUTION);
        when(studyService.lockForScheduling(STUDY_ID)).thenReturn(execution);
        when(participants.lockForScheduling(STUDY_ID, PARTICIPANT_ID)).thenReturn(activeParticipant());
        when(plannedVisits.findNameByStudyAndId(STUDY_ID, PLANNED_VISIT_ID))
                .thenReturn(Optional.of("Visita inicial"));
        when(actor.userId()).thenReturn(7L);
        when(repository.saveAndFlush(any(ScheduledVisit.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ScheduledVisitResult result = service.schedule(STUDY_ID, PARTICIPANT_ID, PLANNED_VISIT_ID,
                Instant.parse("2027-06-01T03:00:00.000123999Z"));

        assertEquals(Instant.parse("2027-06-01T03:00:00.000123Z"), result.visit().getScheduledAt());
        assertEquals(ScheduledVisitStatus.SCHEDULED, result.visit().getStatus());
        assertEquals(7L, result.visit().getCreatedByUserId());
        assertEquals(NOW, result.visit().getCreatedAt());
    }

    @Test
    void rejectsInstantImmediatelyBeforeStartDateInFortaleza() {
        allowStudyAndParticipant(activeParticipant());
        when(plannedVisits.findNameByStudyAndId(STUDY_ID, PLANNED_VISIT_ID))
                .thenReturn(Optional.of("Visita inicial"));

        InvalidScheduledVisitException error = assertThrows(InvalidScheduledVisitException.class,
                () -> service.schedule(STUDY_ID, PARTICIPANT_ID, PLANNED_VISIT_ID,
                        Instant.parse("2027-06-01T02:59:59.999999Z")));

        assertEquals("VISIT_DATE_OUTSIDE_STUDY_PERIOD", error.getCode());
        verify(repository, never()).saveAndFlush(any());
    }

    @ParameterizedTest
    @MethodSource("nonFutureScheduledInstants")
    void rejectsNullOrSubMicrosecondFutureScheduledAt(Instant candidateInstant) {
        allowStudyAndParticipant(activeParticipant());
        when(plannedVisits.findNameByStudyAndId(STUDY_ID, PLANNED_VISIT_ID))
                .thenReturn(Optional.of("Visita inicial"));

        InvalidScheduledVisitException error = assertThrows(InvalidScheduledVisitException.class,
                () -> service.schedule(STUDY_ID, PARTICIPANT_ID, PLANNED_VISIT_ID, candidateInstant));

        assertEquals("VISIT_DATE_NOT_FUTURE", error.getCode());
        verify(repository, never()).saveAndFlush(any());
    }

    @ParameterizedTest
    @EnumSource(value = StudyStatus.class, names = {"CLOSED", "CANCELLED"})
    void rejectsClosedAndCancelledStudies(StudyStatus status) {
        when(studyService.lockForScheduling(STUDY_ID)).thenReturn(studyInStatus(status));
        when(participants.lockForScheduling(STUDY_ID, PARTICIPANT_ID)).thenReturn(activeParticipant());

        SchedulingConflictException error = assertThrows(SchedulingConflictException.class,
                () -> service.schedule(STUDY_ID, PARTICIPANT_ID, PLANNED_VISIT_ID,
                        Instant.parse("2027-06-10T12:00:00Z")));

        assertEquals("STUDY_STATUS_DOES_NOT_ALLOW_SCHEDULING", error.getCode());
        verify(plannedVisits, never()).findNameByStudyAndId(any(), any());
        verify(repository, never()).saveAndFlush(any());
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(longs = {99L})
    void rejectsMissingOrForeignPlannedVisit(Long invalidPlannedVisitId) {
        allowStudyAndParticipant(activeParticipant());
        if (invalidPlannedVisitId != null) {
            when(plannedVisits.findNameByStudyAndId(STUDY_ID, invalidPlannedVisitId))
                    .thenReturn(Optional.empty());
        }

        InvalidScheduledVisitException error = assertThrows(InvalidScheduledVisitException.class,
                () -> service.schedule(STUDY_ID, PARTICIPANT_ID, invalidPlannedVisitId,
                        Instant.parse("2027-06-10T12:00:00Z")));

        assertEquals("PLANNED_VISIT_NOT_IN_STUDY", error.getCode());
        if (invalidPlannedVisitId == null) {
            verifyNoInteractions(plannedVisits);
        }
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void translatesActiveUniqueConstraintViolationToConflict() {
        allowStudyAndParticipant(activeParticipant());
        when(plannedVisits.findNameByStudyAndId(STUDY_ID, PLANNED_VISIT_ID))
                .thenReturn(Optional.of("Visita inicial"));
        when(actor.userId()).thenReturn(7L);
        when(repository.existsByParticipantIdAndPlannedVisitIdAndStatusIn(
                PARTICIPANT_ID, PLANNED_VISIT_ID,
                EnumSet.of(ScheduledVisitStatus.SCHEDULED, ScheduledVisitStatus.DONE)))
                .thenReturn(false);
        when(repository.saveAndFlush(any(ScheduledVisit.class)))
                .thenThrow(new DataIntegrityViolationException("conflict",
                        new RuntimeException("duplicate key violates ux_scheduled_visit_active")));

        SchedulingConflictException error = assertThrows(SchedulingConflictException.class,
                () -> service.schedule(STUDY_ID, PARTICIPANT_ID, PLANNED_VISIT_ID,
                        Instant.parse("2027-06-10T12:00:00Z")));

        assertEquals("VISIT_ALREADY_SCHEDULED", error.getCode());
    }

    @Test
    void rethrowsUnrelatedDataIntegrityViolation() {
        allowStudyAndParticipant(activeParticipant());
        when(plannedVisits.findNameByStudyAndId(STUDY_ID, PLANNED_VISIT_ID))
                .thenReturn(Optional.of("Visita inicial"));
        when(actor.userId()).thenReturn(7L);
        DataIntegrityViolationException failure = new DataIntegrityViolationException("foreign_key_error");
        when(repository.saveAndFlush(any(ScheduledVisit.class))).thenThrow(failure);

        DataIntegrityViolationException thrown = assertThrows(DataIntegrityViolationException.class,
                () -> service.schedule(STUDY_ID, PARTICIPANT_ID, PLANNED_VISIT_ID,
                        Instant.parse("2027-06-10T12:00:00Z")));

        assertSame(failure, thrown);
    }

    @Test
    void getThrowsNotFoundWhenVisitDoesNotMatchStudyAndParticipant() {
        when(participants.getForScheduling(STUDY_ID, PARTICIPANT_ID)).thenReturn(activeParticipant());
        when(repository.findByIdAndStudyIdAndParticipantId(55L, STUDY_ID, PARTICIPANT_ID))
                .thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.get(STUDY_ID, PARTICIPANT_ID, 55L));
    }

    @Test
    void getFallsBackToEmptyPlannedVisitNameWhenProtocolVisitMissing() {
        ScheduledVisit visit = persistedVisit(55L);
        when(participants.getForScheduling(STUDY_ID, PARTICIPANT_ID)).thenReturn(activeParticipant());
        when(repository.findByIdAndStudyIdAndParticipantId(55L, STUDY_ID, PARTICIPANT_ID))
                .thenReturn(Optional.of(visit));
        when(plannedVisits.findNameByStudyAndId(STUDY_ID, PLANNED_VISIT_ID)).thenReturn(Optional.empty());

        ScheduledVisitResult result = service.get(STUDY_ID, PARTICIPANT_ID, 55L);

        assertEquals("Pessoa teste", result.participantName());
        assertEquals("", result.plannedVisitName());
    }

    @ParameterizedTest
    @ValueSource(longs = {0L, -1L})
    void listByStudyRejectsNonPositiveParticipantIdBoundary(Long invalidParticipantId) {
        InvalidScheduledVisitException error = assertThrows(InvalidScheduledVisitException.class,
                () -> service.listByStudy(STUDY_ID, null, invalidParticipantId));

        assertEquals("INVALID_PARTICIPANT_ID", error.getCode());
        verifyNoInteractions(studyService, participants, repository);
    }

    @ParameterizedTest
    @MethodSource("studyFilterPartitions")
    void listByStudyAppliesFilterPartitionsAndSkipsNameLookupWhenEmpty(
            ScheduledVisitStatus statusFilter,
            Long participantFilter) {
        if (participantFilter != null) {
            when(participants.getForScheduling(STUDY_ID, participantFilter))
                    .thenReturn(new ParticipantSchedulingView(participantFilter, STUDY_ID, "Pessoa teste", false));
        } else {
            when(studyService.getStudy(STUDY_ID)).thenReturn(study());
        }

        List<ScheduledVisitResult> results = service.listByStudy(STUDY_ID, statusFilter, participantFilter);

        assertTrue(results.isEmpty());
        verifyCorrectStudyFilterQuery(statusFilter, participantFilter);
        verifyNoInteractions(plannedVisits);
    }

    @Test
    void listByParticipantResolvesNamesWithFallbackWhenVisitsExist() {
        ScheduledVisit visit = persistedVisit(55L);
        when(participants.getForScheduling(STUDY_ID, PARTICIPANT_ID)).thenReturn(activeParticipant());
        when(repository.findByStudyIdAndParticipantIdOrderByScheduledAtAscIdAsc(STUDY_ID, PARTICIPANT_ID))
                .thenReturn(List.of(visit));
        when(plannedVisits.findNamesByStudy(STUDY_ID)).thenReturn(Map.of());

        List<ScheduledVisitResult> results = service.listByParticipant(STUDY_ID, PARTICIPANT_ID);

        assertEquals(1, results.size());
        assertEquals("Pessoa teste", results.get(0).participantName());
        assertEquals("", results.get(0).plannedVisitName());
    }

    @Test
    void listByStudyMapsParticipantAndPlannedVisitNames() {
        ScheduledVisit visit = persistedVisit(55L);
        when(studyService.getStudy(STUDY_ID)).thenReturn(study());
        when(repository.findByStudyIdOrderByScheduledAtAscIdAsc(STUDY_ID)).thenReturn(List.of(visit));
        when(participants.findNamesByStudy(STUDY_ID)).thenReturn(Map.of(PARTICIPANT_ID, "Pessoa teste"));
        when(plannedVisits.findNamesByStudy(STUDY_ID)).thenReturn(Map.of(PLANNED_VISIT_ID, "Visita 1"));

        List<ScheduledVisitResult> results = service.listByStudy(STUDY_ID, null, null);

        assertEquals(1, results.size());
        assertEquals("Pessoa teste", results.get(0).participantName());
        assertEquals("Visita 1", results.get(0).plannedVisitName());
    }

    private void verifyCorrectStudyFilterQuery(ScheduledVisitStatus statusFilter, Long participantFilter) {
        if (statusFilter != null && participantFilter != null) {
            verify(repository).findByStudyIdAndParticipantIdAndStatusOrderByScheduledAtAscIdAsc(
                    STUDY_ID, participantFilter, statusFilter);
        } else if (participantFilter != null) {
            verify(repository).findByStudyIdAndParticipantIdOrderByScheduledAtAscIdAsc(
                    STUDY_ID, participantFilter);
        } else if (statusFilter != null) {
            verify(repository).findByStudyIdAndStatusOrderByScheduledAtAscIdAsc(STUDY_ID, statusFilter);
        } else {
            verify(repository).findByStudyIdOrderByScheduledAtAscIdAsc(STUDY_ID);
        }
    }

    private static Stream<Instant> nonFutureScheduledInstants() {
        return Stream.of(null, NOW.plusNanos(999));
    }

    private static Stream<Arguments> studyFilterPartitions() {
        return Stream.of(
                Arguments.of(null, null),
                Arguments.of(ScheduledVisitStatus.SCHEDULED, null),
                Arguments.of(null, 1L),
                Arguments.of(ScheduledVisitStatus.DONE, 1L));
    }

    private static Stream<Arguments> invalidFinalOutcomeTransitions() {
        return Stream.of(
                ScheduledVisitStatus.DONE,
                ScheduledVisitStatus.ABSENT,
                ScheduledVisitStatus.CANCELLED)
                .flatMap(finalStatus -> Stream.of(VisitOutcome.values())
                        .map(attempted -> Arguments.of(finalStatus, attempted)));
    }

    private Study studyInStatus(StudyStatus status) {
        Study study = study();
        ReflectionTestUtils.setField(study, "status", status);
        return study;
    }

    private ScheduledVisit persistedVisit(Long id) {
        ScheduledVisit visit = new ScheduledVisit(STUDY_ID, PARTICIPANT_ID, PLANNED_VISIT_ID,
                Instant.parse("2027-06-10T12:00:00Z"), 7L, NOW);
        ReflectionTestUtils.setField(visit, "id", id);
        ReflectionTestUtils.setField(visit, "version", 0L);
        return visit;
    }
}
