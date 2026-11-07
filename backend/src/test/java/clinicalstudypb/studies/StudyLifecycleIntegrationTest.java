package clinicalstudypb.studies;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

/**
 * Verifica transições, histórico e controle de autoria com JWT e PostgreSQL.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
class StudyLifecycleIntegrationTest extends IntegrationTestSupport {

    private Study study;
    private User researcher;
    private String token;

    @BeforeEach
    void setUp() throws Exception {
        researcher = saveUser("Pesquisador", "lifecycle.researcher@test.local", UserRole.RESEARCHER);
        study = studyRepository.save(new Study("Estudo", "Objetivo", researcher.getId(),
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20));
        token = tokenFor(researcher.getEmail());
    }

    @Test
    void cancellationStoresActorReasonAndCanRestorePlanning() throws Exception {
        change(token, "CANCELLED", "PLANNING", "Sem financiamento")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        mockMvc.perform(get(path() + "/status-history")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].actorUserId").value(researcher.getId()))
                .andExpect(jsonPath("$[0].fromStatus").value("PLANNING"))
                .andExpect(jsonPath("$[0].toStatus").value("CANCELLED"))
                .andExpect(jsonPath("$[0].reason").value("Sem financiamento"));
        change(token, "PLANNING", "CANCELLED", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PLANNING"));
        mockMvc.perform(get(path() + "/status-history")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void recruitmentRequiresVisitAndCriteriaIntegration() throws Exception {
        change(token, "RECRUITMENT", "PLANNING", null)
                .andExpect(status().isConflict());
        mockMvc.perform(post(path() + "/planned-visits")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .header(HttpHeaders.IF_MATCH,
                                "\"" + studyRepository.findById(study.getId()).orElseThrow().getVersion() + "\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Inicial","plannedDate":"2027-02-01",
                                 "activities":[{"name":"Entrevista","description":"Histórico"}]}
                                """))
                .andExpect(status().isCreated());
        change(token, "RECRUITMENT", "PLANNING", null)
                .andExpect(status().isConflict());
        mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(jsonPath("$.status").value("PLANNING"));
    }

    @Test
    void staleStatusChangeIsRejectedAfterCancellation() throws Exception {
        change(token, "CANCELLED", "PLANNING", "Interrompido")
                .andExpect(status().isOk());
        change(token, "PLANNING", "PLANNING", null)
                .andExpect(status().isConflict());
    }

    @Test
    void coordinatorReadsHistoryButOtherResearcherCannotChangeStatus() throws Exception {
        User coordinator = saveUser("Coordenador", "lifecycle.coordinator@test.local", UserRole.COORDINATOR);
        User other = saveUser("Outro", "lifecycle.other@test.local", UserRole.RESEARCHER);

        change(tokenFor(other.getEmail()), "CANCELLED", "PLANNING", "Teste")
                .andExpect(status().isForbidden());
        change(token, "CANCELLED", "PLANNING", "Encerrado")
                .andExpect(status().isOk());
        mockMvc.perform(get(path() + "/status-history")
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenFor(coordinator.getEmail()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].toStatus").value("CANCELLED"));
    }

    private String path() {
        return "/api/studies/" + study.getId();
    }

    private org.springframework.test.web.servlet.ResultActions change(
            String bearerToken, String destination, String expected, String reason) throws Exception {
        String reasonField = reason == null ? "" : ",\"reason\":\"" + reason + "\"";
        return mockMvc.perform(patch(path() + "/status")
                .header(HttpHeaders.AUTHORIZATION, bearer(bearerToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + destination + "\",\"expectedStatus\":\""
                        + expected + "\"" + reasonField + "}"));
    }
}
