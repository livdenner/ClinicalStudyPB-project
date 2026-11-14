package clinicalstudypb.participants;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Verifica a retirada do participante (RF16, T22.1) sobre PostgreSQL real: auditoria, cancelamento
 * das visitas futuras na mesma transação, bloqueio de novos agendamentos, vaga e concorrência.
 *
 * @author Allan Guilherme
 * @since 2026-11-14
 * @version 0.0.1
 */
class ParticipantWithdrawalIntegrationTest extends ParticipantIntegrationSupport {

    private static final Instant WITHDRAWN_AT = Instant.parse("2027-03-01T12:00:00Z");
    private static final String WITHDRAWAL_NOTE = "Retirada do participante";

    @Test
    void withdrawalCancelsOnlyFutureScheduledVisitsAndRecordsAudit() throws Exception {
        Long participantId = includeAndStartExecution();
        Long pastVisit = schedule(participantId, plannedVisitId("Inicial"), "2027-02-01T09:00:00-03:00");
        Long futureVisit = schedule(participantId, addPlannedVisit(2, "Retorno"), "2027-06-01T09:00:00-03:00");
        Long laterVisit = schedule(participantId, addPlannedVisit(3, "Final"), "2027-09-01T09:00:00-03:00");
        Long doneVisit = schedule(participantId, addPlannedVisit(4, "Extra"), "2027-10-01T09:00:00-03:00");
        jdbc.update("UPDATE scheduled_visits SET status = 'DONE', version = 1 WHERE id = ?", doneVisit);
        when(clock.instant()).thenReturn(WITHDRAWN_AT);

        withdraw(participantId, coordinatorToken, "{\"reason\":\"  Mudou de cidade  \"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(participantId))
                .andExpect(jsonPath("$.studyId").value(study.getId()))
                .andExpect(jsonPath("$.candidateId").value(candidateId))
                .andExpect(jsonPath("$.candidateName").value("Ana Silva"))
                .andExpect(jsonPath("$.includedAt").value(NOW.toString()))
                .andExpect(jsonPath("$.status").value("WITHDRAWN"))
                .andExpect(jsonPath("$.withdrawal.reason").value("Mudou de cidade"))
                .andExpect(jsonPath("$.withdrawal.withdrawnAt").value(WITHDRAWN_AT.toString()))
                .andExpect(jsonPath("$.withdrawal.withdrawnByUserId").value(coordinator.getId()))
                .andExpect(jsonPath("$.withdrawal.cancelledVisitCount").value(2));

        Map<String, Object> participant = jdbc.queryForMap("SELECT * FROM participants WHERE id = ?", participantId);
        assertEquals("WITHDRAWN", participant.get("status"));
        assertEquals("Mudou de cidade", participant.get("withdrawal_reason"));
        assertEquals(WITHDRAWN_AT, instant(participant.get("withdrawn_at")));
        assertEquals(coordinator.getId(), participant.get("withdrawn_by_user_id"));
        assertEquals(2, participant.get("withdrawal_cancelled_visit_count"));
        for (Long cancelled : List.of(futureVisit, laterVisit)) {
            Map<String, Object> visit = visit(cancelled);
            assertEquals("CANCELLED", visit.get("status"));
            assertEquals(WITHDRAWAL_NOTE, visit.get("outcome_note"));
            assertEquals(coordinator.getId(), visit.get("outcome_by_user_id"));
            assertEquals(WITHDRAWN_AT, instant(visit.get("outcome_at")));
            assertEquals(1L, visit.get("version"));
        }
        Map<String, Object> past = visit(pastVisit);
        assertEquals("SCHEDULED", past.get("status"));
        assertNull(past.get("outcome_note"));
        assertEquals(0L, past.get("version"));
        Map<String, Object> done = visit(doneVisit);
        assertEquals("DONE", done.get("status"));
        assertNull(done.get("outcome_note"));
        assertEquals(1L, done.get("version"));
    }

    @Test
    void afterWithdrawalVisitsShowCancellationAndNewScheduleIsRejected() throws Exception {
        Long participantId = includeAndStartExecution();
        Long returnVisit = addPlannedVisit(2, "Retorno");
        schedule(participantId, returnVisit, "2027-06-01T09:00:00-03:00");
        when(clock.instant()).thenReturn(WITHDRAWN_AT);
        withdraw(participantId, coordinatorToken, "{\"reason\":\"Desistiu\"}").andExpect(status().isOk());

        mockMvc.perform(get(studyPath(study.getId()) + "/participants/" + participantId + "/visits")
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("CANCELLED"))
                .andExpect(jsonPath("$[0].outcomeNote").value(WITHDRAWAL_NOTE))
                .andExpect(jsonPath("$[0].outcomeByUserId").value(coordinator.getId()))
                .andExpect(jsonPath("$[0].outcomeAt").value(WITHDRAWN_AT.toString()))
                .andExpect(jsonPath("$[0].version").value(1));

        mockMvc.perform(post(studyPath(study.getId()) + "/participants/" + participantId + "/visits")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(scheduleBody(returnVisit, "2027-07-01T09:00:00-03:00")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTICIPANT_WITHDRAWN"));
        assertEquals(1L, countVisits(participantId));

        for (String token : new String[] {coordinatorToken, researcherToken}) {
            mockMvc.perform(get(studyPath(study.getId()) + "/participants/" + participantId)
                            .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("WITHDRAWN"))
                    .andExpect(jsonPath("$.withdrawal.reason").value("Desistiu"))
                    .andExpect(jsonPath("$.withdrawal.cancelledVisitCount").value(1));
            mockMvc.perform(get(studyPath(study.getId()) + "/participants")
                            .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].status").value("WITHDRAWN"))
                    .andExpect(jsonPath("$[0].withdrawal.withdrawnAt").value(WITHDRAWN_AT.toString()));
        }
    }

    @Test
    void secondWithdrawalReturnsConflictAndKeepsFirstRecord() throws Exception {
        Long participantId = includeAndStartExecution();
        when(clock.instant()).thenReturn(WITHDRAWN_AT);
        withdraw(participantId, coordinatorToken, "{\"reason\":\"Primeira\"}").andExpect(status().isOk());
        Map<String, Object> before = jdbc.queryForMap("SELECT * FROM participants WHERE id = ?", participantId);
        when(clock.instant()).thenReturn(WITHDRAWN_AT.plusSeconds(60));

        withdraw(participantId, coordinatorToken, "{\"reason\":\"Segunda\"}")
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("PARTICIPANT_ALREADY_WITHDRAWN"));

        assertEquals(before, jdbc.queryForMap("SELECT * FROM participants WHERE id = ?", participantId));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"reason\":null}", "{\"reason\":\"\"}", "{\"reason\":\"   \"}", "LONG"})
    void invalidReasonReturnsBadRequestWithoutAnyChange(String body) throws Exception {
        Long participantId = includeAndStartExecution();
        Long visit = schedule(participantId, addPlannedVisit(2, "Retorno"), "2027-06-01T09:00:00-03:00");
        String payload = "LONG".equals(body)
                ? objectMapper.writeValueAsString(Map.of("reason", "a".repeat(501)))
                : body;

        withdraw(participantId, coordinatorToken, payload)
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        assertActive(participantId);
        assertEquals("SCHEDULED", visit(visit).get("status"));
    }

    @Test
    void onlyCoordinatorCanWithdraw() throws Exception {
        Long participantId = includeAndStartExecution();
        User administrator = saveUser("Administradora", "withdrawal.admin@test.local", UserRole.ADMINISTRATOR);
        String body = "{\"reason\":\"Motivo\"}";

        withdraw(participantId, researcherToken, body).andExpect(status().isForbidden());
        withdraw(participantId, tokenFor(administrator.getEmail()), body).andExpect(status().isForbidden());
        mockMvc.perform(post(withdrawalPath(study.getId(), participantId))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());

        assertActive(participantId);
    }

    @Test
    void participantOutsideStudyOrUnknownStudyReturnsNotFound() throws Exception {
        Long participantId = includeAndStartExecution();
        Study other = openStudy("Outro estudo", 2);
        String body = "{\"reason\":\"Motivo\"}";

        mockMvc.perform(post(withdrawalPath(other.getId(), participantId))
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound());
        mockMvc.perform(post(withdrawalPath(Long.MAX_VALUE, participantId))
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound());
        mockMvc.perform(post(withdrawalPath(study.getId(), Long.MAX_VALUE))
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound());

        assertActive(participantId);
    }

    @ParameterizedTest
    @EnumSource(value = StudyStatus.class, names = {"CLOSED", "CANCELLED"})
    void closedOrCancelledStudyRejectsWithdrawal(StudyStatus readOnly) throws Exception {
        Long participantId = includeAndStartExecution();
        transition(study.getId(), readOnly, StudyStatus.EXECUTION).andExpect(status().isOk());

        withdraw(participantId, coordinatorToken, "{\"reason\":\"Motivo\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STUDY_READ_ONLY"));

        assertActive(participantId);
    }

