package clinicalstudypb.studies;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

/**
 * Verifica as transições e permissões do estudo com JWT e PostgreSQL reais.
 * Confere o estado retornado pela API e o valor efetivamente salvo no banco.
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

        advance("RECRUITMENT", researcherToken)
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

        advance("EXECUTION", researcherToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EXECUTION"));
        assertStoredStatus("EXECUTION");

        advance("CLOSED", researcherToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));
        assertStoredStatus("CLOSED");
    }

    @Test
    void skippedAndRepeatedTransitionsReturnConflictWithoutChangingStoredState() throws Exception {
        advance("EXECUTION", researcherToken).andExpect(status().isConflict());
        assertStoredStatus("PLANNING");

        advance("PLANNING", researcherToken).andExpect(status().isConflict());
        assertStoredStatus("PLANNING");

        advance("RECRUITMENT", researcherToken).andExpect(status().isOk());
        advance("RECRUITMENT", researcherToken).andExpect(status().isConflict());
        assertStoredStatus("RECRUITMENT");
    }

    @Test
    void backwardsTransitionAndTransitionAfterClosureReturnConflict() throws Exception {
        advance("RECRUITMENT", researcherToken).andExpect(status().isOk());
        advance("PLANNING", researcherToken).andExpect(status().isConflict());
        assertStoredStatus("RECRUITMENT");

        advance("EXECUTION", researcherToken).andExpect(status().isOk());
        advance("CLOSED", researcherToken).andExpect(status().isOk());
        advance("EXECUTION", researcherToken).andExpect(status().isConflict());
        assertStoredStatus("CLOSED");
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
                        .content("{\"status\":\"UNKNOWN\"}"))
                .andExpect(status().isBadRequest());
        assertStoredStatus("PLANNING");
    }

    @Test
    void unknownStudyReturnsNotFound() throws Exception {
        mockMvc.perform(patch(STATUS_PATH, 999_999L)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RECRUITMENT\"}"))
                .andExpect(status().isNotFound());
        assertStoredStatus("PLANNING");
    }

    @Test
    void unauthenticatedRequestCannotChangeStatus() throws Exception {
        mockMvc.perform(patch(STATUS_PATH, studyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RECRUITMENT\"}"))
                .andExpect(status().isUnauthorized());
        assertStoredStatus("PLANNING");
    }

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = {"ADMINISTRATOR", "COORDINATOR", "PARTICIPANT"})
    void rolesOtherThanResearcherCannotChangeStatus(UserRole role) throws Exception {
        String email = role.name().toLowerCase(Locale.ROOT) + ".status@clinicalstudypb.test";
        saveUser("Usuário " + role, email, role);

        advance("RECRUITMENT", tokenFor(email))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        assertStoredStatus("PLANNING");
    }

    private org.springframework.test.web.servlet.ResultActions advance(String nextStatus, String token)
            throws Exception {
        return mockMvc.perform(patch(STATUS_PATH, studyId)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + nextStatus + "\"}"));
    }

    private void assertStoredStatus(String expected) throws Exception {
        mockMvc.perform(get("/api/studies/{id}", studyId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(expected));
        assertEquals(expected, jdbcTemplate.queryForObject(
                "SELECT status FROM studies WHERE id = ?", String.class, studyId));
    }
}
