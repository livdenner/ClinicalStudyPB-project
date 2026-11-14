package clinicalstudypb.scheduling;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Verifica agendamento e efeitos das transições do estudo sobre PostgreSQL real.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
class ScheduledVisitIntegrationTest extends IntegrationTestSupport {

    private static final String RESEARCHER_EMAIL = "researcher.scheduling@test.local";
    private static final String COORDINATOR_EMAIL = "coordinator.scheduling@test.local";
    private static final String CREATE_PATH = "/api/studies/{studyId}/participants/{participantId}/visits";

    @Autowired
    private JdbcTemplate jdbc;

    private Long studyId;
    private Long participantId;
    private Long plannedVisitId;
    private Long researcherId;
    private String researcherToken;
    private String coordinatorToken;

    @BeforeEach
    void prepare() throws Exception {
        User researcher = saveUser("Pesquisador", RESEARCHER_EMAIL, UserRole.RESEARCHER);
        User coordinator = saveUser("Coordenador", COORDINATOR_EMAIL, UserRole.COORDINATOR);
        researcherId = researcher.getId();
        researcherToken = tokenFor(RESEARCHER_EMAIL);
        coordinatorToken = tokenFor(COORDINATOR_EMAIL);
        studyId = studyRepository.save(new Study("Estudo de visitas", "Agendamento",
                researcherId, LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 10)).getId();
        jdbc.update("UPDATE studies SET status = 'EXECUTION' WHERE id = ?", studyId);
        plannedVisitId = addPlannedVisit(1, "Visita inicial");
        User participant = saveUser("Pessoa teste", "person.scheduling@test.local", UserRole.PARTICIPANT);
        Long candidateId = jdbc.queryForObject("INSERT INTO candidates "
                + "(study_id, name, name_key, age, email, phone, user_id) "
                + "VALUES (?, 'Pessoa teste', 'pessoa teste', 35, ?, ?, ?) RETURNING id", Long.class,
                studyId, participant.getEmail(), "(83) 99999-0000", participant.getId());
        participantId = jdbc.queryForObject("INSERT INTO participants "
                + "(study_id, candidate_id, included_by, included_at) "
                + "VALUES (?, ?, ?, NOW()) RETURNING id", Long.class,
                studyId, candidateId, coordinator.getId());
    }