    @Test
    void withdrawnParticipantKeepsPlaceAndCannotBeIncludedAgain() throws Exception {
        Study single = openStudy("Estudo com uma vaga", 1);
        Long carla = candidate(single, "Carla Lima", EligibilityStatus.ELIGIBLE, ConsentDecision.GRANTED);
        Long bruna = candidate(single, "Bruna Melo", EligibilityStatus.ELIGIBLE, ConsentDecision.GRANTED);
        Long participantId = includeSuccessfully(single.getId(), carla).get("id").asLong();

        withdraw(single.getId(), participantId, coordinatorToken, "{\"reason\":\"Desistiu\"}")
                .andExpect(status().isOk());

        include(single.getId(), carla).andExpect(status().isConflict());
        include(single.getId(), bruna).andExpect(status().isConflict());
        assertEquals(1L, jdbc.queryForObject(
                "SELECT COUNT(*) FROM participants WHERE study_id = ?", Long.class, single.getId()));
    }

    @Test
    void failureWhileSavingWithdrawalRollsBackVisitCancellation() throws Exception {
        Long participantId = includeAndStartExecution();
        Long visit = schedule(participantId, addPlannedVisit(2, "Retorno"), "2027-06-01T09:00:00-03:00");
        jdbc.execute("ALTER TABLE participants ADD CONSTRAINT test_reject_withdrawal CHECK (status <> 'WITHDRAWN')");
        try {
            withdraw(participantId, coordinatorToken, "{\"reason\":\"Motivo\"}")
                    .andExpect(status().isConflict());
        } finally {
            jdbc.execute("ALTER TABLE participants DROP CONSTRAINT test_reject_withdrawal");
        }

        assertActive(participantId);
        Map<String, Object> unchanged = visit(visit);
        assertEquals("SCHEDULED", unchanged.get("status"));
        assertNull(unchanged.get("outcome_note"));
        assertNull(unchanged.get("outcome_at"));
        assertEquals(0L, unchanged.get("version"));
    }

