package clinicalstudypb.me;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.oneOf;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.scheduling.application.ScheduledVisitService;
import clinicalstudypb.scheduling.domain.ScheduledVisit;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Verifica sobre PostgreSQL real as rotas do participante autenticado (RF17 e RF18, T23.1):
 * dois participantes no mesmo estudo só enxergam os próprios dados, participação retirada e
 * estudo cancelado continuam visíveis, a ordem das visitas segue o contrato e os perfis da
 * equipe recebem 403.
 *
 * @author Allan Guilherme
 * @since 2026-11-17
 * @version 0.0.1
 */
class ParticipantSelfIntegrationTest extends IntegrationTestSupport {

    private static final String STUDIES = "/api/me/studies";
    private static final String VISITS = "/api/me/visits";

    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private ScheduledVisitService scheduledVisitService;

    private User coordinator;
    private User researcher;
    private User bruno;
    private Long studyA;
    private Long studyB;
    private Long anaInA;
    private Long anaInB;
    private Long brunoInA;
    private Long anaDone;
    private Long anaAbsent;
    private Long anaOverdue;
    private Long anaFinal;
    private Long anaReturn;
    private Long anaCancelled;
    private Long anaCancelledByStudy;
    private Long brunoScheduled;
    private Long brunoDone;
    private String anaToken;
    private String brunoToken;
    private String carlaToken;

    @BeforeEach
    void prepare() throws Exception {
        researcher = saveUser("Paula Pesquisadora", "me.researcher@test.local", UserRole.RESEARCHER);
        coordinator = saveUser("Coordenadora", "me.coordinator@test.local", UserRole.COORDINATOR);
        User ana = saveUser("Ana Souza", "me.ana@clinicalstudypb.test", UserRole.PARTICIPANT);
        bruno = saveUser("Bruno Lima", "me.bruno@clinicalstudypb.test", UserRole.PARTICIPANT);
        User carla = saveUser("Carla Dias", "me.carla@clinicalstudypb.test", UserRole.PARTICIPANT);
        anaToken = tokenFor(ana.getEmail());
        brunoToken = tokenFor(bruno.getEmail());
        carlaToken = tokenFor(carla.getEmail());

        studyA = study("Estudo A", "Objetivo A", researcher, "EXECUTION");
        studyB = study("Estudo B", "Objetivo B", researcher, "CANCELLED");
        Long initial = plannedVisit(studyA, 1, "Inicial");
        plannedActivity(initial, 2, "Questionário", "Perguntas sobre hábitos");
        plannedActivity(initial, 1, "Triagem", "Aferição inicial");
        Long returnVisit = plannedVisit(studyA, 2, "Retorno");
        Long finalVisit = plannedVisit(studyA, 3, "Final");
        Long extra = plannedVisit(studyA, 4, "Extra");
        Long initialB = plannedVisit(studyB, 1, "Inicial B");

        anaInA = participant(studyA, candidate(studyA, ana), "2026-11-01T12:00:00Z");
        brunoInA = participant(studyA, candidate(studyA, bruno), "2026-11-02T12:00:00Z");
        anaInB = participant(studyB, candidate(studyB, ana), "2026-11-05T12:00:00Z");
        candidate(studyA, carla);
        jdbc.update("UPDATE participants SET status = 'WITHDRAWN', withdrawal_reason = 'Mudou de cidade', "
                + "withdrawn_at = ?, withdrawn_by_user_id = ?, withdrawal_cancelled_visit_count = 0 WHERE id = ?",
                ts("2026-11-06T12:00:00Z"), coordinator.getId(), anaInB);

        anaDone = visit(studyA, anaInA, initial, "2027-01-10T12:00:00Z", "DONE", "Pressão aferida");
        anaAbsent = visit(studyA, anaInA, returnVisit, "2027-01-20T12:00:00Z", "ABSENT", "Não compareceu");
        anaOverdue = visit(studyA, anaInA, returnVisit, "2026-10-01T12:00:00Z", "SCHEDULED", null);
        anaFinal = visit(studyA, anaInA, finalVisit, "2027-06-01T12:00:00Z", "SCHEDULED", null);
        anaReturn = visit(studyA, anaInA, extra, "2027-03-01T12:00:00Z", "SCHEDULED", null);
        anaCancelled = visit(studyA, anaInA, initial, "2027-01-20T12:00:00Z", "CANCELLED", "Pediu para remarcar");
        anaCancelledByStudy = visit(studyB, anaInB, initialB, "2027-02-15T12:00:00Z", "CANCELLED",
                "Cancelamento do estudo");
        brunoScheduled = visit(studyA, brunoInA, initial, "2027-03-01T12:00:00Z", "SCHEDULED", null);
        brunoDone = visit(studyA, brunoInA, returnVisit, "2027-01-10T12:00:00Z", "DONE", "Ok");
    }

