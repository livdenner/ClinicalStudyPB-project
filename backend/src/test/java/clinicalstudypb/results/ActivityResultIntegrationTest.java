package clinicalstudypb.results;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

/** Verifica o contrato RF14 com PostgreSQL e autenticação reais. */
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
    private String researcherToken;
    private String coordinatorToken;
    private String otherResearcherToken;
    private String adminToken;

    @BeforeEach
    void prepare() throws Exception {
        User researcher = saveUser("Pesquisador", "results.researcher@test.local", UserRole.RESEARCHER);
        saveUser("Outro pesquisador", "results.other@test.local", UserRole.RESEARCHER);
        User coordinator = saveUser("Coordenador", "results.coordinator@test.local", UserRole.COORDINATOR);
        saveUser("Administrador", "results.admin@test.local", UserRole.ADMINISTRATOR);
        User person = saveUser("Pessoa", "results.person@test.local", UserRole.PARTICIPANT);
        researcherId = researcher.getId();
        researcherToken = tokenFor(researcher.getEmail());
        otherResearcherToken = tokenFor("results.other@test.local");
        coordinatorToken = tokenFor(coordinator.getEmail());
        adminToken = tokenFor("results.admin@test.local");
        studyId = studyRepository.save(new Study("Estudo de resultados", "RF14", researcherId,
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 10)).getId();
        jdbc.update("UPDATE studies SET status = 'EXECUTION' WHERE id = ?", studyId);
        plannedVisitId = jdbc.queryForObject("INSERT INTO planned_visits "
                + "(study_id, name, planned_date, position) VALUES (?, 'Visita A', '2027-06-01', 1) RETURNING id",
                Long.class, studyId);
        secondActivityId = activity(plannedVisitId, "Segunda", 2);
        firstActivityId = activity(plannedVisitId, "Primeira", 1);
        Long candidateId = jdbc.queryForObject("INSERT INTO candidates "
                + "(study_id, name, name_key, age, email, phone, user_id) "
                + "VALUES (?, 'Pessoa', 'pessoa', 35, ?, '(83) 99999-0000', ?) RETURNING id",
                Long.class, studyId, person.getEmail(), person.getId());
        participantId = jdbc.queryForObject("INSERT INTO participants "
                + "(study_id, candidate_id, included_by, included_at) "
                + "VALUES (?, ?, ?, NOW()) RETURNING id",
                Long.class, studyId, candidateId, coordinator.getId());
        visitId = jdbc.queryForObject("INSERT INTO scheduled_visits "
                + "(study_id, participant_id, planned_visit_id, scheduled_at, status, "
                + "created_by_user_id, created_at, version) "
                + "VALUES (?, ?, ?, NOW(), 'SCHEDULED', ?, NOW(), 0) RETURNING id",
                Long.class, studyId, participantId, plannedVisitId, coordinator.getId());
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

    @Test
    void putCreatesThenReplacesAndClearsNoteWhilePreservingSingleRow() throws Exception {
        jdbc.update("UPDATE scheduled_visits SET status = 'DONE' WHERE id = ?", visitId);
        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\" 120x80 mmHg \",\"note\":\" repouso \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.value").value("120x80 mmHg"))
                .andExpect(jsonPath("$.note").value("repouso"))
                .andExpect(jsonPath("$.recordedByUserId").value(researcherId));
        assertNotNull(jdbc.queryForObject("SELECT recorded_at FROM activity_results "
                + "WHERE scheduled_visit_id = ?", java.time.OffsetDateTime.class, visitId));
        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"130x90 mmHg\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.note").doesNotExist());
        assertEquals(1, countResults());
        assertEquals("130x90 mmHg", jdbc.queryForObject(
                "SELECT value FROM activity_results WHERE scheduled_visit_id = ?", String.class, visitId));
        mockMvc.perform(get(RESULTS, studyId, participantId, visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activities[0].result.value").value("130x90 mmHg"))
                .andExpect(jsonPath("$.activities[1].result").doesNotExist());
    }

    @Test
    void onlyResponsibleResearcherCanWriteAndActivityMustBelongToVisit() throws Exception {
        jdbc.update("UPDATE scheduled_visits SET status = 'DONE' WHERE id = ?", visitId);
        for (String token : new String[] {coordinatorToken, otherResearcherToken, adminToken}) {
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
    void onlyDoneVisitsInWritableStudiesAcceptResultsAndValidationRejectsBlankValue() throws Exception {
        mockMvc.perform(put(ACTIVITY, studyId, participantId, visitId, firstActivityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"teste\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VISIT_NOT_DONE"));
        jdbc.update("UPDATE scheduled_visits SET status = 'DONE' WHERE id = ?", visitId);
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
    void activityWithResultsCannotBeDeletedOrOmittedFromProtocolUpdate() throws Exception {
        jdbc.update("UPDATE studies SET status = 'RECRUITMENT' WHERE id = ?", studyId);
        jdbc.update("UPDATE scheduled_visits SET status = 'DONE' WHERE id = ?", visitId);
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

    private Long activity(Long plannedVisitId, String name, int position) {
        return jdbc.queryForObject("INSERT INTO planned_activities "
                + "(planned_visit_id, name, name_key, description, position) "
                + "VALUES (?, ?, ?, 'Atividade de teste', ?) RETURNING id",
                Long.class, plannedVisitId, name, name.toLowerCase(java.util.Locale.ROOT), position);
    }

    private int countResults() {
        return jdbc.queryForObject("SELECT count(*) FROM activity_results "
                + "WHERE scheduled_visit_id = ?", Integer.class, visitId);
    }
}
