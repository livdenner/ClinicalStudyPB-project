package clinicalstudypb.candidates;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
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

class CandidateIntegrationTest extends IntegrationTestSupport {

    private static final String CANDIDATES_URL = "/api/studies/%d/candidates";

    @Autowired
    private CandidateRepository candidateRepository;

    private User coordinator;
    private User researcher;
    private Study study;
    private String coordinatorToken;
    private String researcherToken;

    @BeforeEach
    void setUp() throws Exception {
        coordinator = saveUser("Coordenadora", "candidate.coordinator@test.local", UserRole.COORDINATOR);
        researcher = saveUser("Pesquisador", "candidate.researcher@test.local", UserRole.RESEARCHER);
        study = saveStudy(StudyStatus.RECRUITMENT);
        coordinatorToken = tokenFor(coordinator.getEmail());
        researcherToken = tokenFor(researcher.getEmail());
    }

    @Test
    void createPersistsCandidateAndReturnsCreatedLocation() throws Exception {
        ResultActions response = create(study.getId(), "{\"name\":\"Ana Silva\",\"age\":42}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.studyId").value(study.getId()))
                .andExpect(jsonPath("$.name").value("Ana Silva"))
                .andExpect(jsonPath("$.age").value(42))
                .andExpect(jsonPath("$.eligibilityStatus").value("PENDING"));
        long candidateId = candidateId(response);
        response.andExpect(header().string("Location",
                "/api/studies/" + study.getId() + "/candidates/" + candidateId));

