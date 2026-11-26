package clinicalstudypb.results;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import clinicalstudypb.results.api.ActivityResultResponse;
import clinicalstudypb.results.api.VisitResultsResponse;
import clinicalstudypb.results.application.ActivityResultService;
import clinicalstudypb.results.application.ActivityResultService.WriteResult;
import clinicalstudypb.results.domain.ActivityResult;
import clinicalstudypb.results.infrastructure.ActivityResultRepository;
import clinicalstudypb.results.infrastructure.NamedActivityResult;
import clinicalstudypb.scheduling.domain.ScheduledVisit;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import clinicalstudypb.scheduling.domain.SchedulingConflictException;
import clinicalstudypb.scheduling.infrastructure.ScheduledVisitRepository;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.visits.api.PlannedActivityResponse;
import clinicalstudypb.visits.api.PlannedVisitResponse;
import clinicalstudypb.visits.application.PlannedVisitLookup;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Exercita todas as regras de consulta, registro, substituição e bloqueio de RF14 sem banco.
 */
@ExtendWith(MockitoExtension.class)
class ActivityResultServiceTest {

    private static final Long STUDY_ID = 2L;
    private static final Long PARTICIPANT_ID = 3L;
    private static final Long PLANNED_VISIT_ID = 4L;
    private static final Long VISIT_ID = 8L;
    private static final Long FIRST_ACTIVITY_ID = 10L;
    private static final Long SECOND_ACTIVITY_ID = 20L;
    private static final Long RESEARCHER_ID = 7L;
    private static final Instant NOW_NANOS = Instant.parse("2026-11-20T14:30:45.123456789Z");
    private static final Instant NOW_MICROS = Instant.parse("2026-11-20T14:30:45.123456Z");

    @Mock
    private ActivityResultRepository results;

    @Mock
    private ScheduledVisitRepository visits;

    @Mock
    private PlannedVisitLookup plannedVisits;

    @Mock
    private StudyService studies;

    @Mock
    private CurrentActor actor;

    private ActivityResultService service;

    @BeforeEach
    void setUp() {
        service = new ActivityResultService(results, visits, plannedVisits, studies, actor,
                Clock.fixed(NOW_NANOS, ZoneOffset.UTC));
    }

    @Test
    void getListsAllProtocolActivitiesOrderedByPositionEvenForNonDoneVisit() {
        ScheduledVisit visit = visitWithStatus(ScheduledVisitStatus.ABSENT);
        PlannedVisitResponse planned = new PlannedVisitResponse(
                PLANNED_VISIT_ID, STUDY_ID, "Visita clínica", LocalDate.of(2027, 6, 1), 1,
                List.of(
                        new PlannedActivityResponse(SECOND_ACTIVITY_ID, "Peso", "Medir peso", 2),
                        new PlannedActivityResponse(FIRST_ACTIVITY_ID, "Pressão", "Medir PA", 1)));
        ActivityResult recorded = new ActivityResult(
                VISIT_ID, FIRST_ACTIVITY_ID, "120x80 mmHg", "Em repouso", RESEARCHER_ID, NOW_MICROS);
        when(visits.findByIdAndStudyIdAndParticipantId(VISIT_ID, STUDY_ID, PARTICIPANT_ID))
                .thenReturn(Optional.of(visit));
        when(plannedVisits.findByStudyAndId(STUDY_ID, PLANNED_VISIT_ID)).thenReturn(Optional.of(planned));
        when(results.findByVisitId(VISIT_ID)).thenReturn(List.of(new NamedActivityResult(recorded, "Pressão")));

        VisitResultsResponse response = service.get(STUDY_ID, PARTICIPANT_ID, VISIT_ID);

        assertEquals(VISIT_ID, response.visitId());
        assertEquals(PLANNED_VISIT_ID, response.plannedVisitId());
        assertEquals("Visita clínica", response.plannedVisitName());
        assertEquals(ScheduledVisitStatus.ABSENT, response.status());
        assertEquals(2, response.activities().size());
        assertEquals(FIRST_ACTIVITY_ID, response.activities().get(0).activityId());
        assertEquals("Pressão", response.activities().get(0).result().activityName());
        assertEquals("120x80 mmHg", response.activities().get(0).result().value());
        assertEquals(SECOND_ACTIVITY_ID, response.activities().get(1).activityId());
        assertNull(response.activities().get(1).result());
        verify(studies).getStudy(STUDY_ID);
    }

