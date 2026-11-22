package clinicalstudypb.me;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import clinicalstudypb.me.api.ParticipantStudyResponse;
import clinicalstudypb.me.api.ParticipantVisitResponse;
import clinicalstudypb.me.api.ParticipantVisitsResponse;
import clinicalstudypb.me.application.ParticipantSelfService;
import clinicalstudypb.me.application.ParticipantStudyView;
import clinicalstudypb.me.application.ParticipantVisitView;
import clinicalstudypb.me.application.ParticipantVisitsView;
import clinicalstudypb.participants.application.ParticipantQueryService;
import clinicalstudypb.participants.domain.Participant;
import clinicalstudypb.participants.domain.ParticipantStatus;
import clinicalstudypb.scheduling.application.ScheduledVisitService;
import clinicalstudypb.scheduling.domain.ScheduledVisit;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import clinicalstudypb.visits.api.PlannedActivityResponse;
import clinicalstudypb.visits.api.PlannedVisitResponse;
import clinicalstudypb.visits.application.PlannedVisitLookup;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Verifica, sem banco, a composição dos dados do participante autenticado (RF17 e RF18, T23.1):
 * conta vinda do token, separação e ordem das visitas, desempate pelo id e consultas únicas por
 * estudo e por responsável.
 *
 * @author Allan Guilherme
 * @since 2026-11-17
 * @version 0.0.1
 */
@ExtendWith(MockitoExtension.class)
class ParticipantSelfServiceTest {

    private static final Long ACCOUNT = 50L;
    private static final Instant INCLUDED = Instant.parse("2026-11-01T12:00:00Z");

    @Mock
    private CurrentActor currentActor;
    @Mock
    private ParticipantQueryService participantQueryService;
    @Mock
    private ScheduledVisitService scheduledVisitService;
    @Mock
    private StudyService studyService;
    @Mock
    private UserService userService;
    @Mock
    private PlannedVisitLookup plannedVisitLookup;

    private ParticipantSelfService service;

    @BeforeEach
    void setUp() {
        service = new ParticipantSelfService(currentActor, participantQueryService, scheduledVisitService,
                studyService, userService, plannedVisitLookup);
        when(currentActor.userId()).thenReturn(ACCOUNT);
    }

    @Test
    void studiesComeFromTokenAccountAndLookUpEachResponsibleOnce() {
        Participant inA = participant(1L, 10L);
        Participant inB = participant(2L, 20L);
        inB.withdraw("Mudou de cidade", INCLUDED.plusSeconds(60), 9L, 0);
        List<PlannedVisitResponse> studyAVisits = List.of(
                plannedVisit(100L, 10L, "Inicial", 1, List.of(
                        new PlannedActivityResponse(501L, "Triagem", "Dados iniciais", 1))),
                plannedVisit(101L, 10L, "Retorno", 2, List.of()));
        when(participantQueryService.listByAccount(ACCOUNT)).thenReturn(List.of(inB, inA));
        when(studyService.getStudy(10L)).thenReturn(study(10L, "Estudo A", 7L));
        when(studyService.getStudy(20L)).thenReturn(study(20L, "Estudo B", 7L));
        when(userService.getUser(7L)).thenReturn(new User("Paula", "paula@test.local", "hash", UserRole.RESEARCHER));
        when(plannedVisitLookup.findByStudy(10L)).thenReturn(studyAVisits);
        when(plannedVisitLookup.findByStudy(20L)).thenReturn(List.of());

        List<ParticipantStudyView> studies = service.listStudies();

        assertEquals(List.of(2L, 1L), studies.stream().map(view -> view.participant().getId()).toList());
        verify(userService, times(1)).getUser(7L);
        verify(plannedVisitLookup, times(1)).findByStudy(10L);
        verify(plannedVisitLookup, times(1)).findByStudy(20L);
        ParticipantStudyResponse withdrawn = ParticipantStudyResponse.from(studies.get(0));
        assertEquals(ParticipantStatus.WITHDRAWN, withdrawn.participationStatus());
        assertEquals(INCLUDED.plusSeconds(60), withdrawn.withdrawnAt());
        assertEquals("Paula", withdrawn.responsibleName());
        assertEquals("Estudo B", withdrawn.studyTitle());
        assertTrue(withdrawn.plannedVisits().isEmpty());
        ParticipantStudyResponse active = ParticipantStudyResponse.from(studies.get(1));
        assertNull(active.withdrawnAt());
        assertEquals(studyAVisits, active.plannedVisits());
    }

