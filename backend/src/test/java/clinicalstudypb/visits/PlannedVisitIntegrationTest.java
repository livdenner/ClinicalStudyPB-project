package clinicalstudypb.visits;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Exercita visitas previstas, posições, permissões e restrições no PostgreSQL real.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
class PlannedVisitIntegrationTest extends IntegrationTestSupport {

    private Study study;
    private String researcherToken;

    @BeforeEach
    void setUp() throws Exception {
        User researcher = saveUser("Pesquisador", "visit.researcher@test.local", UserRole.RESEARCHER);
        study = studyRepository.save(new Study("Estudo", "Objetivo", researcher.getId(),
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20));
        researcherToken = tokenFor(researcher.getEmail());
    }

    @Test
    void createAndReorderVisitsKeepContiguousPositions() throws Exception {
        long first = idOf(create(visitBody("Primeira", null, "Entrevista")));
        long second = idOf(create(visitBody("Segunda", 1, "Coleta")));

        mockMvc.perform(get(base()).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(second))
                .andExpect(jsonPath("$[0].position").value(1))
                .andExpect(jsonPath("$[1].id").value(first))
                .andExpect(jsonPath("$[1].position").value(2));

        mockMvc.perform(put(base() + "/order")
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .header(HttpHeaders.IF_MATCH, etag())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[" + first + "," + second + "]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(first))
                .andExpect(jsonPath("$[1].position").value(2));
    }

    @Test
    void updateKeepsActivityIdAndDeleteRejectsLastActivity() throws Exception {
        long visitId = idOf(create(visitBody("Inicial", null, "Entrevista")));
        String path = base() + "/" + visitId;
        long activityId = objectMapper.readTree(mockMvc.perform(get(path)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andReturn().getResponse().getContentAsString())
                .get("activities").get(0).get("id").asLong();

        String body = """
                {"name":"Inicial revisada","plannedDate":"2027-02-01",
                 "activities":[{"id":%d,"name":"Entrevista","description":"Atualizada"},
                               {"name":"Exame","description":"Exame clínico"}]}
                """.formatted(activityId);
        mockMvc.perform(put(path).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .header(HttpHeaders.IF_MATCH, etag())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activities[0].id").value(activityId))
                .andExpect(jsonPath("$.activities[1].position").value(2));

        mockMvc.perform(delete(path + "/activities/" + activityId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .header(HttpHeaders.IF_MATCH, etag()))
                .andExpect(status().isNoContent());
        long remainingId = objectMapper.readTree(mockMvc.perform(get(path)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andReturn().getResponse().getContentAsString())
                .get("activities").get(0).get("id").asLong();
        mockMvc.perform(delete(path + "/activities/" + remainingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .header(HttpHeaders.IF_MATCH, etag()))
                .andExpect(status().isConflict());
    }

    @Test
    void duplicateActivityNameAndOutOfRangeDateAreRejected() throws Exception {
        create("""
                {"name":"Visita","plannedDate":"2028-01-01",
                 "activities":[{"name":"Exame","description":"A"}]}
                """).andExpect(status().isBadRequest());
        create("""
                {"name":"Visita","plannedDate":"2027-02-01",
                 "activities":[{"name":"Exame","description":"A"},
                               {"name":" exame ","description":"B"}]}
                """).andExpect(status().isBadRequest());
    }

    @Test
    void coordinatorCanReadButCannotWriteAndOtherResearcherCannotAlter() throws Exception {
        long visitId = idOf(create(visitBody("Inicial", null, "Entrevista")));
        User coordinator = saveUser("Coordenador", "visit.coordinator@test.local", UserRole.COORDINATOR);
        User other = saveUser("Outro", "visit.other@test.local", UserRole.RESEARCHER);
        String coordinatorToken = tokenFor(coordinator.getEmail());
        String otherToken = tokenFor(other.getEmail());

        mockMvc.perform(get(base() + "/" + visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk());
        mockMvc.perform(post(base()).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .header(HttpHeaders.IF_MATCH, etag())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(visitBody("Outra", null, "Exame")))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete(base() + "/" + visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(otherToken))
                        .header(HttpHeaders.IF_MATCH, etag()))
                .andExpect(status().isForbidden());
    }

    @Test
    void executedStudyRejectsProtocolChanges() throws Exception {
        study.advanceStatus(StudyStatus.RECRUITMENT);
        study.advanceStatus(StudyStatus.EXECUTION);
        studyRepository.saveAndFlush(study);

        create(visitBody("Tardia", null, "Exame")).andExpect(status().isConflict());
    }

    @Test
    void staleProtocolVersionReturnsConflictWithoutCreatingVisit() throws Exception {
        long originalVersion = version();
        create(visitBody("Inicial", null, "Entrevista")).andExpect(status().isCreated());

        mockMvc.perform(post(base()).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .header(HttpHeaders.IF_MATCH, "\"" + originalVersion + "\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(visitBody("Desatualizada", null, "Exame")))
                .andExpect(status().isConflict());
        mockMvc.perform(get(base()).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(jsonPath("$.length()").value(1));
    }

    private String base() {
        return "/api/studies/" + study.getId() + "/planned-visits";
    }

    private String visitBody(String name, Integer position, String activity) {
        String positionField = position == null ? "" : "\"position\":" + position + ",";
        return "{\"name\":\"" + name + "\",\"plannedDate\":\"2027-02-01\","
                + positionField + "\"activities\":[{\"name\":\"" + activity
                + "\",\"description\":\"Atividade de teste\"}]}";
    }

    private ResultActions create(String body) throws Exception {
        return mockMvc.perform(post(base()).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                .header(HttpHeaders.IF_MATCH, etag())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private Long version() {
        return studyRepository.findById(study.getId()).orElseThrow().getVersion();
    }

    private String etag() {
        return "\"" + version() + "\"";
    }

    private long idOf(ResultActions created) throws Exception {
        return objectMapper.readTree(created.andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
    }
}