    @Test
    void getRejectsUnknownStudyWithoutQueryingVisitsOrResults() {
        when(studies.getStudy(STUDY_ID)).thenThrow(new ResourceNotFoundException("Estudo não encontrado."));

        assertThrows(ResourceNotFoundException.class,
                () -> service.get(STUDY_ID, PARTICIPANT_ID, VISIT_ID));

        verifyNoInteractions(visits, plannedVisits, results);
    }

    @Test
    void getRejectsVisitOutsideStudyOrParticipantScope() {
        when(visits.findByIdAndStudyIdAndParticipantId(VISIT_ID, STUDY_ID, PARTICIPANT_ID))
                .thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.get(STUDY_ID, PARTICIPANT_ID, VISIT_ID));

        verifyNoInteractions(plannedVisits, results);
    }

    @Test
    void getRejectsWhenPlannedVisitIsMissing() {
        when(visits.findByIdAndStudyIdAndParticipantId(VISIT_ID, STUDY_ID, PARTICIPANT_ID))
                .thenReturn(Optional.of(visitWithStatus(ScheduledVisitStatus.DONE)));
        when(plannedVisits.findByStudyAndId(STUDY_ID, PLANNED_VISIT_ID)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.get(STUDY_ID, PARTICIPANT_ID, VISIT_ID));

        verifyNoInteractions(results);
    }

    @Test
    void putCreatesResultTrimmingFieldsRecordingActorAndTruncatingInstant() {
        prepareWritablePut(StudyStatus.EXECUTION, ScheduledVisitStatus.DONE);
        when(results.findByVisitIdAndActivityId(VISIT_ID, FIRST_ACTIVITY_ID)).thenReturn(Optional.empty());
        when(actor.userId()).thenReturn(RESEARCHER_ID);
        when(results.saveAndFlush(any(ActivityResult.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WriteResult written = service.put(
                STUDY_ID, PARTICIPANT_ID, VISIT_ID, FIRST_ACTIVITY_ID, "  120x80 mmHg  ", "  Repouso  ");

        assertTrue(written.created());
        assertEquals(VISIT_ID, written.result().visitId());
        assertEquals(FIRST_ACTIVITY_ID, written.result().activityId());
        assertEquals("Pressão", written.result().activityName());
        assertEquals("120x80 mmHg", written.result().value());
        assertEquals("Repouso", written.result().note());
        assertEquals(RESEARCHER_ID, written.result().recordedByUserId());
        assertEquals(NOW_MICROS, written.result().recordedAt());
        verify(studies).requireResponsible(any(Study.class));
    }

    @Test
    void putCreatesResultWithNullNoteWhenNoteIsBlank() {
        prepareWritablePut(StudyStatus.RECRUITMENT, ScheduledVisitStatus.DONE);
        when(results.findByVisitIdAndActivityId(VISIT_ID, FIRST_ACTIVITY_ID)).thenReturn(Optional.empty());
        when(actor.userId()).thenReturn(RESEARCHER_ID);
        when(results.saveAndFlush(any(ActivityResult.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WriteResult written = service.put(
                STUDY_ID, PARTICIPANT_ID, VISIT_ID, FIRST_ACTIVITY_ID, "70 bpm", "   ");

        assertTrue(written.created());
        assertEquals("70 bpm", written.result().value());
        assertNull(written.result().note());
    }

    @Test
    void putReplacesExistingResultUpdatingAuthorInstantAndClearingOmittedNote() {
        prepareWritablePut(StudyStatus.EXECUTION, ScheduledVisitStatus.DONE);
        Instant previousInstant = Instant.parse("2026-11-19T10:00:00Z");
        ActivityResult existing = new ActivityResult(
                VISIT_ID, FIRST_ACTIVITY_ID, "110x70 mmHg", "Observação antiga", 5L, previousInstant);
        when(results.findByVisitIdAndActivityId(VISIT_ID, FIRST_ACTIVITY_ID)).thenReturn(Optional.of(existing));
        when(actor.userId()).thenReturn(9L);
        when(results.saveAndFlush(existing)).thenReturn(existing);

        WriteResult written = service.put(
                STUDY_ID, PARTICIPANT_ID, VISIT_ID, FIRST_ACTIVITY_ID, "  128x82 mmHg ", null);

        assertFalse(written.created());
        assertEquals("128x82 mmHg", written.result().value());
        assertNull(written.result().note());
        assertEquals(9L, written.result().recordedByUserId());
        assertEquals(NOW_MICROS, written.result().recordedAt());
        verify(results).saveAndFlush(existing);
    }

    @Test
    void putRejectsNonResponsibleResearcherBeforeLoadingVisitOrResults() {
        Study study = studyInStatus(StudyStatus.EXECUTION);
        when(studies.lockForScheduling(STUDY_ID)).thenReturn(study);
        doThrow(new AccessDeniedException("Somente o pesquisador responsável pode alterar este estudo."))
                .when(studies).requireResponsible(study);

        assertThrows(AccessDeniedException.class, () -> service.put(
                STUDY_ID, PARTICIPANT_ID, VISIT_ID, FIRST_ACTIVITY_ID, "120x80 mmHg", null));

        verifyNoInteractions(visits, plannedVisits, results);
    }

    @Test
    void putRejectsVisitMissingFromStudyAndParticipantScope() {
        when(studies.lockForScheduling(STUDY_ID)).thenReturn(studyInStatus(StudyStatus.EXECUTION));
        when(visits.findByIdAndStudyIdAndParticipantIdForUpdate(VISIT_ID, STUDY_ID, PARTICIPANT_ID))
                .thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.put(
                STUDY_ID, PARTICIPANT_ID, VISIT_ID, FIRST_ACTIVITY_ID, "120x80 mmHg", null));

        verifyNoInteractions(plannedVisits, results);
    }

    @Test
    void putRejectsWhenPlannedVisitCannotBeLoaded() {
        when(studies.lockForScheduling(STUDY_ID)).thenReturn(studyInStatus(StudyStatus.EXECUTION));
        when(visits.findByIdAndStudyIdAndParticipantIdForUpdate(VISIT_ID, STUDY_ID, PARTICIPANT_ID))
                .thenReturn(Optional.of(visitWithStatus(ScheduledVisitStatus.DONE)));
        when(plannedVisits.findByStudyAndId(STUDY_ID, PLANNED_VISIT_ID)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.put(
                STUDY_ID, PARTICIPANT_ID, VISIT_ID, FIRST_ACTIVITY_ID, "120x80 mmHg", null));

        verifyNoInteractions(results);
    }

    @Test
    void putRejectsActivityNotBelongingToScheduledVisitProtocol() {
        prepareWritablePut(StudyStatus.EXECUTION, ScheduledVisitStatus.DONE);

        assertThrows(ResourceNotFoundException.class, () -> service.put(
                STUDY_ID, PARTICIPANT_ID, VISIT_ID, 999L, "120x80 mmHg", null));

        verify(results, never()).saveAndFlush(any());
    }

    @ParameterizedTest
    @EnumSource(value = StudyStatus.class, names = {"CLOSED", "CANCELLED"})
    void putRejectsReadOnlyStudiesEvenForDoneVisit(StudyStatus readOnlyStatus) {
        prepareWritablePut(readOnlyStatus, ScheduledVisitStatus.DONE);

        SchedulingConflictException error = assertThrows(SchedulingConflictException.class, () -> service.put(
                STUDY_ID, PARTICIPANT_ID, VISIT_ID, FIRST_ACTIVITY_ID, "120x80 mmHg", null));

        assertEquals("STUDY_READ_ONLY", error.getCode());
        verify(results, never()).saveAndFlush(any());
    }

    @ParameterizedTest
    @EnumSource(value = ScheduledVisitStatus.class, names = {"SCHEDULED", "ABSENT", "CANCELLED"})
    void putRejectsNonDoneVisitsWithVisitNotDoneConflict(ScheduledVisitStatus visitStatus) {
        prepareWritablePut(StudyStatus.EXECUTION, visitStatus);

        SchedulingConflictException error = assertThrows(SchedulingConflictException.class, () -> service.put(
                STUDY_ID, PARTICIPANT_ID, VISIT_ID, FIRST_ACTIVITY_ID, "120x80 mmHg", null));

        assertEquals("VISIT_NOT_DONE", error.getCode());
        verify(results, never()).saveAndFlush(any());
    }

    @Test
    void findByVisitIdMapsPersistedResults() {
        ActivityResult first = new ActivityResult(
                VISIT_ID, FIRST_ACTIVITY_ID, "120x80 mmHg", null, RESEARCHER_ID, NOW_MICROS);
        when(results.findByVisitId(VISIT_ID)).thenReturn(List.of(new NamedActivityResult(first, "Pressão")));

        List<ActivityResultResponse> mapped = service.findByVisitId(VISIT_ID);

        assertEquals(1, mapped.size());
        assertEquals(FIRST_ACTIVITY_ID, mapped.get(0).activityId());
        assertEquals("Pressão", mapped.get(0).activityName());
        assertEquals("120x80 mmHg", mapped.get(0).value());
    }

    @Test
    void findByVisitIdsReturnsEmptyMapWithoutQueryingWhenCollectionIsEmpty() {
        Map<Long, List<ActivityResultResponse>> grouped = service.findByVisitIds(List.of());

        assertTrue(grouped.isEmpty());
        verifyNoInteractions(results);
    }

    @Test
    void findByVisitIdsGroupsByVisitPreservingRepositoryOrder() {
        ActivityResult visit9Act1 = new ActivityResult(
                9L, FIRST_ACTIVITY_ID, "118x76 mmHg", null, RESEARCHER_ID, NOW_MICROS);
        ActivityResult visit9Act2 = new ActivityResult(
                9L, SECOND_ACTIVITY_ID, "68 kg", "Jejum", RESEARCHER_ID, NOW_MICROS);
        ActivityResult visit8Act1 = new ActivityResult(
                VISIT_ID, FIRST_ACTIVITY_ID, "120x80 mmHg", null, RESEARCHER_ID, NOW_MICROS);
        when(results.findByVisitIdIn(List.of(9L, VISIT_ID)))
                .thenReturn(List.of(
                        new NamedActivityResult(visit9Act1, "Pressão"),
                        new NamedActivityResult(visit9Act2, "Peso"),
                        new NamedActivityResult(visit8Act1, "Pressão")));

        Map<Long, List<ActivityResultResponse>> grouped = service.findByVisitIds(List.of(9L, VISIT_ID));

        assertEquals(List.of(9L, VISIT_ID), List.copyOf(grouped.keySet()));
        assertEquals(2, grouped.get(9L).size());
        assertEquals(FIRST_ACTIVITY_ID, grouped.get(9L).get(0).activityId());
        assertEquals("Pressão", grouped.get(9L).get(0).activityName());
        assertEquals(SECOND_ACTIVITY_ID, grouped.get(9L).get(1).activityId());
        assertEquals("Peso", grouped.get(9L).get(1).activityName());
        assertEquals(1, grouped.get(VISIT_ID).size());
        assertEquals("Pressão", grouped.get(VISIT_ID).get(0).activityName());
        assertEquals("120x80 mmHg", grouped.get(VISIT_ID).get(0).value());
    }

    private void prepareWritablePut(StudyStatus studyStatus, ScheduledVisitStatus visitStatus) {
        when(studies.lockForScheduling(STUDY_ID)).thenReturn(studyInStatus(studyStatus));
        when(visits.findByIdAndStudyIdAndParticipantIdForUpdate(VISIT_ID, STUDY_ID, PARTICIPANT_ID))
                .thenReturn(Optional.of(visitWithStatus(visitStatus)));
        when(plannedVisits.findByStudyAndId(STUDY_ID, PLANNED_VISIT_ID)).thenReturn(Optional.of(plannedVisit()));
    }

    private Study studyInStatus(StudyStatus status) {
        Study study = new Study("Estudo clínico", "Avaliar RF14", RESEARCHER_ID,
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 10);
        ReflectionTestUtils.setField(study, "status", status);
        return study;
    }

    private ScheduledVisit visitWithStatus(ScheduledVisitStatus status) {
        ScheduledVisit visit = new ScheduledVisit(STUDY_ID, PARTICIPANT_ID, PLANNED_VISIT_ID,
                Instant.parse("2027-06-01T12:00:00Z"), 6L, NOW_MICROS);
        if (status != ScheduledVisitStatus.SCHEDULED) {
            visit.registerOutcome(status, 6L, NOW_MICROS, status == ScheduledVisitStatus.CANCELLED ? "Motivo" : null);
        }
        return visit;
    }

    private PlannedVisitResponse plannedVisit() {
        return new PlannedVisitResponse(PLANNED_VISIT_ID, STUDY_ID, "Visita clínica",
                LocalDate.of(2027, 6, 1), 1,
                List.of(
                        new PlannedActivityResponse(FIRST_ACTIVITY_ID, "Pressão", "Medir PA", 1),
                        new PlannedActivityResponse(SECOND_ACTIVITY_ID, "Peso", "Medir peso", 2)));
    }
}
