package clinicalstudypb.criteria;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.criteria.domain.CriterionType;
import clinicalstudypb.criteria.domain.StudyCriterion;
import clinicalstudypb.criteria.infrastructure.StudyCriterionRepository;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class StudyCriterionIntegrationTest extends IntegrationTestSupport {

    private static final String PATH = "/api/studies/%d/criteria";

    @Autowired
    private StudyCriterionRepository criterionRepository;

    private User researcher;
    private User coordinator;
    private User participant;
    private Study study;
    private String researcherToken;
    private String coordinatorToken;
    private String participantToken;

    @BeforeEach
    void setUp() throws Exception {
        researcher = saveUser("Pesquisador", "criteria.researcher@test.local", UserRole.RESEARCHER);
        coordinator = saveUser("Coordenador", "criteria.coordinator@test.local", UserRole.COORDINATOR);
        participant = saveUser("Participante", "criteria.participant@test.local", UserRole.PARTICIPANT);
        study = saveStudy(StudyStatus.PLANNING, researcher);
        researcherToken = tokenFor(researcher.getEmail());
        coordinatorToken = tokenFor(coordinator.getEmail());
        participantToken = tokenFor(participant.getEmail());
    }

    @Test
    void researcherCreatesBothCriterionTypesAndReadsThem() throws Exception {
        long inclusionId = criterionId(create("INCLUSION", "Idade mínima de 18 anos")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("INCLUSION")));
        create("EXCLUSION", "Condição clínica X")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("EXCLUSION"));

        mockMvc.perform(get(path())
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
        mockMvc.perform(get(path() + "/" + inclusionId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(inclusionId))
                .andExpect(jsonPath("$.studyId").value(study.getId()));
        assertEquals(2, criterionRepository.count());
    }

    @Test
    void emptyStudyReturnsAnEmptyCriteriaList() throws Exception {
        mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void invalidTypeAndRequiredDescriptionsReturnBadRequestWithoutPersistence() throws Exception {
        create("INVALID", "Descrição válida").andExpect(status().isBadRequest());
        createWithoutType("Descrição válida").andExpect(status().isBadRequest());
        create("INCLUSION", "").andExpect(status().isBadRequest());
        create("EXCLUSION", "   ").andExpect(status().isBadRequest());
        create("INCLUSION", "x".repeat(501)).andExpect(status().isBadRequest());

        assertEquals(0, criterionRepository.count());
    }

    @Test
    void nonexistentStudyReturnsNotFoundWithoutPersistence() throws Exception {
        mockMvc.perform(post(PATH.formatted(999L))
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"type":"INCLUSION","description":"Idade mínima"}
                                """))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(PATH.formatted(999L))
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isNotFound());

        assertEquals(0, criterionRepository.count());
    }

    @Test
    void onlyResearcherCanWriteAndOnlyAuthorizedProfilesCanRead() throws Exception {
        create("INCLUSION", "Idade mínima").andExpect(status().isCreated());
        User otherResearcher = saveUser(
                "Outro pesquisador", "criteria.other-researcher@test.local", UserRole.RESEARCHER);
        Study otherResearcherStudy = saveStudy(StudyStatus.PLANNING, otherResearcher);

        create("EXCLUSION", "Condição clínica", coordinatorToken).andExpect(status().isForbidden());
        create("EXCLUSION", "Condição clínica", participantToken).andExpect(status().isForbidden());
        mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, bearer(participantToken)))
                .andExpect(status().isForbidden());
        create("EXCLUSION", "Condição clínica", researcherToken, otherResearcherStudy.getId())
                .andExpect(status().isForbidden());
        mockMvc.perform(get(path())).andExpect(status().isUnauthorized());

        assertEquals(1, criterionRepository.count());
    }

    @Test
    void protocolChangeIsBlockedOutsideEditableStudyStates() throws Exception {
        Study executionStudy = saveStudy(StudyStatus.EXECUTION, researcher);

        create("INCLUSION", "Idade mínima", researcherToken, executionStudy.getId())
                .andExpect(status().isConflict());

        assertEquals(0, criterionRepository.count());
    }

    @Test
    void readsStudyCriteriaInStableOrder() throws Exception {
        criterionRepository.saveAndFlush(
                new StudyCriterion(study.getId(), CriterionType.INCLUSION, "Primeiro critério"));
        criterionRepository.saveAndFlush(
                new StudyCriterion(study.getId(), CriterionType.EXCLUSION, "Segundo critério"));

        mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].description").value("Primeiro critério"))
                .andExpect(jsonPath("$[1].description").value("Segundo critério"));
    }

    private ResultActions create(String type, String description) throws Exception {
        return create(type, description, researcherToken, study.getId());
    }

    private ResultActions create(String type, String description, String token) throws Exception {
        return create(type, description, token, study.getId());
    }

    private ResultActions create(String type, String description, String token, Long studyId) throws Exception {
        String body = "{\"type\":\"" + type + "\",\"description\":\"" + description + "\"}";
        return mockMvc.perform(post(PATH.formatted(studyId))
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private ResultActions createWithoutType(String description) throws Exception {
        return mockMvc.perform(post(path())
                .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"" + description + "\"}"));
    }

    private long criterionId(ResultActions result) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString())
                .get("id").asLong();
    }

    private Study saveStudy(StudyStatus status, User responsible) {
        Study saved = new Study("Estudo " + System.nanoTime(), "Objetivo", responsible.getId(),
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20);
        if (status == StudyStatus.RECRUITMENT || status == StudyStatus.EXECUTION
                || status == StudyStatus.CLOSED) {
            saved.advanceStatus(StudyStatus.RECRUITMENT);
        }
        if (status == StudyStatus.EXECUTION || status == StudyStatus.CLOSED) {
            saved.advanceStatus(StudyStatus.EXECUTION);
        }
        if (status == StudyStatus.CLOSED) {
            saved.advanceStatus(StudyStatus.CLOSED);
        }
        return studyRepository.saveAndFlush(saved);
    }

    private String path() {
        return PATH.formatted(study.getId());
    }
}