    @Test
    void participantSeesOwnActiveAndWithdrawnStudiesMostRecentInclusionFirst() throws Exception {
        perform(STUDIES, anaToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].participantId").value(anaInB))
                .andExpect(jsonPath("$[0].studyId").value(studyB))
                .andExpect(jsonPath("$[0].studyTitle").value("Estudo B"))
                .andExpect(jsonPath("$[0].studyObjective").value("Objetivo B"))
                .andExpect(jsonPath("$[0].studyStatus").value("CANCELLED"))
                .andExpect(jsonPath("$[0].startDate").value("2027-01-01"))
                .andExpect(jsonPath("$[0].endDate").value("2027-12-31"))
                .andExpect(jsonPath("$[0].responsibleName").value("Paula Pesquisadora"))
                .andExpect(jsonPath("$[0].participationStatus").value("WITHDRAWN"))
                .andExpect(jsonPath("$[0].includedAt").value("2026-11-05T12:00:00Z"))
                .andExpect(jsonPath("$[0].withdrawnAt").value("2026-11-06T12:00:00Z"))
                .andExpect(jsonPath("$[0].withdrawalReason").doesNotExist())
                .andExpect(jsonPath("$[0].plannedVisits", hasSize(1)))
                .andExpect(jsonPath("$[0].plannedVisits[0].name").value("Inicial B"))
                .andExpect(jsonPath("$[0].plannedVisits[0].activities", empty()))
                .andExpect(jsonPath("$[1].participantId").value(anaInA))
                .andExpect(jsonPath("$[1].studyId").value(studyA))
                .andExpect(jsonPath("$[1].studyStatus").value("EXECUTION"))
                .andExpect(jsonPath("$[1].participationStatus").value("ACTIVE"))
                .andExpect(jsonPath("$[1].withdrawnAt").doesNotExist())
                .andExpect(jsonPath("$[1].plannedVisits[*].name")
                        .value(contains("Inicial", "Retorno", "Final", "Extra")))
                .andExpect(jsonPath("$[1].plannedVisits[0].plannedDate").value("2027-06-01"))
                .andExpect(jsonPath("$[1].plannedVisits[0].activities[*].name")
                        .value(contains("Triagem", "Questionário")));
    }