    @Test
    void scheduleCreatesVisitAndExposesItWithHeadersAndNames() throws Exception {
        Long visitId = schedule(plannedVisitId);

        mockMvc.perform(get(CREATE_PATH + "/{visitId}", studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ETAG, "\"0\""))
                .andExpect(jsonPath("$.participantName").value("Pessoa teste"))
                .andExpect(jsonPath("$.plannedVisitName").value("Visita inicial"))
                .andExpect(jsonPath("$.status").value("SCHEDULED"));
        mockMvc.perform(get("/api/studies/{studyId}/visits", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .param("status", "SCHEDULED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(visitId));
    }

    @Test
    void closedRejectsPendingVisitWithoutChangingStudyOrVisit() throws Exception {
        Long visitId = schedule(plannedVisitId);

        mockMvc.perform(patch("/api/studies/{studyId}/status", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CLOSED\",\"expectedStatus\":\"EXECUTION\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STUDY_HAS_SCHEDULED_VISITS"))
                .andExpect(jsonPath("$.detail", containsString("visitas agendadas")));

        assertEquals("EXECUTION", jdbc.queryForObject(
                "SELECT status FROM studies WHERE id = ?", String.class, studyId));
        assertEquals("SCHEDULED", jdbc.queryForObject(
                "SELECT status FROM scheduled_visits WHERE id = ?", String.class, visitId));
        assertEquals(0L, jdbc.queryForObject(
                "SELECT COUNT(*) FROM study_status_history WHERE study_id = ?", Long.class, studyId));

        jdbc.update("UPDATE scheduled_visits SET status = 'DONE', version = version + 1 WHERE id = ?", visitId);
        mockMvc.perform(patch("/api/studies/{studyId}/status", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CLOSED\",\"expectedStatus\":\"EXECUTION\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));
    }

    @Test
    void cancellationChangesOnlyPendingVisitsAndKeepsSameAuthorAndInstant() throws Exception {
        Long pendingId = schedule(plannedVisitId);
        Long completedPlannedVisitId = addPlannedVisit(2, "Visita final");
        Long completedId = schedule(completedPlannedVisitId);
        jdbc.update("UPDATE scheduled_visits SET status = 'DONE', version = 1 WHERE id = ?", completedId);

        mockMvc.perform(patch("/api/studies/{studyId}/status", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\",\"expectedStatus\":\"EXECUTION\","
                                + "\"reason\":\"Pesquisa interrompida\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        assertEquals("CANCELLED", jdbc.queryForObject(
                "SELECT status FROM scheduled_visits WHERE id = ?", String.class, pendingId));
        assertEquals("Cancelamento do estudo", jdbc.queryForObject(
                "SELECT outcome_note FROM scheduled_visits WHERE id = ?", String.class, pendingId));
        assertEquals(researcherId, jdbc.queryForObject(
                "SELECT outcome_by_user_id FROM scheduled_visits WHERE id = ?", Long.class, pendingId));
        assertEquals(1L, jdbc.queryForObject(
                "SELECT version FROM scheduled_visits WHERE id = ?", Long.class, pendingId));
        assertEquals("DONE", jdbc.queryForObject(
                "SELECT status FROM scheduled_visits WHERE id = ?", String.class, completedId));
        assertEquals(1L, jdbc.queryForObject(
                "SELECT version FROM scheduled_visits WHERE id = ?", Long.class, completedId));
        assertNotNull(jdbc.queryForObject("SELECT outcome_at FROM scheduled_visits WHERE id = ?",
                java.time.OffsetDateTime.class, pendingId));
        assertEquals(jdbc.queryForObject("SELECT changed_at FROM study_status_history WHERE study_id = ?",
                        java.time.OffsetDateTime.class, studyId).toInstant(),
                jdbc.queryForObject("SELECT outcome_at FROM scheduled_visits WHERE id = ?",
                        java.time.OffsetDateTime.class, pendingId).toInstant());
    }

    @Test
    void withdrawnParticipantCannotReceiveVisit() throws Exception {
        jdbc.update("UPDATE participants SET status = 'WITHDRAWN', withdrawal_reason = 'Retirada de teste', "
                + "withdrawn_at = NOW(), withdrawn_by_user_id = included_by, "
                + "withdrawal_cancelled_visit_count = 0 WHERE id = ?", participantId);

        mockMvc.perform(post(CREATE_PATH, studyId, participantId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(plannedVisitId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTICIPANT_WITHDRAWN"));
        assertEquals(0L, jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduled_visits WHERE study_id = ?", Long.class, studyId));
    }

    @Test
    void restoringCancelledRecruitmentLeavesVisitCancelledAndAllowsNewSchedule() throws Exception {
        jdbc.update("UPDATE studies SET status = 'RECRUITMENT' WHERE id = ?", studyId);
        Long previousId = schedule(plannedVisitId);
        mockMvc.perform(patch("/api/studies/{studyId}/status", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\",\"expectedStatus\":\"RECRUITMENT\","
                                + "\"reason\":\"Pausa\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/studies/{studyId}/status", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RECRUITMENT\",\"expectedStatus\":\"CANCELLED\"}"))
                .andExpect(status().isOk());

        assertEquals("CANCELLED", jdbc.queryForObject(
                "SELECT status FROM scheduled_visits WHERE id = ?", String.class, previousId));
        Long newId = schedule(plannedVisitId);
        org.junit.jupiter.api.Assertions.assertNotEquals(previousId, newId);
    }

    @Test
    void duplicateVisitReturnsConflictAndKeepsOneRow() throws Exception {
        schedule(plannedVisitId);

        mockMvc.perform(post(CREATE_PATH, studyId, participantId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(plannedVisitId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VISIT_ALREADY_SCHEDULED"));
        assertEquals(1L, jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduled_visits WHERE study_id = ?", Long.class, studyId));
    }

    @Test
    void researcherCannotScheduleAndAnonymousCannotRead() throws Exception {
        mockMvc.perform(post(CREATE_PATH, studyId, participantId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(plannedVisitId)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/studies/{studyId}/visits", studyId))
                .andExpect(status().isUnauthorized());
        assertEquals(0L, jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduled_visits WHERE study_id = ?", Long.class, studyId));
    }

    @Test
    void simultaneousRequestsForSameVisitCreateExactlyOneRow() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch release = new CountDownLatch(1);
        try {
            List<Future<Integer>> responses = List.of(
                    executor.submit(() -> concurrentSchedule(ready, release)),
                    executor.submit(() -> concurrentSchedule(ready, release)));
            org.junit.jupiter.api.Assertions.assertTrue(ready.await(10, TimeUnit.SECONDS));
            release.countDown();
            List<Integer> statuses = List.of(responses.get(0).get(30, TimeUnit.SECONDS),
                    responses.get(1).get(30, TimeUnit.SECONDS));
            assertEquals(List.of(201, 409), statuses.stream().sorted().toList());
            assertEquals(1L, jdbc.queryForObject(
                    "SELECT COUNT(*) FROM scheduled_visits WHERE study_id = ?", Long.class, studyId));
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
    }

    private int concurrentSchedule(CountDownLatch ready, CountDownLatch release) throws Exception {
        ready.countDown();
        if (!release.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("A requisição concorrente não foi liberada.");
        }
        return mockMvc.perform(post(CREATE_PATH, studyId, participantId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(plannedVisitId)))
                .andReturn().getResponse().getStatus();
    }

    private Long schedule(Long plannedId) throws Exception {
        String response = mockMvc.perform(post(CREATE_PATH, studyId, participantId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(plannedId)))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.ETAG, "\"0\""))
                .andExpect(header().string(HttpHeaders.LOCATION, containsString("/visits/")))
                .andExpect(jsonPath("$.version").value(0))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private Long addPlannedVisit(int position, String name) {
        return jdbc.queryForObject("INSERT INTO planned_visits "
                + "(study_id, name, planned_date, position) VALUES (?, ?, '2027-06-01', ?) "
                + "RETURNING id", Long.class, studyId, name, position);
    }

    private String requestBody(Long plannedId) {
        return "{\"plannedVisitId\":" + plannedId + ",\"scheduledAt\":\"2027-06-01T09:00:00-03:00\"}";
    }
}