    @Test
    void simultaneousWithdrawalsRecordOnlyOneAndCancelVisitsOnce() throws Exception {
        Long participantId = includeAndStartExecution();
        Long visit = schedule(participantId, addPlannedVisit(2, "Retorno"), "2027-06-01T09:00:00-03:00");
        when(clock.instant()).thenReturn(WITHDRAWN_AT);
        String body = "{\"reason\":\"Motivo\"}";

        List<Integer> statuses = runConcurrently(
                () -> withdraw(participantId, coordinatorToken, body).andReturn().getResponse().getStatus(),
                () -> withdraw(participantId, coordinatorToken, body).andReturn().getResponse().getStatus());

        assertEquals(List.of(200, 409), statuses.stream().sorted().toList());
        assertEquals(1, jdbc.queryForObject("SELECT withdrawal_cancelled_visit_count FROM participants "
                + "WHERE id = ?", Integer.class, participantId));
        assertEquals("CANCELLED", visit(visit).get("status"));
        assertEquals(1L, visit(visit).get("version"));
    }

    @Test
    void concurrentScheduleAndWithdrawalNeverLeaveFutureVisitScheduled() throws Exception {
        Long participantId = includeAndStartExecution();
        Long returnVisit = addPlannedVisit(2, "Retorno");
        when(clock.instant()).thenReturn(WITHDRAWN_AT);

        List<Integer> statuses = runConcurrently(
                () -> withdraw(participantId, coordinatorToken, "{\"reason\":\"Motivo\"}")
                        .andReturn().getResponse().getStatus(),
                () -> mockMvc.perform(post(studyPath(study.getId()) + "/participants/" + participantId + "/visits")
                                .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(scheduleBody(returnVisit, "2027-06-01T09:00:00-03:00")))
                        .andReturn().getResponse().getStatus());

        assertEquals(200, statuses.get(0));
        assertTrue(List.of(201, 409).contains(statuses.get(1)), "agendamento: " + statuses.get(1));
        assertEquals(0L, jdbc.queryForObject("SELECT COUNT(*) FROM scheduled_visits "
                + "WHERE participant_id = ? AND status = 'SCHEDULED' AND scheduled_at > ?", Long.class,
                participantId, OffsetDateTime.parse("2027-03-01T12:00:00Z")));
        long expectedCancelled = statuses.get(1) == 201 ? 1 : 0;
        assertEquals(expectedCancelled, jdbc.queryForObject("SELECT withdrawal_cancelled_visit_count "
                + "FROM participants WHERE id = ?", Integer.class, participantId).longValue());
    }