    @Test
    void studiesCachePlannedVisitsPerStudyAndNormalizeNullToEmptyList() {
        Participant first = participant(1L, 10L);
        Participant second = participant(2L, 10L);
        List<PlannedVisitResponse> visits = List.of(
                plannedVisit(100L, 10L, "Inicial", 1, List.of()),
                plannedVisit(101L, 10L, "Final", 2, List.of()));
        Study study = study(10L, "Estudo A", 7L);
        when(participantQueryService.listByAccount(ACCOUNT)).thenReturn(List.of(second, first));
        when(studyService.getStudy(10L)).thenReturn(study);
        when(userService.getUser(7L)).thenReturn(new User("Paula", "paula@test.local", "hash", UserRole.RESEARCHER));
        when(plannedVisitLookup.findByStudy(10L)).thenReturn(visits);

        List<ParticipantStudyView> result = service.listStudies();

        assertEquals(2, result.size());
        assertEquals(visits, result.get(0).plannedVisits());
        assertEquals(visits, result.get(1).plannedVisits());
        verify(studyService, times(1)).getStudy(10L);
        verify(plannedVisitLookup, times(1)).findByStudy(10L);

        ParticipantStudyResponse normalized = ParticipantStudyResponse.from(
                new ParticipantStudyView(first, study, "Paula", null));
        assertTrue(normalized.plannedVisits().isEmpty());
    }

    @Test
    void accountWithoutInclusionNeverQueriesVisitsOrStudies() {
        when(participantQueryService.listByAccount(ACCOUNT)).thenReturn(List.of());

        ParticipantVisitsView visits = service.listVisits();

        assertTrue(visits.upcoming().isEmpty());
        assertTrue(visits.history().isEmpty());
        assertTrue(service.listStudies().isEmpty());
        verifyNoInteractions(scheduledVisitService, studyService, userService, plannedVisitLookup);
    }

    @Test
    void visitsSplitScheduledFromOutcomesAndOrderHistoryMostRecentFirstWithIdTieBreak() {
        when(participantQueryService.listByAccount(ACCOUNT))
                .thenReturn(List.of(participant(1L, 10L), participant(2L, 20L)));
        ScheduledVisit soon = visit(31L, 10L, 1L, 100L, "2027-03-01T12:00:00Z", null);
        ScheduledVisit later = visit(32L, 10L, 1L, 101L, "2027-06-01T12:00:00Z", null);
        ScheduledVisit done = visit(33L, 10L, 1L, 102L, "2027-01-10T12:00:00Z", ScheduledVisitStatus.DONE);
        ScheduledVisit absent = visit(34L, 10L, 1L, 103L, "2027-01-20T12:00:00Z", ScheduledVisitStatus.ABSENT);
        ScheduledVisit cancelled = visit(35L, 20L, 2L, 200L, "2027-01-20T12:00:00Z",
                ScheduledVisitStatus.CANCELLED);
        when(scheduledVisitService.listByParticipants(List.of(1L, 2L)))
                .thenReturn(List.of(done, absent, cancelled, soon, later));
        when(studyService.getStudy(10L)).thenReturn(study(10L, "Estudo A", 7L));
        when(studyService.getStudy(20L)).thenReturn(study(20L, "Estudo B", 7L));
        when(plannedVisitLookup.findByStudy(10L)).thenReturn(List.of(
                plannedVisit(100L, 10L, "Retorno", 2, List.of(
                        new PlannedActivityResponse(501L, "Pressão", "Aferição", 1),
                        new PlannedActivityResponse(502L, "Questionário", "Hábitos", 2))),
                plannedVisit(102L, 10L, "Inicial", 1, List.of())));
        when(plannedVisitLookup.findByStudy(20L)).thenReturn(List.of(
                plannedVisit(200L, 20L, "Inicial B", 1, List.of())));

        ParticipantVisitsView visits = service.listVisits();

        assertEquals(List.of(31L, 32L), ids(visits.upcoming()));
        assertEquals(List.of(35L, 34L, 33L), ids(visits.history()));
        assertEquals("Retorno", visits.upcoming().get(0).plannedVisitName());
        assertEquals(List.of("Pressão", "Questionário"),
                visits.upcoming().get(0).activities().stream().map(PlannedActivityResponse::name).toList());
        assertEquals("", visits.upcoming().get(1).plannedVisitName());
        assertTrue(visits.upcoming().get(1).activities().isEmpty());
        assertEquals("Estudo B", visits.history().get(0).studyTitle());
        assertTrue(visits.history().get(2).activities().isEmpty());
        verify(studyService, times(1)).getStudy(10L);
        verify(plannedVisitLookup, times(1)).findByStudy(10L);
        verify(plannedVisitLookup, times(1)).findByStudy(20L);
    }