        Candidate saved = candidateRepository.findById(candidateId).orElseThrow();
        assertEquals(study.getId(), saved.getStudyId());
        assertEquals(EligibilityStatus.PENDING, saved.getEligibilityStatus());
    }

    @Test
    void acceptsMinimumAndMaximumContractAges() throws Exception {
        create(study.getId(), "{\"name\":\"Idade mínima\",\"age\":1}")
                .andExpect(status().isCreated());
        create(study.getId(), "{\"name\":\"Idade máxima\",\"age\":130}")
                .andExpect(status().isCreated());

        assertEquals(2, candidateRepository.count());
    }

    @Test
    void listAndGetReturnCandidatesForTheRequestedStudy() throws Exception {
        long candidateId = candidateId(create(study.getId(), "{\"name\":\"Ana Silva\",\"age\":42}")
                .andExpect(status().isCreated()));

        mockMvc.perform(get(candidatesUrl(study.getId()))
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(candidateId));

        mockMvc.perform(get(candidatesUrl(study.getId()) + "/" + candidateId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(candidateId))
                .andExpect(jsonPath("$.eligibilityStatus").value("PENDING"));
    }

    @Test
    void duplicateCandidateInSameStudyReturnsConflictWithoutAnotherRow() throws Exception {
        create(study.getId(), "{\"name\":\"Ana Silva\",\"age\":42}")
                .andExpect(status().isCreated());

        create(study.getId(), "{\"name\":\"  ANA   SILVA  \",\"age\":42}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Este candidato já está cadastrado no estudo."));

        assertEquals(1, candidateRepository.count());
    }

    @Test
    void sameCandidateCanBeRegisteredInDifferentStudiesAndListsRemainIsolated() throws Exception {
        Study otherStudy = saveStudy(StudyStatus.RECRUITMENT);
        Study emptyStudy = saveStudy(StudyStatus.RECRUITMENT);

        long firstCandidateId = candidateId(create(study.getId(), "{\"name\":\"Ana Silva\",\"age\":42}")
                .andExpect(status().isCreated()));
        long secondCandidateId = candidateId(create(otherStudy.getId(), "{\"name\":\"Ana Silva\",\"age\":42}")
                .andExpect(status().isCreated()));

        assertEquals(2, candidateRepository.count());
        assertEquals(1, candidateRepository.findAllByStudyIdOrderByIdAsc(study.getId()).size());
        assertEquals(1, candidateRepository.findAllByStudyIdOrderByIdAsc(otherStudy.getId()).size());

        mockMvc.perform(get(candidatesUrl(study.getId()))
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(firstCandidateId))
                .andExpect(jsonPath("$[0].studyId").value(study.getId()));
        mockMvc.perform(get(candidatesUrl(otherStudy.getId()))
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(secondCandidateId))
                .andExpect(jsonPath("$[0].studyId").value(otherStudy.getId()));
        mockMvc.perform(get(candidatesUrl(emptyStudy.getId()))
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void invalidRequiredFieldsReturnBadRequestWithoutPersistence() throws Exception {
        create(study.getId(), "{\"age\":42}")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Bad Request"))
                .andExpect(jsonPath("$.status").value(400));
        create(study.getId(), "{\"name\":\"Ana Silva\"}").andExpect(status().isBadRequest());
        create(study.getId(), "{\"name\":\"   \",\"age\":42}").andExpect(status().isBadRequest());
        create(study.getId(), "{\"name\":\"Ana Silva\",\"age\":0}")
                .andExpect(status().isBadRequest());
        create(study.getId(), "{\"name\":\"Ana Silva\",\"age\":-1}")
                .andExpect(status().isBadRequest());
        create(study.getId(), "{\"name\":\"Ana Silva\",\"age\":131}")
                .andExpect(status().isBadRequest());

        assertEquals(0, candidateRepository.count());
    }

    @Test
    void missingStudyReturnsNotFoundWithoutPersistence() throws Exception {
        create(999L, "{\"name\":\"Ana Silva\",\"age\":42}")
                .andExpect(status().isNotFound());

        assertEquals(0, candidateRepository.count());
    }

    @Test
    void missingCandidateOrCandidateFromAnotherStudyReturnsNotFound() throws Exception {
        Study otherStudy = saveStudy(StudyStatus.RECRUITMENT);
        long candidateId = candidateId(create(study.getId(), "{\"name\":\"Ana Silva\",\"age\":42}")
                .andExpect(status().isCreated()));

        mockMvc.perform(get(candidatesUrl(study.getId()) + "/999")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(candidatesUrl(otherStudy.getId()) + "/" + candidateId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(candidatesUrl(999L))
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    void candidateCannotBeRegisteredOutsideRecruitment() throws Exception {
        Study planningStudy = saveStudy(StudyStatus.PLANNING);

        create(planningStudy.getId(), "{\"name\":\"Ana Silva\",\"age\":42}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("O estudo não está aberto ao recrutamento."));

        assertEquals(0, candidateRepository.count());
    }

    @Test
    void coordinatorAndResponsibleResearcherCanReadButOnlyCoordinatorCanRegister() throws Exception {
        long candidateId = candidateId(create(study.getId(), "{\"name\":\"Ana Silva\",\"age\":42}")
                .andExpect(status().isCreated()));

        mockMvc.perform(get(candidatesUrl(study.getId()))
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(get(candidatesUrl(study.getId()) + "/" + candidateId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(candidateId));

        User otherResearcher = saveUser(
                "Outro pesquisador", "candidate.other-researcher@test.local", UserRole.RESEARCHER);
        String otherResearcherToken = tokenFor(otherResearcher.getEmail());
        mockMvc.perform(get(candidatesUrl(study.getId()))
                        .header(HttpHeaders.AUTHORIZATION, bearer(otherResearcherToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(candidatesUrl(study.getId()) + "/" + candidateId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(otherResearcherToken)))
                .andExpect(status().isForbidden());
        create(study.getId(), "{\"name\":\"Beatriz Costa\",\"age\":35}", researcherToken)
                .andExpect(status().isForbidden());
        mockMvc.perform(get(candidatesUrl(study.getId()))).andExpect(status().isUnauthorized());

        assertEquals(1, candidateRepository.count());
    }

    private Study saveStudy(StudyStatus status) {
        Study saved = new Study("Estudo", "Objetivo", researcher.getId(),
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20);
        if (status != StudyStatus.PLANNING) {
            saved.advanceStatus(StudyStatus.RECRUITMENT);
            if (status == StudyStatus.EXECUTION || status == StudyStatus.CLOSED) {
                saved.advanceStatus(StudyStatus.EXECUTION);
            }
            if (status == StudyStatus.CLOSED) {
                saved.advanceStatus(StudyStatus.CLOSED);
            }
            if (status == StudyStatus.CANCELLED) {
                saved.advanceStatus(StudyStatus.CANCELLED);
            }
        }
        return studyRepository.saveAndFlush(saved);
    }

    private String candidatesUrl(Long studyId) {
        return CANDIDATES_URL.formatted(studyId);
    }

    private ResultActions create(Long studyId, String body) throws Exception {
        return create(studyId, body, coordinatorToken);
    }

    private ResultActions create(Long studyId, String body, String token) throws Exception {
        return mockMvc.perform(post(candidatesUrl(studyId))
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private long candidateId(ResultActions result) throws Exception {
        String response = result.andReturn().getResponse().getContentAsString();
        assertNotNull(response);
        return objectMapper.readTree(response).get("id").asLong();
    }
}
