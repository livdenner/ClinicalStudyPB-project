package clinicalstudypb.studies;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.studies.application.StudyReadiness;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.LocalDate;
import java.util.Locale;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Verifica as transições e permissões do estudo com JWT e PostgreSQL reais.
 * Confere as respostas HTTP, o estado salvo e o histórico de transições.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-04
 * @version 0.0.1
 */
class StudyStatusIntegrationTest extends IntegrationTestSupport {

    private static final String RESEARCHER_EMAIL = "researcher.status@clinicalstudypb.test";
    private static final String STATUS_PATH = "/api/studies/{id}/status";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private StudyReadiness readiness;

    private User researcher;
    private String researcherToken;
    private Long studyId;

    @BeforeEach
    void setUp() throws Exception {
        researcher = saveUser("Pesquisador responsável", RESEARCHER_EMAIL, UserRole.RESEARCHER);
        researcherToken = tokenFor(RESEARCHER_EMAIL);
        studyId = studyRepository.save(new Study("Estudo de estados", "Testar transições",
                researcher.getId(), LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20)).getId();
    }

    @Test
    void validTransitionsPersistAndEditingDoesNotResetStatus() throws Exception {
        assertStoredStatus("PLANNING");
        prepareForRecruitment();
        when(readiness.hasIncludedParticipant(studyId)).thenReturn(true);

        advance("RECRUITMENT", "PLANNING", researcherToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RECRUITMENT"));
        assertStoredStatus("RECRUITMENT");

        mockMvc.perform(put("/api/studies/{id}", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Estudo editado","objective":"Testar transições",
                                 "responsibleUserId":%d,"startDate":"2027-01-01",
                                 "endDate":"2027-12-31","participantLimit":25}
                                """.formatted(researcher.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RECRUITMENT"));
        assertStoredStatus("RECRUITMENT");

        advance("EXECUTION", "RECRUITMENT", researcherToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EXECUTION"));
        assertStoredStatus("EXECUTION");

        mockMvc.perform(put("/api/studies/{id}", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Edição tardia","objective":"Não deve ser salva",
                                 "responsibleUserId":%d,"startDate":"2027-01-01",
                                 "endDate":"2027-12-31","participantLimit":25}
                                """.formatted(researcher.getId())))
                .andExpect(status().isConflict());
        assertStoredStatus("EXECUTION");

        advance("CLOSED", "EXECUTION", researcherToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));
        assertStoredStatus("CLOSED");
        assertHistoryCount(3);
    }

    @Test
    void skippedAndRepeatedTransitionsReturnConflictWithoutChangingStoredState() throws Exception {
        advance("EXECUTION", "PLANNING", researcherToken).andExpect(status().isConflict());
        assertStoredStatus("PLANNING");

        advance("PLANNING", "PLANNING", researcherToken).andExpect(status().isConflict());
        assertStoredStatus("PLANNING");

        prepareForRecruitment();
        advance("RECRUITMENT", "PLANNING", researcherToken).andExpect(status().isOk());
        advance("RECRUITMENT", "RECRUITMENT", researcherToken).andExpect(status().isConflict());
        advance("PLANNING", "PLANNING", researcherToken).andExpect(status().isConflict());
        assertStoredStatus("RECRUITMENT");
        assertHistoryCount(1);
    }

    @Test
    void recruitmentCanReturnToPlanningButClosedStudyCannotReturn() throws Exception {
        prepareForRecruitment();
        when(readiness.hasIncludedParticipant(studyId)).thenReturn(true);

        advance("RECRUITMENT", "PLANNING", researcherToken).andExpect(status().isOk());
        advance("PLANNING", "RECRUITMENT", researcherToken).andExpect(status().isOk());
        assertStoredStatus("PLANNING");

        advance("RECRUITMENT", "PLANNING", researcherToken).andExpect(status().isOk());
        advance("EXECUTION", "RECRUITMENT", researcherToken).andExpect(status().isOk());
        advance("CLOSED", "EXECUTION", researcherToken).andExpect(status().isOk());
        advance("EXECUTION", "CLOSED", researcherToken).andExpect(status().isConflict());
        assertStoredStatus("CLOSED");
        assertHistoryCount(5);
    }

    @Test
    void recruitmentNeedsVisitAndCriteriaAndExecutionNeedsIncludedParticipant() throws Exception {
        advance("RECRUITMENT", "PLANNING", researcherToken).andExpect(status().isConflict());
        createPlannedVisit();
        advance("RECRUITMENT", "PLANNING", researcherToken).andExpect(status().isConflict());
        assertStoredStatus("PLANNING");

        when(readiness.hasInclusionAndExclusionCriteria(studyId)).thenReturn(true);
        advance("RECRUITMENT", "PLANNING", researcherToken).andExpect(status().isOk());
        advance("EXECUTION", "RECRUITMENT", researcherToken).andExpect(status().isConflict());
        assertStoredStatus("RECRUITMENT");
        assertHistoryCount(1);
    }

    @Test
    void cancellationRequiresReasonAndRestoresOnlyThePreviousState() throws Exception {
        advance("CANCELLED", "PLANNING", researcherToken).andExpect(status().isBadRequest());
        assertStoredStatus("PLANNING");

        advanceWithReason("CANCELLED", "PLANNING", "Sem financiamento", researcherToken)
                .andExpect(status().isOk());
        assertStoredStatus("CANCELLED");
        mockMvc.perform(get("/api/studies/{id}/status-history", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].actorUserId").value(researcher.getId()))
                .andExpect(jsonPath("$[0].fromStatus").value("PLANNING"))
                .andExpect(jsonPath("$[0].toStatus").value("CANCELLED"))
                .andExpect(jsonPath("$[0].reason").value("Sem financiamento"))
                .andExpect(jsonPath("$[0].changedAt").exists());

        advance("RECRUITMENT", "CANCELLED", researcherToken).andExpect(status().isConflict());
        advance("PLANNING", "CANCELLED", researcherToken).andExpect(status().isOk());
        assertStoredStatus("PLANNING");
        assertHistoryCount(2);
    }

    @Test
    void cancelledRecruitmentCanReturnToRecruitment() throws Exception {
        prepareForRecruitment();
        advance("RECRUITMENT", "PLANNING", researcherToken).andExpect(status().isOk());
        advanceWithReason("CANCELLED", "RECRUITMENT", "Pausa no recrutamento", researcherToken)
                .andExpect(status().isOk());
        advance("PLANNING", "CANCELLED", researcherToken).andExpect(status().isConflict());
        advance("RECRUITMENT", "CANCELLED", researcherToken).andExpect(status().isOk());
        assertStoredStatus("RECRUITMENT");
        assertHistoryCount(3);
    }

    @Test
    void cancelledExecutionCannotBeRestored() throws Exception {
        prepareForRecruitment();
        when(readiness.hasIncludedParticipant(studyId)).thenReturn(true);
        advance("RECRUITMENT", "PLANNING", researcherToken).andExpect(status().isOk());
        advance("EXECUTION", "RECRUITMENT", researcherToken).andExpect(status().isOk());
        advanceWithReason("CANCELLED", "EXECUTION", "Interrupção definitiva", researcherToken)
                .andExpect(status().isOk());
        advance("EXECUTION", "CANCELLED", researcherToken).andExpect(status().isConflict());
        assertStoredStatus("CANCELLED");
        assertHistoryCount(3);
    }

    @Test
    void missingOrUnknownStatusIsRejectedBeforeChangingTheStudy() throws Exception {
        mockMvc.perform(patch(STATUS_PATH, studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(patch(STATUS_PATH, studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"UNKNOWN\",\"expectedStatus\":\"PLANNING\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(patch(STATUS_PATH, studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\",\"reason\":\"Teste\"}"))
                .andExpect(status().isBadRequest());
        assertStoredStatus("PLANNING");
        assertHistoryCount(0);
    }

    @Test
    void unknownStudyReturnsNotFound() throws Exception {
        mockMvc.perform(patch(STATUS_PATH, 999_999L)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\",\"expectedStatus\":\"PLANNING\","
                                + "\"reason\":\"Teste\"}"))
                .andExpect(status().isNotFound());
        assertStoredStatus("PLANNING");
    }

    @Test
    void unauthenticatedRequestCannotChangeStatus() throws Exception {
        mockMvc.perform(patch(STATUS_PATH, studyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\",\"expectedStatus\":\"PLANNING\","
                                + "\"reason\":\"Teste\"}"))
                .andExpect(status().isUnauthorized());
        assertStoredStatus("PLANNING");
    }

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = {"ADMINISTRATOR", "COORDINATOR", "PARTICIPANT"})
    void rolesOtherThanResearcherCannotChangeStatus(UserRole role) throws Exception {
        String email = role.name().toLowerCase(Locale.ROOT) + ".status@clinicalstudypb.test";
        saveUser("Usuário " + role, email, role);

        advanceWithReason("CANCELLED", "PLANNING", "Teste", tokenFor(email))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        assertStoredStatus("PLANNING");
    }

    @Test
    void otherResearcherCannotChangeThisStudy() throws Exception {
        User other = saveUser("Outro pesquisador", "other.status@clinicalstudypb.test", UserRole.RESEARCHER);
        advanceWithReason("CANCELLED", "PLANNING", "Teste", tokenFor(other.getEmail()))
                .andExpect(status().isForbidden());
        assertStoredStatus("PLANNING");
        assertHistoryCount(0);
    }

    private void prepareForRecruitment() throws Exception {
        createPlannedVisit();
        when(readiness.hasInclusionAndExclusionCriteria(studyId)).thenReturn(true);
    }

    private void createPlannedVisit() throws Exception {
        String etag = mockMvc.perform(get("/api/studies/{id}", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk()).andReturn().getResponse().getHeader(HttpHeaders.ETAG);
        mockMvc.perform(post("/api/studies/{id}/planned-visits", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .header(HttpHeaders.IF_MATCH, etag)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Visita inicial","plannedDate":"2027-02-01",
                                 "activities":[{"name":"Entrevista","description":"Histórico clínico"}]}
                                """))
                .andExpect(status().isCreated());
    }

    private ResultActions advance(String nextStatus, String expectedStatus, String token) throws Exception {
        return advanceWithReason(nextStatus, expectedStatus, null, token);
    }

    private ResultActions advanceWithReason(String nextStatus, String expectedStatus,
                                            String reason, String token) throws Exception {
        String reasonField = reason == null ? "" : ",\"reason\":\"" + reason + "\"";
        return mockMvc.perform(patch(STATUS_PATH, studyId)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + nextStatus + "\",\"expectedStatus\":\""
                        + expectedStatus + "\"" + reasonField + "}"));
    }

    private void assertStoredStatus(String expected) throws Exception {
        mockMvc.perform(get("/api/studies/{id}", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(expected));
        assertEquals(expected, jdbcTemplate.queryForObject(
                "SELECT status FROM studies WHERE id = ?", String.class, studyId));
    }

    private void assertHistoryCount(int expected) {
        assertEquals(expected, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM study_status_history WHERE study_id = ?", Integer.class, studyId));
    }
}
