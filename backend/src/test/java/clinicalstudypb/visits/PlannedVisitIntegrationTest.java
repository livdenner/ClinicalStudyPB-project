package clinicalstudypb.visits;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import clinicalstudypb.visits.domain.PlannedVisit;
import clinicalstudypb.visits.infrastructure.PlannedVisitRepository;
import java.time.LocalDate;
import org.springframework.beans.factory.annotation.Autowired;
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

    @Autowired
    private PlannedVisitRepository visits;

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
    void jpaReadsVisitWithOrderedActivitiesAndStableIdentifiers() throws Exception {
        long visitId = idOf(create("""
                {"name":"Avaliação inicial","plannedDate":"2027-02-01",
                 "activities":[{"name":"Entrevista","description":"Histórico clínico"},
                               {"name":"Exame","description":"Exame físico"}]}
                """));

        PlannedVisit visit = visits.findByIdAndStudyId(visitId, study.getId()).orElseThrow();
        assertEquals(study.getId(), visit.getStudyId());
        assertEquals("Avaliação inicial", visit.getName());
        assertEquals(LocalDate.of(2027, 2, 1), visit.getPlannedDate());
        assertEquals(1, visit.getPosition());
        assertEquals(2, visit.getActivities().size());
        assertEquals("Entrevista", visit.getActivities().get(0).getName());
        assertEquals("entrevista", visit.getActivities().get(0).getNameKey());
        assertEquals(1, visit.getActivities().get(0).getPosition());
        assertEquals(visitId, visit.getActivities().get(0).getVisit().getId());
        assertEquals("Exame", visit.getActivities().get(1).getName());
        assertEquals(2, visit.getActivities().get(1).getPosition());
    }

    @Test
    void sameNamesAreAllowedInDifferentVisitsButPositionsRemainUnique() throws Exception {
        long first = idOf(create(visitBody("Acompanhamento", null, "Exame")));
        long second = idOf(create(visitBody("Acompanhamento", null, "Exame")));

        mockMvc.perform(get(base()).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(first))
                .andExpect(jsonPath("$[0].position").value(1))
                .andExpect(jsonPath("$[1].id").value(second))
                .andExpect(jsonPath("$[1].position").value(2));
        assertEquals(2, visits.findByStudyIdOrderByPositionAsc(study.getId()).size());
    }

    @Test
    void deletingVisitClosesThePositionGap() throws Exception {
        long first = idOf(create(visitBody("Primeira", null, "Entrevista")));
        long second = idOf(create(visitBody("Segunda", null, "Exame")));

        mockMvc.perform(delete(base() + "/" + first)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .header(HttpHeaders.IF_MATCH, etag()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(base()).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(second))
                .andExpect(jsonPath("$[0].position").value(1));
        assertEquals(1, visits.findByStudyIdOrderByPositionAsc(study.getId()).getFirst().getPosition());
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
    void updatingVisitReordersActivitiesWithoutReplacingTheirIds() throws Exception {
        long visitId = idOf(create("""
                {"name":"Inicial","plannedDate":"2027-02-01",
                 "activities":[{"name":"Entrevista","description":"Histórico"},
                               {"name":"Exame","description":"Exame físico"}]}
                """));
        var original = objectMapper.readTree(mockMvc.perform(get(base() + "/" + visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andReturn().getResponse().getContentAsString());
        long first = original.get("activities").get(0).get("id").asLong();
        long second = original.get("activities").get(1).get("id").asLong();

        mockMvc.perform(put(base() + "/" + visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .header(HttpHeaders.IF_MATCH, etag())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Inicial","plannedDate":"2027-02-01",
                                 "activities":[{"id":%d,"name":"Exame","description":"Exame físico"},
                                               {"id":%d,"name":"Entrevista","description":"Histórico"}]}
                                """.formatted(second, first)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activities[0].id").value(second))
                .andExpect(jsonPath("$.activities[0].position").value(1))
                .andExpect(jsonPath("$.activities[1].id").value(first))
                .andExpect(jsonPath("$.activities[1].position").value(2));

        PlannedVisit reloaded = visits.findByIdAndStudyId(visitId, study.getId()).orElseThrow();
        assertEquals(second, reloaded.getActivities().get(0).getId());
        assertEquals(first, reloaded.getActivities().get(1).getId());
    }

    @Test
    void invalidActivityIdRollsBackVisitAndActivityChanges() throws Exception {
        long visitId = idOf(create(visitBody("Original", null, "Entrevista")));
        String path = base() + "/" + visitId;

        mockMvc.perform(put(path)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .header(HttpHeaders.IF_MATCH, etag())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Não persistir","plannedDate":"2027-03-01",
                                 "activities":[{"id":999999,"name":"Exame","description":"Inválida"}]}
                                """))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Original"))
                .andExpect(jsonPath("$.plannedDate").value("2027-02-01"))
                .andExpect(jsonPath("$.activities.length()").value(1))
                .andExpect(jsonPath("$.activities[0].name").value("Entrevista"));
    }

    @Test
    void recruitmentCannotDeleteItsLastPlannedVisit() throws Exception {
        long visitId = idOf(create(visitBody("Única visita", null, "Entrevista")));
        Study current = studyRepository.findById(study.getId()).orElseThrow();
        current.advanceStatus(StudyStatus.RECRUITMENT);
        studyRepository.saveAndFlush(current);

        mockMvc.perform(delete(base() + "/" + visitId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .header(HttpHeaders.IF_MATCH, etag()))
                .andExpect(status().isConflict());
        mockMvc.perform(get(base()).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(jsonPath("$.length()").value(1));
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
