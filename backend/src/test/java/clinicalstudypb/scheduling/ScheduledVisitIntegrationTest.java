package clinicalstudypb.scheduling;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Verifica agendamento, consultas, isolamento entre estudos e matriz de perfis sobre PostgreSQL real.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.2
 */
class ScheduledVisitIntegrationTest extends IntegrationTestSupport {

    private static final String ADMIN_EMAIL = "admin.scheduling@test.local";
    private static final String RESEARCHER_EMAIL = "researcher.scheduling@test.local";
    private static final String COORDINATOR_EMAIL = "coordinator.scheduling@test.local";
    private static final String PARTICIPANT_EMAIL = "person.scheduling@test.local";
    private static final String CREATE_PATH = "/api/studies/{studyId}/participants/{participantId}/visits";
    private static final String OUTCOME_PATH = CREATE_PATH + "/{visitId}/outcome";

    @Autowired
    private JdbcTemplate jdbc;

    private Long studyId;
    private Long participantId;
    private Long plannedVisitId;
    private Long researcherId;
    private Long coordinatorId;
    private String adminToken;
    private String researcherToken;
    private String coordinatorToken;
    private String participantToken;

    @BeforeEach
    void prepare() throws Exception {
        saveUser("Administrador", ADMIN_EMAIL, UserRole.ADMINISTRATOR);
        User researcher = saveUser("Pesquisador", RESEARCHER_EMAIL, UserRole.RESEARCHER);
        User coordinator = saveUser("Coordenador", COORDINATOR_EMAIL, UserRole.COORDINATOR);
        researcherId = researcher.getId();
        coordinatorId = coordinator.getId();
        adminToken = tokenFor(ADMIN_EMAIL);
        researcherToken = tokenFor(RESEARCHER_EMAIL);
        coordinatorToken = tokenFor(COORDINATOR_EMAIL);
        studyId = studyRepository.save(new Study("Estudo de visitas", "Agendamento",
                researcherId, LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 10)).getId();
        jdbc.update("UPDATE studies SET status = 'EXECUTION' WHERE id = ?", studyId);
        plannedVisitId = addPlannedVisit(1, "Visita inicial");
        User participant = saveUser("Pessoa teste", PARTICIPANT_EMAIL, UserRole.PARTICIPANT);
        participantToken = tokenFor(PARTICIPANT_EMAIL);
        Long candidateId = jdbc.queryForObject("INSERT INTO candidates "
                + "(study_id, name, name_key, age, email, phone, user_id) "
                + "VALUES (?, 'Pessoa teste', 'pessoa teste', 35, ?, ?, ?) RETURNING id", Long.class,
                studyId, participant.getEmail(), "(83) 99999-0000", participant.getId());
        participantId = jdbc.queryForObject("INSERT INTO participants "
                + "(study_id, candidate_id, included_by, included_at) "
                + "VALUES (?, ?, ?, NOW()) RETURNING id", Long.class,
                studyId, candidateId, coordinatorId);
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

    @Test
    void outcomeDonePersistsAuthorInstantNoteAndNewVersion() throws Exception {
        Long visitId = schedule(plannedVisitId);

        mockMvc.perform(post(OUTCOME_PATH, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .header(HttpHeaders.IF_MATCH, "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"DONE\",\"note\":\"  Atendimento concluído  \"}"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ETAG, "\"1\""))
                .andExpect(jsonPath("$.status").value("DONE"))
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.outcomeNote").value("Atendimento concluído"));

        assertEquals("DONE", jdbc.queryForObject(
                "SELECT status FROM scheduled_visits WHERE id = ?", String.class, visitId));
        assertEquals("Atendimento concluído", jdbc.queryForObject(
                "SELECT outcome_note FROM scheduled_visits WHERE id = ?", String.class, visitId));
        assertEquals(jdbc.queryForObject(
                "SELECT id FROM users WHERE email = ?", Long.class, COORDINATOR_EMAIL), jdbc.queryForObject(
                "SELECT outcome_by_user_id FROM scheduled_visits WHERE id = ?", Long.class, visitId));
        assertNotNull(jdbc.queryForObject(
                "SELECT outcome_at FROM scheduled_visits WHERE id = ?", java.time.OffsetDateTime.class, visitId));
        assertEquals(1L, jdbc.queryForObject(
                "SELECT version FROM scheduled_visits WHERE id = ?", Long.class, visitId));
    }

    @Test
    void absentWithoutNoteIsAcceptedAndCanBeRescheduled() throws Exception {
        Long visitId = schedule(plannedVisitId);
        mockMvc.perform(post(OUTCOME_PATH, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .header(HttpHeaders.IF_MATCH, "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"ABSENT\",\"note\":\"   \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ABSENT"))
                .andExpect(jsonPath("$.outcomeNote").doesNotExist());
        assertNull(jdbc.queryForObject(
                "SELECT outcome_note FROM scheduled_visits WHERE id = ?", String.class, visitId));
        Long nextVisitId = schedule(plannedVisitId);
        org.junit.jupiter.api.Assertions.assertNotEquals(visitId, nextVisitId);
    }

    @Test
    void cancellationRequiresReasonAndStoresNormalizedReason() throws Exception {
        Long visitId = schedule(plannedVisitId);
        mockMvc.perform(post(OUTCOME_PATH, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .header(HttpHeaders.IF_MATCH, "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"CANCELLED\",\"note\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CANCELLATION_REASON_REQUIRED"));
        assertEquals("SCHEDULED", jdbc.queryForObject(
                "SELECT status FROM scheduled_visits WHERE id = ?", String.class, visitId));

        mockMvc.perform(post(OUTCOME_PATH, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .header(HttpHeaders.IF_MATCH, "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"CANCELLED\",\"note\":\"  Imprevisto  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcomeNote").value("Imprevisto"));
    }

    @Test
    void outdatedVersionAndFinalOutcomeHaveDifferentConflictCodes() throws Exception {
        Long visitId = schedule(plannedVisitId);
        mockMvc.perform(post(OUTCOME_PATH, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .header(HttpHeaders.IF_MATCH, "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"DONE\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post(OUTCOME_PATH, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .header(HttpHeaders.IF_MATCH, "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"ABSENT\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_MISMATCH"));
        mockMvc.perform(post(OUTCOME_PATH, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .header(HttpHeaders.IF_MATCH, "\"1\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"ABSENT\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VISIT_OUTCOME_FINAL"));
        assertEquals("DONE", jdbc.queryForObject(
                "SELECT status FROM scheduled_visits WHERE id = ?", String.class, visitId));
    }

    @Test
    void invalidOutcomeNoteAndVersionLeaveScheduledVisitUntouched() throws Exception {
        Long visitId = schedule(plannedVisitId);
        String tooLong = "x".repeat(501);
        for (String body : List.of("{\"outcome\":\"SCHEDULED\"}",
                "{\"outcome\":\"DONE\",\"note\":\"" + tooLong + "\"}")) {
            mockMvc.perform(post(OUTCOME_PATH, studyId, participantId, visitId)
                            .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                            .header(HttpHeaders.IF_MATCH, "\"0\"")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }
        mockMvc.perform(post(OUTCOME_PATH, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .header(HttpHeaders.IF_MATCH, "W/\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"DONE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_IF_MATCH"));
        assertEquals(0L, jdbc.queryForObject(
                "SELECT version FROM scheduled_visits WHERE id = ?", Long.class, visitId));
    }

    @Test
    void outcomeChecksStudyAndParticipantScopeAndStudyReadOnly() throws Exception {
        Long visitId = schedule(plannedVisitId);
        mockMvc.perform(post(OUTCOME_PATH, studyId, participantId + 1, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .header(HttpHeaders.IF_MATCH, "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"DONE\"}"))
                .andExpect(status().isNotFound());
        jdbc.update("UPDATE studies SET status = 'CLOSED' WHERE id = ?", studyId);
        mockMvc.perform(post(OUTCOME_PATH, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .header(HttpHeaders.IF_MATCH, "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"DONE\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STUDY_READ_ONLY"));
        assertEquals("SCHEDULED", jdbc.queryForObject(
                "SELECT status FROM scheduled_visits WHERE id = ?", String.class, visitId));
    }

    @Test
    void onlyCoordinatorCanRegisterOutcome() throws Exception {
        Long visitId = schedule(plannedVisitId);
        mockMvc.perform(post(OUTCOME_PATH, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .header(HttpHeaders.IF_MATCH, "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"DONE\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(OUTCOME_PATH, studyId, participantId, visitId)
                        .header(HttpHeaders.IF_MATCH, "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"DONE\"}"))
                .andExpect(status().isUnauthorized());
        assertEquals("SCHEDULED", jdbc.queryForObject(
                "SELECT status FROM scheduled_visits WHERE id = ?", String.class, visitId));
    }

    @Test
    void withdrawnParticipantCanReceiveOutcomeForVisitThatRemainedPending() throws Exception {
        Long visitId = schedule(plannedVisitId);
        jdbc.update("UPDATE participants SET status = 'WITHDRAWN', withdrawal_reason = 'Retirada', "
                + "withdrawn_at = NOW(), withdrawn_by_user_id = included_by, "
                + "withdrawal_cancelled_visit_count = 0 WHERE id = ?", participantId);
        mockMvc.perform(post(OUTCOME_PATH, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .header(HttpHeaders.IF_MATCH, "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"ABSENT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ABSENT"));
    }

    @Test
    void simultaneousOutcomesAcceptOneAndRejectStaleVersion() throws Exception {
        Long visitId = schedule(plannedVisitId);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch release = new CountDownLatch(1);
        try {
            List<Future<String>> responses = List.of(
                    executor.submit(() -> concurrentOutcome(visitId, ready, release)),
                    executor.submit(() -> concurrentOutcome(visitId, ready, release)));
            org.junit.jupiter.api.Assertions.assertTrue(ready.await(10, TimeUnit.SECONDS));
            release.countDown();
            List<String> results = List.of(responses.get(0).get(30, TimeUnit.SECONDS),
                    responses.get(1).get(30, TimeUnit.SECONDS));
            assertEquals(1L, results.stream().filter("200"::equals).count());
            assertEquals(1L, results.stream().filter("409 VERSION_MISMATCH"::equals).count());
            assertEquals(1L, jdbc.queryForObject(
                    "SELECT version FROM scheduled_visits WHERE id = ?", Long.class, visitId));
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
    }

    private String concurrentOutcome(Long visitId, CountDownLatch ready, CountDownLatch release) throws Exception {
        ready.countDown();
        if (!release.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("A requisição concorrente não foi liberada.");
        }
        var response = mockMvc.perform(post(OUTCOME_PATH, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .header(HttpHeaders.IF_MATCH, "\"0\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"DONE\"}"))
                .andReturn().getResponse();
        if (response.getStatus() == 200) {
            return "200";
        }
        return response.getStatus() + " " + objectMapper.readTree(response.getContentAsString()).path("code").asText();
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
        return addPlannedVisit(studyId, position, name);
    }

    private String requestBody(Long plannedId) {
        return requestBody(plannedId, "2027-06-01T09:00:00-03:00");
    }

    private String requestBody(Long plannedId, String scheduledAtIso) {
        return "{\"plannedVisitId\":" + plannedId + ",\"scheduledAt\":\"" + scheduledAtIso + "\"}";
    }

    @Test
    void doneVisitBlocksNewScheduleWhileAbsentVisitAllowsReschedule() throws Exception {
        Long donePlannedVisitId = addPlannedVisit(2, "Visita concluída");
        Long doneVisitId = schedule(donePlannedVisitId);
        jdbc.update("UPDATE scheduled_visits SET status = 'DONE', version = version + 1 WHERE id = ?", doneVisitId);

        mockMvc.perform(post(CREATE_PATH, studyId, participantId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(donePlannedVisitId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VISIT_ALREADY_SCHEDULED"));
        assertEquals(1L, countVisitsForPlanned(donePlannedVisitId));

        Long absentVisitId = schedule(plannedVisitId);
        jdbc.update("UPDATE scheduled_visits SET status = 'ABSENT', version = version + 1 WHERE id = ?",
                absentVisitId);

        Long replacementId = schedule(plannedVisitId);
        assertNotEquals(absentVisitId, replacementId);
        assertEquals(2L, countVisitsForPlanned(plannedVisitId));
    }

    @Test
    void nonIncludedCandidateAndCrossStudyReferencesAreRejectedWithoutPersisting() throws Exception {
        Long unincludedCandidateId = addCandidate(studyId, "Candidato avulso", "avulso@test.local");
        Long otherStudyId = studyRepository.save(new Study("Outro estudo", "Controle",
                researcherId, LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 5)).getId();
        jdbc.update("UPDATE studies SET status = 'EXECUTION' WHERE id = ?", otherStudyId);
        Long otherPlannedVisitId = addPlannedVisit(otherStudyId, 1, "Visita externa");
        Long otherParticipantId = addIncludedParticipant(otherStudyId, "Participante externo", "externo@test.local");

        mockMvc.perform(post(CREATE_PATH, studyId, unincludedCandidateId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(plannedVisitId)))
                .andExpect(status().isNotFound());

        mockMvc.perform(post(CREATE_PATH, studyId, otherParticipantId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(plannedVisitId)))
                .andExpect(status().isNotFound());

        mockMvc.perform(post(CREATE_PATH, studyId, participantId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(otherPlannedVisitId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PLANNED_VISIT_NOT_IN_STUDY"));

        jdbc.update("UPDATE studies SET status = 'CLOSED' WHERE id = ?", studyId);
        mockMvc.perform(post(CREATE_PATH, studyId, participantId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(plannedVisitId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STUDY_STATUS_DOES_NOT_ALLOW_SCHEDULING"));

        assertEquals(0L, jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduled_visits WHERE study_id IN (?, ?)",
                Long.class, studyId, otherStudyId));
    }

    @Test
    void queriesFilterOrderBreakTiesIncludeWithdrawnAndRejectCrossParticipantAccess() throws Exception {
        Long secondParticipantId = addIncludedParticipant(studyId, "Bruno Silva", "bruno.scheduling@test.local");
        Long emptyParticipantId = addIncludedParticipant(studyId, "Clara Souza", "clara.scheduling@test.local");
        Long pv2 = addPlannedVisit(2, "Segunda visita");
        Long pv3 = addPlannedVisit(3, "Terceira visita");

        Long lateVisitId = scheduleFor(participantId, plannedVisitId, "2027-06-20T14:00:00-03:00");
        Long tieFirstId = scheduleFor(secondParticipantId, pv2, "2027-06-05T10:00:00-03:00");
        Long tieSecondId = scheduleFor(participantId, pv3, "2027-06-05T10:00:00-03:00");

        jdbc.update("UPDATE scheduled_visits SET status = 'DONE', version = version + 1 WHERE id = ?", tieSecondId);
        jdbc.update("UPDATE participants SET status = 'WITHDRAWN', withdrawal_reason = 'Saída voluntária', "
                + "withdrawn_at = NOW(), withdrawn_by_user_id = included_by, "
                + "withdrawal_cancelled_visit_count = 0 WHERE id = ?", secondParticipantId);

        mockMvc.perform(get("/api/studies/{studyId}/visits", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value(tieFirstId))
                .andExpect(jsonPath("$[0].participantName").value("Bruno Silva"))
                .andExpect(jsonPath("$[1].id").value(tieSecondId))
                .andExpect(jsonPath("$[2].id").value(lateVisitId));

        mockMvc.perform(get("/api/studies/{studyId}/visits", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .param("status", "DONE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(tieSecondId));

        mockMvc.perform(get("/api/studies/{studyId}/visits", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .param("participantId", participantId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(tieSecondId))
                .andExpect(jsonPath("$[1].id").value(lateVisitId));

        mockMvc.perform(get("/api/studies/{studyId}/visits", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .param("status", "SCHEDULED")
                        .param("participantId", participantId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(lateVisitId));

        mockMvc.perform(get("/api/studies/{studyId}/visits", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .param("participantId", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PARTICIPANT_ID"));

        mockMvc.perform(get(CREATE_PATH, studyId, participantId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(tieSecondId))
                .andExpect(jsonPath("$[1].id").value(lateVisitId));

        mockMvc.perform(get(CREATE_PATH, studyId, emptyParticipantId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mockMvc.perform(get(CREATE_PATH + "/{visitId}", studyId, secondParticipantId, lateVisitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isNotFound());
    }

    @ParameterizedTest(name = "{0} -> {1} {2} ({3})")
    @MethodSource("roleAuthorizationMatrix")
    void schedulingRoleMatrixEnforcesPermissionsWithoutSideEffects(
            UserRole role,
            HttpMethod method,
            String pathTemplate,
            int expectedStatus) throws Exception {
        Long visitId = method == HttpMethod.GET ? schedule(plannedVisitId) : null;
        long beforeCount = countStudyVisits();
        MockHttpServletRequestBuilder request = request(method, resolvePath(pathTemplate, visitId))
                .header(HttpHeaders.AUTHORIZATION, bearer(tokenForRole(role)));
        if (method == HttpMethod.POST) {
            request.contentType(MediaType.APPLICATION_JSON).content(requestBody(plannedVisitId));
        }

        var result = mockMvc.perform(request).andExpect(status().is(expectedStatus));
        if (expectedStatus == 403) {
            result.andExpect(jsonPath("$.code").value("FORBIDDEN"));
        }

        long expectedCount = expectedStatus == 201 ? beforeCount + 1 : beforeCount;
        assertEquals(expectedCount, countStudyVisits());
    }

    @ParameterizedTest(name = "anonymous -> {0} {1}")
    @MethodSource("allSchedulingEndpoints")
    void unauthenticatedRequestsReturnUnauthorized(HttpMethod method, String pathTemplate) throws Exception {
        Long visitId = method == HttpMethod.GET ? schedule(plannedVisitId) : null;
        MockHttpServletRequestBuilder request = request(method, resolvePath(pathTemplate, visitId));
        if (method == HttpMethod.POST) {
            request.contentType(MediaType.APPLICATION_JSON).content(requestBody(plannedVisitId));
        }

        mockMvc.perform(request).andExpect(status().isUnauthorized());
    }

    private static Stream<Arguments> roleAuthorizationMatrix() {
        String byStudy = "/api/studies/{studyId}/visits";
        String byParticipant = CREATE_PATH;
        String single = CREATE_PATH + "/{visitId}";
        return Stream.of(
                Arguments.of(UserRole.COORDINATOR, HttpMethod.POST, byParticipant, 201),
                Arguments.of(UserRole.ADMINISTRATOR, HttpMethod.POST, byParticipant, 403),
                Arguments.of(UserRole.RESEARCHER, HttpMethod.POST, byParticipant, 403),
                Arguments.of(UserRole.PARTICIPANT, HttpMethod.POST, byParticipant, 403),
                Arguments.of(UserRole.COORDINATOR, HttpMethod.GET, byStudy, 200),
                Arguments.of(UserRole.RESEARCHER, HttpMethod.GET, byStudy, 200),
                Arguments.of(UserRole.ADMINISTRATOR, HttpMethod.GET, byStudy, 403),
                Arguments.of(UserRole.PARTICIPANT, HttpMethod.GET, byStudy, 403),
                Arguments.of(UserRole.COORDINATOR, HttpMethod.GET, byParticipant, 200),
                Arguments.of(UserRole.RESEARCHER, HttpMethod.GET, byParticipant, 200),
                Arguments.of(UserRole.ADMINISTRATOR, HttpMethod.GET, byParticipant, 403),
                Arguments.of(UserRole.PARTICIPANT, HttpMethod.GET, byParticipant, 403),
                Arguments.of(UserRole.COORDINATOR, HttpMethod.GET, single, 200),
                Arguments.of(UserRole.RESEARCHER, HttpMethod.GET, single, 200),
                Arguments.of(UserRole.ADMINISTRATOR, HttpMethod.GET, single, 403),
                Arguments.of(UserRole.PARTICIPANT, HttpMethod.GET, single, 403));
    }

    private static Stream<Arguments> allSchedulingEndpoints() {
        return Stream.of(
                Arguments.of(HttpMethod.POST, CREATE_PATH),
                Arguments.of(HttpMethod.GET, "/api/studies/{studyId}/visits"),
                Arguments.of(HttpMethod.GET, CREATE_PATH),
                Arguments.of(HttpMethod.GET, CREATE_PATH + "/{visitId}"));
    }

    private Long addPlannedVisit(Long targetStudyId, int position, String name) {
        return jdbc.queryForObject("INSERT INTO planned_visits "
                + "(study_id, name, planned_date, position) VALUES (?, ?, '2027-06-01', ?) "
                + "RETURNING id", Long.class, targetStudyId, name, position);
    }

    private Long addCandidate(Long targetStudyId, String name, String email) {
        User account = saveUser(name, email, UserRole.PARTICIPANT);
        return jdbc.queryForObject("INSERT INTO candidates "
                + "(study_id, name, name_key, age, email, phone, user_id) "
                + "VALUES (?, ?, ?, 30, ?, '(83) 98888-0000', ?) RETURNING id", Long.class,
                targetStudyId, name, name.toLowerCase(Locale.ROOT), email, account.getId());
    }

    private Long addIncludedParticipant(Long targetStudyId, String name, String email) {
        Long extraCandidateId = addCandidate(targetStudyId, name, email);
        return jdbc.queryForObject("INSERT INTO participants "
                + "(study_id, candidate_id, included_by, included_at) "
                + "VALUES (?, ?, ?, NOW()) RETURNING id", Long.class,
                targetStudyId, extraCandidateId, coordinatorId);
    }

    private Long scheduleFor(Long targetParticipantId, Long plannedId, String scheduledAtIso) throws Exception {
        String response = mockMvc.perform(post(CREATE_PATH, studyId, targetParticipantId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody(plannedId, scheduledAtIso)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private long countVisitsForPlanned(Long plannedId) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduled_visits WHERE participant_id = ? AND planned_visit_id = ?",
                Long.class, participantId, plannedId);
    }

    private long countStudyVisits() {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduled_visits WHERE study_id = ?", Long.class, studyId);
    }

    private String resolvePath(String template, Long visitId) {
        String resolved = template
                .replace("{studyId}", studyId.toString())
                .replace("{participantId}", participantId.toString());
        return visitId == null ? resolved : resolved.replace("{visitId}", visitId.toString());
    }

    private String tokenForRole(UserRole role) {
        return Map.of(
                UserRole.ADMINISTRATOR, adminToken,
                UserRole.RESEARCHER, researcherToken,
                UserRole.COORDINATOR, coordinatorToken,
                UserRole.PARTICIPANT, participantToken).get(role);
    }
}