    private Long includeAndStartExecution() throws Exception {
        Long participantId = includeSuccessfully(study.getId(), candidateId).get("id").asLong();
        transition(study.getId(), StudyStatus.EXECUTION, StudyStatus.RECRUITMENT).andExpect(status().isOk());
        return participantId;
    }

    private Long plannedVisitId(String name) {
        return jdbc.queryForObject("SELECT id FROM planned_visits WHERE study_id = ? AND name = ?",
                Long.class, study.getId(), name);
    }

    private Long addPlannedVisit(int position, String name) {
        return jdbc.queryForObject("INSERT INTO planned_visits (study_id, name, planned_date, position) "
                + "VALUES (?, ?, '2027-06-01', ?) RETURNING id", Long.class, study.getId(), name, position);
    }

    private Long schedule(Long participantId, Long plannedVisitId, String scheduledAt) throws Exception {
        String response = mockMvc.perform(post(studyPath(study.getId()) + "/participants/" + participantId
                                + "/visits")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(scheduleBody(plannedVisitId, scheduledAt)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private String scheduleBody(Long plannedVisitId, String scheduledAt) {
        return "{\"plannedVisitId\":" + plannedVisitId + ",\"scheduledAt\":\"" + scheduledAt + "\"}";
    }

    private ResultActions withdraw(Long participantId, String token, String body) throws Exception {
        return withdraw(study.getId(), participantId, token, body);
    }

    private ResultActions withdraw(Long studyId, Long participantId, String token, String body) throws Exception {
        return mockMvc.perform(post(withdrawalPath(studyId, participantId))
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private String withdrawalPath(Long studyId, Long participantId) {
        return studyPath(studyId) + "/participants/" + participantId + "/withdrawal";
    }

    private Map<String, Object> visit(Long visitId) {
        return jdbc.queryForMap("SELECT * FROM scheduled_visits WHERE id = ?", visitId);
    }

    private long countVisits(Long participantId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM scheduled_visits WHERE participant_id = ?",
                Long.class, participantId);
    }

    private void assertActive(Long participantId) {
        Map<String, Object> participant = jdbc.queryForMap("SELECT * FROM participants WHERE id = ?", participantId);
        assertEquals("ACTIVE", participant.get("status"));
        assertNull(participant.get("withdrawal_reason"));
        assertNull(participant.get("withdrawn_at"));
        assertNull(participant.get("withdrawn_by_user_id"));
        assertNull(participant.get("withdrawal_cancelled_visit_count"));
    }

    private static Instant instant(Object timestamp) {
        if (timestamp instanceof OffsetDateTime offset) {
            return offset.toInstant();
        }
        return ((java.sql.Timestamp) timestamp).toInstant();
    }

    private static List<Integer> runConcurrently(Callable<Integer> first, Callable<Integer> second)
            throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch release = new CountDownLatch(1);
        try {
            List<Future<Integer>> futures = List.of(
                    executor.submit(() -> awaitAndCall(ready, release, first)),
                    executor.submit(() -> awaitAndCall(ready, release, second)));
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            release.countDown();
            return List.of(futures.get(0).get(30, TimeUnit.SECONDS), futures.get(1).get(30, TimeUnit.SECONDS));
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
    }

    private static Integer awaitAndCall(CountDownLatch ready, CountDownLatch release, Callable<Integer> call)
            throws Exception {
        ready.countDown();
        if (!release.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("A requisição concorrente não foi liberada.");
        }
        return call.call();
    }
}