    @Test
    void responseShowsCancellationReasonOnlyForCancelledVisitsAndHidesStaffNotes() {
        when(participantQueryService.listByAccount(ACCOUNT)).thenReturn(List.of(participant(1L, 10L)));
        ScheduledVisit done = visit(33L, 10L, 1L, 100L, "2027-01-10T12:00:00Z", ScheduledVisitStatus.DONE);
        ScheduledVisit cancelled = visit(35L, 10L, 1L, 101L, "2027-01-20T12:00:00Z",
                ScheduledVisitStatus.CANCELLED);
        ScheduledVisit scheduled = visit(36L, 10L, 1L, 102L, "2027-06-01T12:00:00Z", null);
        when(scheduledVisitService.listByParticipants(List.of(1L))).thenReturn(List.of(done, cancelled, scheduled));
        when(studyService.getStudy(10L)).thenReturn(study(10L, "Estudo A", 7L));
        when(plannedVisitLookup.findByStudy(10L)).thenReturn(List.of(
                plannedVisit(102L, 10L, "Final", 1, List.of(
                        new PlannedActivityResponse(601L, "Exame", "Coleta final", 1)))));

        ParticipantVisitsResponse response = ParticipantVisitsResponse.from(service.listVisits());

        ParticipantVisitResponse cancelledResponse = response.history().get(0);
        ParticipantVisitResponse doneResponse = response.history().get(1);
        ParticipantVisitResponse scheduledResponse = response.upcoming().get(0);
        assertEquals("Nota CANCELLED", cancelledResponse.cancellationReason());
        assertNull(doneResponse.cancellationReason());
        assertTrue(doneResponse.activities().isEmpty());
        assertEquals(Instant.parse("2027-01-30T12:00:00Z"), doneResponse.outcomeAt());
        assertNull(scheduledResponse.outcomeAt());
        assertNull(scheduledResponse.cancellationReason());
        assertSame(ScheduledVisitStatus.SCHEDULED, scheduledResponse.status());
        assertEquals("Estudo A", scheduledResponse.studyTitle());
        assertEquals(List.of("Exame"),
                scheduledResponse.activities().stream().map(PlannedActivityResponse::name).toList());

        ParticipantVisitView nullActivitiesView = new ParticipantVisitView(scheduled, "Estudo A", "Final", null);
        assertTrue(nullActivitiesView.activities().isEmpty());
        assertTrue(ParticipantVisitResponse.from(nullActivitiesView).activities().isEmpty());
    }

    private static List<Long> ids(List<ParticipantVisitView> views) {
        return views.stream().map(view -> view.visit().getId()).toList();
    }

    private static Participant participant(Long id, Long studyId) {
        Participant participant = new Participant(studyId, id + 100, 9L, INCLUDED);
        ReflectionTestUtils.setField(participant, "id", id);
        return participant;
    }

    private static Study study(Long id, String title, Long responsibleUserId) {
        Study study = new Study(title, "Objetivo", responsibleUserId,
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 10);
        ReflectionTestUtils.setField(study, "id", id);
        return study;
    }

    private static ScheduledVisit visit(Long id, Long studyId, Long participantId, Long plannedVisitId,
                                        String scheduledAt, ScheduledVisitStatus outcome) {
        ScheduledVisit visit = new ScheduledVisit(studyId, participantId, plannedVisitId,
                Instant.parse(scheduledAt), 9L, INCLUDED);
        ReflectionTestUtils.setField(visit, "id", id);
        if (outcome != null) {
            visit.registerOutcome(outcome, 9L, Instant.parse("2027-01-30T12:00:00Z"), "Nota " + outcome.name());
        }
        return visit;
    }

    private static PlannedVisitResponse plannedVisit(Long id, Long studyId, String name, int position,
                                                     List<PlannedActivityResponse> activities) {
        return new PlannedVisitResponse(id, studyId, name, LocalDate.of(2027, 6, 1), position, activities);
    }
}