    @Test
    void studyWithoutPlannedVisitsReturnsEmptyArrayAndPreservesAccountIsolation() throws Exception {
        Long studyC = study("Estudo C", "Objetivo C", researcher, "RECRUITMENT");
        Long brunoInC = participant(studyC, candidate(studyC, bruno), "2026-11-08T12:00:00Z");

        perform(STUDIES, brunoToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].participantId").value(brunoInC))
                .andExpect(jsonPath("$[0].studyId").value(studyC))
                .andExpect(jsonPath("$[0].plannedVisits", empty()))
                .andExpect(jsonPath("$[1].participantId").value(brunoInA))
                .andExpect(jsonPath("$[1].studyId").value(studyA))
                .andExpect(jsonPath("$[1].plannedVisits[*].name")
                        .value(contains("Inicial", "Retorno", "Final", "Extra")))
                .andExpect(jsonPath("$[*].participantId").value(everyItem(oneOf(
                        brunoInC.intValue(), brunoInA.intValue()))));

        perform(STUDIES, anaToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[*].participantId").value(everyItem(oneOf(
                        anaInA.intValue(), anaInB.intValue()))));
    }

    @Test
    void upcomingVisitsComeSoonestFirstIncludingOverdueOnesWithoutOutcome() throws Exception {
        perform(VISITS, anaToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.upcoming[*].id").value(contains(
                        anaOverdue.intValue(), anaReturn.intValue(), anaFinal.intValue())))
                .andExpect(jsonPath("$.upcoming[*].status").value(everyItem(oneOf("SCHEDULED"))))
                .andExpect(jsonPath("$.upcoming[1].studyId").value(studyA))
                .andExpect(jsonPath("$.upcoming[1].studyTitle").value("Estudo A"))
                .andExpect(jsonPath("$.upcoming[1].participantId").value(anaInA))
                .andExpect(jsonPath("$.upcoming[1].plannedVisitName").value("Extra"))
                .andExpect(jsonPath("$.upcoming[1].scheduledAt").value("2027-03-01T12:00:00Z"))
                .andExpect(jsonPath("$.upcoming[1].outcomeAt").doesNotExist())
                .andExpect(jsonPath("$.upcoming[1].cancellationReason").doesNotExist())
                .andExpect(jsonPath("$.upcoming[1].activities", empty()));
    }

    @Test
    void historyHasDoneAbsentAndCancelledMostRecentFirstAcrossStudies() throws Exception {
        perform(VISITS, anaToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.history[*].id").value(contains(anaCancelledByStudy.intValue(),
                        anaCancelled.intValue(), anaAbsent.intValue(), anaDone.intValue())))
                .andExpect(jsonPath("$.history[*].status").value(
                        contains("CANCELLED", "CANCELLED", "ABSENT", "DONE")))
                .andExpect(jsonPath("$.history[0].studyId").value(studyB))
                .andExpect(jsonPath("$.history[0].participantId").value(anaInB))
                .andExpect(jsonPath("$.history[0].plannedVisitName").value("Inicial B"))
                .andExpect(jsonPath("$.history[0].cancellationReason").value("Cancelamento do estudo"))
                .andExpect(jsonPath("$.history[0].outcomeAt").value("2027-01-20T12:00:00Z"))
                .andExpect(jsonPath("$.history[0].activities", empty()))
                .andExpect(jsonPath("$.history[1].cancellationReason").value("Pediu para remarcar"))
                .andExpect(jsonPath("$.history[1].activities[*].name")
                        .value(contains("Triagem", "Questionário")))
                .andExpect(jsonPath("$.history[1].activities[0].description").value("Aferição inicial"))
                .andExpect(jsonPath("$.history[2].cancellationReason").doesNotExist())
                .andExpect(jsonPath("$.history[2].activities", empty()))
                .andExpect(jsonPath("$.history[3].cancellationReason").doesNotExist())
                .andExpect(jsonPath("$.history[3].outcomeAt").value("2027-01-20T12:00:00Z"))
                .andExpect(jsonPath("$.history[3].activities[*].name")
                        .value(contains("Triagem", "Questionário")))
                .andExpect(jsonPath("$.history[2].outcomeNote").doesNotExist())
                .andExpect(jsonPath("$.history[3].outcomeNote").doesNotExist());
    }

    @Test
    void twoParticipantsOfTheSameStudyNeverSeeEachOthersStudiesOrVisits() throws Exception {
        perform(STUDIES, brunoToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].participantId").value(brunoInA))
                .andExpect(jsonPath("$[0].studyId").value(studyA));
        perform(VISITS, brunoToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.upcoming[*].id").value(contains(brunoScheduled.intValue())))
                .andExpect(jsonPath("$.upcoming[0].activities[*].name")
                        .value(contains("Triagem", "Questionário")))
                .andExpect(jsonPath("$.history[*].id").value(contains(brunoDone.intValue())))
                .andExpect(jsonPath("$.history[0].activities", empty()));

        perform(STUDIES, anaToken)
                .andExpect(jsonPath("$[*].participantId").value(everyItem(oneOf(
                        anaInA.intValue(), anaInB.intValue()))));
        perform(VISITS, anaToken)
                .andExpect(jsonPath("$.upcoming[*].participantId").value(everyItem(oneOf(anaInA.intValue()))))
                .andExpect(jsonPath("$.history[*].participantId").value(everyItem(oneOf(
                        anaInA.intValue(), anaInB.intValue()))));
    }

    @Test
    void accountWithCandidacyButNoInclusionGetsEmptyLists() throws Exception {
        perform(STUDIES, carlaToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", empty()));
        perform(VISITS, carlaToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.upcoming", empty()))
                .andExpect(jsonPath("$.history", empty()));
    }

    @Test
    void visitQueryByParticipationsReturnsOnlyRequestedOnesAndNothingForEmptySet() {
        assertTrue(scheduledVisitService.listByParticipants(List.of()).isEmpty());
        assertEquals(List.of(brunoScheduled, brunoDone).stream().sorted().toList(),
                scheduledVisitService.listByParticipants(List.of(brunoInA)).stream()
                        .map(ScheduledVisit::getId).sorted().toList());
    }

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = {"COORDINATOR", "RESEARCHER", "ADMINISTRATOR"})
    void staffProfilesAreForbiddenOnParticipantRoutes(UserRole role) throws Exception {
        String token = role == UserRole.COORDINATOR
                ? tokenFor(coordinator.getEmail())
                : tokenFor(saveUser("Equipe", "me.staff." + role.name().toLowerCase() + "@test.local", role)
                        .getEmail());

        perform(STUDIES, token).andExpect(status().isForbidden());
        perform(VISITS, token).andExpect(status().isForbidden());
    }

    @Test
    void requestsWithoutTokenAreUnauthorized() throws Exception {
        mockMvc.perform(get(STUDIES)).andExpect(status().isUnauthorized());
        mockMvc.perform(get(VISITS)).andExpect(status().isUnauthorized());
    }

    private ResultActions perform(String path, String token) throws Exception {
        return mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, bearer(token)));
    }

    private Long study(String title, String objective, User researcher, String status) {
        Long id = studyRepository.save(new Study(title, objective, researcher.getId(),
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 10)).getId();
        jdbc.update("UPDATE studies SET status = ? WHERE id = ?", status, id);
        return id;
    }

    private Long plannedVisit(Long studyId, int position, String name) {
        return jdbc.queryForObject("INSERT INTO planned_visits (study_id, name, planned_date, position) "
                + "VALUES (?, ?, '2027-06-01', ?) RETURNING id", Long.class, studyId, name, position);
    }

    private Long plannedActivity(Long plannedVisitId, int position, String name, String description) {
        return jdbc.queryForObject("INSERT INTO planned_activities (planned_visit_id, name, name_key, "
                + "description, position) VALUES (?, ?, ?, ?, ?) RETURNING id", Long.class,
                plannedVisitId, name, name.toLowerCase(), description, position);
    }

    private Long candidate(Long studyId, User account) {
        return jdbc.queryForObject("INSERT INTO candidates (study_id, name, name_key, age, email, phone, user_id) "
                + "VALUES (?, ?, ?, 35, ?, '(83) 99999-0000', ?) RETURNING id", Long.class, studyId,
                account.getName(), account.getName().toLowerCase(), account.getEmail(), account.getId());
    }

    private Long participant(Long studyId, Long candidateId, String includedAt) {
        return jdbc.queryForObject("INSERT INTO participants (study_id, candidate_id, included_by, included_at) "
                + "VALUES (?, ?, ?, ?) RETURNING id", Long.class, studyId, candidateId, coordinator.getId(),
                ts(includedAt));
    }

    private Long visit(Long studyId, Long participantId, Long plannedVisitId, String scheduledAt, String status,
                       String note) {
        boolean finalStatus = !"SCHEDULED".equals(status);
        return jdbc.queryForObject("INSERT INTO scheduled_visits (study_id, participant_id, planned_visit_id, "
                + "scheduled_at, status, created_by_user_id, created_at, outcome_by_user_id, outcome_at, "
                + "outcome_note, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id", Long.class,
                studyId, participantId, plannedVisitId, ts(scheduledAt), status, coordinator.getId(),
                ts("2026-09-01T12:00:00Z"), finalStatus ? coordinator.getId() : null,
                finalStatus ? ts("2027-01-20T12:00:00Z") : null, note, finalStatus ? 1 : 0);
    }

    private static Timestamp ts(String instant) {
        return Timestamp.from(Instant.parse(instant));
    }
}
