package clinicalstudypb.results;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

/** Verifica todas as regras de RF14 com PostgreSQL, segurança JWT e concorrência reais. */
class ActivityResultIntegrationTest extends IntegrationTestSupport {

    private static final String RESULTS =
            "/api/studies/{studyId}/participants/{participantId}/visits/{visitId}/results";
    private static final String ACTIVITY = RESULTS + "/{activityId}";

    @Autowired
    private JdbcTemplate jdbc;

    private Long studyId;
    private Long participantId;
    private Long plannedVisitId;
    private Long visitId;
    private Long firstActivityId;
    private Long secondActivityId;
    private Long researcherId;
    private Long otherResearcherId;
    private Long coordinatorId;
    private String researcherToken;
    private String coordinatorToken;
    private String otherResearcherToken;
    private String adminToken;
    private String participantToken;

    @BeforeEach
    void prepare() throws Exception {
        User researcher = saveUser("Pesquisador", "results.researcher@test.local", UserRole.RESEARCHER);
        User otherResearcher = saveUser("Outro pesquisador", "results.other@test.local", UserRole.RESEARCHER);
        User coordinator = saveUser("Coordenador", "results.coordinator@test.local", UserRole.COORDINATOR);
        saveUser("Administrador", "results.admin@test.local", UserRole.ADMINISTRATOR);
        User person = saveUser("Pessoa", "results.person@test.local", UserRole.PARTICIPANT);
        researcherId = researcher.getId();
        otherResearcherId = otherResearcher.getId();
        coordinatorId = coordinator.getId();
        researcherToken = tokenFor(researcher.getEmail());
        otherResearcherToken = tokenFor(otherResearcher.getEmail());
        coordinatorToken = tokenFor(coordinator.getEmail());
        adminToken = tokenFor("results.admin@test.local");
        participantToken = tokenFor(person.getEmail());
        studyId = studyRepository.save(new Study("Estudo de resultados", "RF14", researcherId,
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 10)).getId();
        jdbc.update("UPDATE studies SET status = 'EXECUTION' WHERE id = ?", studyId);
        plannedVisitId = plannedVisit(studyId, "Visita A", "2027-06-01", 1);
        secondActivityId = activity(plannedVisitId, "Segunda", 2);
        firstActivityId = activity(plannedVisitId, "Primeira", 1);
        participantId = includedParticipant(studyId, "Pessoa", person.getEmail(), person.getId());
        visitId = scheduledVisit(studyId, participantId, plannedVisitId, "SCHEDULED", "NOW()");
    }

    @Test
    void getListsProtocolOrderAndMissingResultsForAnyVisitStatus() throws Exception {
        mockMvc.perform(get(RESULTS, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plannedVisitName").value("Visita A"))
                .andExpect(jsonPath("$.status").value("SCHEDULED"))
                .andExpect(jsonPath("$.activities[0].name").value("Primeira"))
                .andExpect(jsonPath("$.activities[1].name").value("Segunda"))
                .andExpect(jsonPath("$.activities[0].result").doesNotExist());
        mockMvc.perform(get(RESULTS, studyId, participantId + 1000000, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isNotFound());
    }

    @ParameterizedTest(name = "GET em visita {0} e matriz de papéis")
    @MethodSource("readableVisitStatuses")
    void getSupportsAllVisitStatusesAndCrossScopeIsRejected(ScheduledVisitStatus visitStatus) throws Exception {
        updateVisitStatus(visitId, visitStatus);

        mockMvc.perform(get(RESULTS, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(otherResearcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(visitStatus.name()))
                .andExpect(jsonPath("$.activities[0].activityId").value(firstActivityId))
                .andExpect(jsonPath("$.activities[1].activityId").value(secondActivityId));

        mockMvc.perform(get(RESULTS, studyId + 1000000, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    void getRoleMatrixRejectsAdminParticipantAndUnauthenticatedRequests() throws Exception {
        mockMvc.perform(get(RESULTS, studyId, participantId, visitId))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get(RESULTS, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mockMvc.perform(get(RESULTS, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(participantToken)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void putCreatesThenReplacesAndClearsNoteWhilePreservingSingleRow() throws Exception {
        updateVisitStatus(visitId, ScheduledVisitStatus.DONE);
        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\" 120x80 mmHg \",\"note\":\" repouso \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.activityName").value("Primeira"))
                .andExpect(jsonPath("$.value").value("120x80 mmHg"))
                .andExpect(jsonPath("$.note").value("repouso"))
                .andExpect(jsonPath("$.recordedByUserId").value(researcherId));
        assertNotNull(jdbc.queryForObject("SELECT recorded_at FROM activity_results "
                + "WHERE scheduled_visit_id = ?", OffsetDateTime.class, visitId));
        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"130x90 mmHg\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activityName").value("Primeira"))
                .andExpect(jsonPath("$.note").doesNotExist());
        assertEquals(1, countResults());
        assertEquals("130x90 mmHg", jdbc.queryForObject(
                "SELECT value FROM activity_results WHERE scheduled_visit_id = ?", String.class, visitId));
        mockMvc.perform(get(RESULTS, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activities[0].result.activityName").value("Primeira"))
                .andExpect(jsonPath("$.activities[0].result.value").value("130x90 mmHg"))
                .andExpect(jsonPath("$.activities[1].result").doesNotExist());
    }

    @Test
    void replacementUpdatesAuthorAndInstantWhenStudyResponsibilityChanges() throws Exception {
        jdbc.update("UPDATE studies SET status = 'RECRUITMENT' WHERE id = ?", studyId);
        updateVisitStatus(visitId, ScheduledVisitStatus.DONE);

        String createdBody = mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"118x76 mmHg\",\"note\":\"Medição inicial\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recordedByUserId").value(researcherId))
                .andReturn().getResponse().getContentAsString();
        Instant firstInstant = Instant.parse(objectMapper.readTree(createdBody).get("recordedAt").asText());

        mockMvc.perform(put("/api/studies/{studyId}", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Estudo de resultados","objective":"RF14",
                                 "responsibleUserId":%d,"startDate":"2027-01-01",
                                 "endDate":"2027-12-31","participantLimit":10}
                                """.formatted(otherResearcherId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.responsibleUserId").value(otherResearcherId));

        Thread.sleep(5);

        String updatedBody = mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(otherResearcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"126x82 mmHg\",\"note\":\"Nova medição\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value("126x82 mmHg"))
                .andExpect(jsonPath("$.note").value("Nova medição"))
                .andExpect(jsonPath("$.recordedByUserId").value(otherResearcherId))
                .andReturn().getResponse().getContentAsString();
        Instant secondInstant = Instant.parse(objectMapper.readTree(updatedBody).get("recordedAt").asText());

        assertTrue(secondInstant.isAfter(firstInstant),
                "O instante da substituição deve avançar em relação à gravação inicial.");
        assertEquals(1, countResults());
        assertEquals(otherResearcherId, jdbc.queryForObject(
                "SELECT recorded_by_user_id FROM activity_results WHERE scheduled_visit_id = ?",
                Long.class, visitId));

        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"Tentativa antiga\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void onlyResponsibleResearcherCanWriteAndActivityMustBelongToVisit() throws Exception {
        updateVisitStatus(visitId, ScheduledVisitStatus.DONE);
        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"teste\"}"))
                .andExpect(status().isUnauthorized());
        for (String token : new String[] {coordinatorToken, otherResearcherToken, adminToken, participantToken}) {
            mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                            .header(HttpHeaders.AUTHORIZATION, bearer(token))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"value\":\"teste\"}"))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, secondActivityId + 1000000)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"teste\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(put(ACTIVITY, studyId, participantId + 1000000, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"teste\"}"))
                .andExpect(status().isNotFound());
        assertEquals(0, countResults());
    }

    @Test
    void activityFromAnotherPlannedVisitOrStudyOrParticipantReturnsNotFound() throws Exception {
        updateVisitStatus(visitId, ScheduledVisitStatus.DONE);

        Long secondPlannedVisitId = plannedVisit(studyId, "Visita B", "2027-06-15", 2);
        Long activityFromOtherVisitSameStudy = activity(secondPlannedVisitId, "Glicemia", 1);

        User otherPerson = saveUser("Outro participante", "results.second@test.local", UserRole.PARTICIPANT);
        Long secondParticipantId = includedParticipant(
                studyId, "Outro participante", otherPerson.getEmail(), otherPerson.getId());

        Long otherStudyId = studyRepository.save(new Study("Outro estudo", "Controle", researcherId,
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 5)).getId();
        jdbc.update("UPDATE studies SET status = 'EXECUTION' WHERE id = ?", otherStudyId);
        Long otherStudyPlannedVisitId = plannedVisit(otherStudyId, "Visita externa", "2027-06-20", 1);
        Long otherStudyActivityId = activity(otherStudyPlannedVisitId, "Saturação", 1);

        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, activityFromOtherVisitSameStudy)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"95 mg/dL\"}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, otherStudyActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"98%\"}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(get(RESULTS, studyId, secondParticipantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isNotFound());

        mockMvc.perform(put(ACTIVITY, studyId, secondParticipantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"120x80 mmHg\"}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(put(ACTIVITY, otherStudyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"120x80 mmHg\"}"))
                .andExpect(status().isNotFound());

        assertEquals(0, countResults());
    }

    @Test
    void absentVisitRejectsResultWithVisitNotDoneConflictWithoutPersisting() throws Exception {
        updateVisitStatus(visitId, ScheduledVisitStatus.ABSENT);

        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"120x80 mmHg\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VISIT_NOT_DONE"));

        assertEquals(0, countResults());
    }

    @Test
    void cancelledVisitRejectsResultWithVisitNotDoneConflictWithoutPersisting() throws Exception {
        updateVisitStatus(visitId, ScheduledVisitStatus.CANCELLED);

        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"120x80 mmHg\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VISIT_NOT_DONE"));

        assertEquals(0, countResults());
    }

    @Test
    void onlyDoneVisitsInWritableStudiesAcceptResultsAndValidationRejectsBlankValue() throws Exception {
        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"teste\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VISIT_NOT_DONE"));
        updateVisitStatus(visitId, ScheduledVisitStatus.DONE);
        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"   \"}"))
                .andExpect(status().isBadRequest());
        jdbc.update("UPDATE studies SET status = 'CLOSED' WHERE id = ?", studyId);
        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"teste\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STUDY_READ_ONLY"));
        assertEquals(0, countResults());
    }

    @Test
    void cancelledStudyRejectsNewAndUpdatedResultsPreservingExistingData() throws Exception {
        updateVisitStatus(visitId, ScheduledVisitStatus.DONE);
        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"120x80 mmHg\",\"note\":\"Antes do cancelamento\"}"))
                .andExpect(status().isCreated());

        jdbc.update("UPDATE studies SET status = 'CANCELLED' WHERE id = ?", studyId);

        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, secondActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"72 kg\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STUDY_READ_ONLY"));

        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"Sobrescrita indevida\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STUDY_READ_ONLY"));

        assertEquals(1, countResults());
        assertEquals("120x80 mmHg", jdbc.queryForObject(
                "SELECT value FROM activity_results WHERE scheduled_visit_id = ?", String.class, visitId));
        assertEquals("Antes do cancelamento", jdbc.queryForObject(
                "SELECT note FROM activity_results WHERE scheduled_visit_id = ?", String.class, visitId));
    }

    @Test
    void validationRejectsOversizedFieldsAndAcceptsContractMaxBoundaries() throws Exception {
        updateVisitStatus(visitId, ScheduledVisitStatus.DONE);

        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"" + "a".repeat(201) + "\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"120x80 mmHg\",\"note\":\"" + "b".repeat(501) + "\"}"))
                .andExpect(status().isBadRequest());

        assertEquals(0, countResults());

        String maxValue = "v".repeat(200);
        String maxNote = "n".repeat(500);
        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"" + maxValue + "\",\"note\":\"" + maxNote + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.value").value(maxValue))
                .andExpect(jsonPath("$.note").value(maxNote));

        assertEquals(1, countResults());
    }

    @Test
    void doneVisitOfWithdrawnParticipantAcceptsResultsWhileCancelledFutureVisitIsRejected() throws Exception {
        updateVisitStatus(visitId, ScheduledVisitStatus.DONE);
        Long secondPlannedVisitId = plannedVisit(studyId, "Visita B", "2027-06-15", 2);
        Long futureActivityId = activity(secondPlannedVisitId, "Peso", 1);
        Long futureVisitId = scheduledVisit(
                studyId, participantId, secondPlannedVisitId, "SCHEDULED", "NOW() + INTERVAL '10 days'");

        mockMvc.perform(post("/api/studies/{studyId}/participants/{participantId}/withdrawal",
                        studyId, participantId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Saída voluntária após primeira visita\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"))
                .andExpect(jsonPath("$.withdrawal.cancelledVisitCount").value(1));

        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"115x75 mmHg\",\"note\":\"Registrado após retirada\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.value").value("115x75 mmHg"));

        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"118x78 mmHg\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value("118x78 mmHg"));

        mockMvc.perform(get(RESULTS, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activities[0].result.value").value("118x78 mmHg"));

        mockMvc.perform(put(ACTIVITY, studyId, participantId, futureVisitId, futureActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"70 kg\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VISIT_NOT_DONE"));

        assertEquals(1, countResults());
    }

    @Test
    void activityWithResultsCannotBeDeletedOrOmittedFromProtocolUpdate() throws Exception {
        jdbc.update("UPDATE studies SET status = 'RECRUITMENT' WHERE id = ?", studyId);
        updateVisitStatus(visitId, ScheduledVisitStatus.DONE);
        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"120x80 mmHg\"}"))
                .andExpect(status().isCreated());

        String plannedPath = "/api/studies/" + studyId + "/planned-visits/" + plannedVisitId;
        String version = "\"" + jdbc.queryForObject(
                "SELECT version FROM studies WHERE id = ?", Long.class, studyId) + "\"";
        mockMvc.perform(delete(plannedPath + "/activities/" + firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .header(HttpHeaders.IF_MATCH, version))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACTIVITY_HAS_RESULTS"));

        mockMvc.perform(put(plannedPath)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .header(HttpHeaders.IF_MATCH, version)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Nome não persistido","plannedDate":"2027-06-01",
                                 "activities":[{"id":%d,"name":"Segunda","description":"Atividade de teste"}]}
                                """.formatted(secondActivityId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACTIVITY_HAS_RESULTS"));

        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM planned_activities "
                + "WHERE planned_visit_id = ?", Integer.class, plannedVisitId));
        assertEquals("Visita A", jdbc.queryForObject(
                "SELECT name FROM planned_visits WHERE id = ?", String.class, plannedVisitId));
        assertEquals(1, countResults());
    }

    @Test
    void simultaneousPutRequestsForSameActivitySerializeIntoSinglePersistedRow() throws Exception {
        updateVisitStatus(visitId, ScheduledVisitStatus.DONE);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch release = new CountDownLatch(1);
        try {
            Future<Integer> first = executor.submit(
                    () -> concurrentPut("{\"value\":\"120x80 mmHg\"}", ready, release));
            Future<Integer> second = executor.submit(
                    () -> concurrentPut("{\"value\":\"130x85 mmHg\"}", ready, release));
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            release.countDown();

            List<Integer> statuses = new ArrayList<>(List.of(
                    first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS)));
            Collections.sort(statuses);
            assertEquals(List.of(200, 201), statuses);
        } finally {
            executor.shutdownNow();
        }

        assertEquals(1, countResults());
        String persistedValue = jdbc.queryForObject(
                "SELECT value FROM activity_results WHERE scheduled_visit_id = ? AND planned_activity_id = ?",
                String.class, visitId, firstActivityId);
        assertTrue("120x80 mmHg".equals(persistedValue) || "130x85 mmHg".equals(persistedValue));
    }

    private static Stream<Arguments> readableVisitStatuses() {
        return Stream.of(
                Arguments.of(ScheduledVisitStatus.DONE),
                Arguments.of(ScheduledVisitStatus.ABSENT),
                Arguments.of(ScheduledVisitStatus.CANCELLED));
    }

    private int concurrentPut(String body, CountDownLatch ready, CountDownLatch release) throws Exception {
        ready.countDown();
        if (!release.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("A requisição concorrente não foi liberada.");
        }
        return mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getStatus();
    }

    private Long plannedVisit(Long targetStudyId, String name, String plannedDate, int position) {
        return jdbc.queryForObject("INSERT INTO planned_visits "
                + "(study_id, name, planned_date, position) VALUES (?, ?, ?, ?) RETURNING id",
                Long.class, targetStudyId, name, LocalDate.parse(plannedDate), position);
    }

    private Long activity(Long targetPlannedVisitId, String name, int position) {
        return jdbc.queryForObject("INSERT INTO planned_activities "
                + "(planned_visit_id, name, name_key, description, position) "
                + "VALUES (?, ?, ?, 'Atividade de teste', ?) RETURNING id",
                Long.class, targetPlannedVisitId, name, name.toLowerCase(Locale.ROOT), position);
    }

    private Long includedParticipant(Long targetStudyId, String name, String email, Long userId) {
        Long candidateId = jdbc.queryForObject("INSERT INTO candidates "
                + "(study_id, name, name_key, age, email, phone, user_id) "
                + "VALUES (?, ?, ?, 35, ?, '(83) 99999-0000', ?) RETURNING id",
                Long.class, targetStudyId, name, name.toLowerCase(Locale.ROOT), email, userId);
        return jdbc.queryForObject("INSERT INTO participants "
                + "(study_id, candidate_id, included_by, included_at) "
                + "VALUES (?, ?, ?, NOW()) RETURNING id",
                Long.class, targetStudyId, candidateId, coordinatorId);
    }

    private Long scheduledVisit(Long targetStudyId, Long targetParticipantId, Long targetPlannedVisitId,
                                String status, String scheduledAtSql) {
        return jdbc.queryForObject("INSERT INTO scheduled_visits "
                + "(study_id, participant_id, planned_visit_id, scheduled_at, status, "
                + "created_by_user_id, created_at, version) "
                + "VALUES (?, ?, ?, " + scheduledAtSql + ", ?, ?, NOW(), 0) RETURNING id",
                Long.class, targetStudyId, targetParticipantId, targetPlannedVisitId, status, coordinatorId);
    }

    private void updateVisitStatus(Long targetVisitId, ScheduledVisitStatus status) {
        String note = status == ScheduledVisitStatus.CANCELLED ? "Motivo de teste" : null;
        jdbc.update("UPDATE scheduled_visits SET status = ?, outcome_note = ?, "
                + "outcome_by_user_id = ?, outcome_at = NOW(), version = version + 1 WHERE id = ?",
                status.name(), note, coordinatorId, targetVisitId);
    }

    private int countResults() {
        return jdbc.queryForObject("SELECT count(*) FROM activity_results "
                + "WHERE scheduled_visit_id = ?", Integer.class, visitId);
    }
}
