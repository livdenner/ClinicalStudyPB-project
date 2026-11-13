package clinicalstudypb.criteria;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.EligibilityAnswer;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.candidates.infrastructure.EligibilityAnswerRepository;
import clinicalstudypb.criteria.domain.CriterionType;
import clinicalstudypb.criteria.domain.StudyCriterion;
import clinicalstudypb.criteria.infrastructure.StudyCriterionRepository;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Verifica o contrato HTTP de critérios, persistência, estados e autorização por perfil.
 *
 * @author Lívia
 */
class StudyCriterionIntegrationTest extends IntegrationTestSupport {

    private static final String PATH = "/api/studies/%d/criteria";

    @Autowired
    private StudyCriterionRepository criterionRepository;

    @Autowired
    private CandidateRepository candidateRepository;

    @Autowired
    private EligibilityAnswerRepository answerRepository;

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

    @ParameterizedTest
    @EnumSource(value = StudyStatus.class, names = {"PLANNING", "RECRUITMENT"})
    void researcherCreatesBothCriterionTypesAndReadsThem(StudyStatus studyStatus) throws Exception {
        if (studyStatus == StudyStatus.RECRUITMENT) {
            study.advanceStatus(studyStatus);
            studyRepository.saveAndFlush(study);
        }
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
        mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        mockMvc.perform(get(path() + "/" + inclusionId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(inclusionId));
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
        mockMvc.perform(post(path()).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"INCLUSION\"}"))
                .andExpect(status().isBadRequest());

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

    @ParameterizedTest
    @EnumSource(value = StudyStatus.class, names = {"EXECUTION", "CLOSED", "CANCELLED"})
    void protocolChangeIsBlockedOutsideEditableStudyStates(StudyStatus studyStatus) throws Exception {
        Study nonEditableStudy = saveStudy(studyStatus, researcher);

        create("INCLUSION", "Idade mínima", researcherToken, nonEditableStudy.getId())
                .andExpect(status().isConflict());

        assertEquals(0, criterionRepository.count());
    }

    @Test
    void addingCriterionAfterFirstEligibilityResponseReturnsConflictWithoutPersistence() throws Exception {
        StudyCriterion existingCriterion = criterionRepository.saveAndFlush(
                new StudyCriterion(study.getId(), CriterionType.INCLUSION, "Idade mínima"));
        Candidate candidate = candidateRepository.saveAndFlush(
                new Candidate(study.getId(), "Ana Silva", "ana silva", 42,
                        participant.getEmail(), "83999990000", participant.getId()));
        answerRepository.saveAndFlush(new EligibilityAnswer(
                candidate.getId(), existingCriterion.getId(), true));

        create("EXCLUSION", "Condição clínica X")
                .andExpect(status().isConflict());

        assertEquals(1, criterionRepository.count());
    }

    @Test
    void criterionFromAnotherStudyIsNotFound() throws Exception {
        long criterionId = criterionId(create("INCLUSION", "Idade mínima")
                .andExpect(status().isCreated()));
        Study otherStudy = saveStudy(StudyStatus.PLANNING, researcher);

        mockMvc.perform(get(PATH.formatted(otherStudy.getId()) + "/" + criterionId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isNotFound());
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

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = {"ADMINISTRATOR", "PARTICIPANT"})
    void unauthorizedProfilesCannotCreateListOrReadCriteria(UserRole role) throws Exception {
        long existingId = criterionId(create("INCLUSION", "Idade mínima").andExpect(status().isCreated()));
        String deniedToken = role == UserRole.PARTICIPANT ? participantToken
                : tokenFor(saveUser("Administrador", "criteria.admin@test.local", role).getEmail());

        create("EXCLUSION", "Condição clínica válida", deniedToken).andExpect(status().isForbidden());
        mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, bearer(deniedToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(path() + "/" + existingId).header(HttpHeaders.AUTHORIZATION, bearer(deniedToken)))
                .andExpect(status().isForbidden());

        assertEquals(1, criterionRepository.count());
        assertEquals(List.of(existingId), criterionRepository.findAllByStudyIdOrderByIdAsc(study.getId())
                .stream().map(StudyCriterion::getId).toList());
    }

    @Test
    void anonymousRequestsCannotCreateListOrReadCriteria() throws Exception {
        mockMvc.perform(post(path()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"INCLUSION\",\"description\":\"Idade mínima\"}"))
                .andExpect(status().isUnauthorized());
        assertEquals(0, criterionRepository.count());

        long existingId = criterionId(create("INCLUSION", "Idade mínima").andExpect(status().isCreated()));
        mockMvc.perform(get(path())).andExpect(status().isUnauthorized());
        mockMvc.perform(get(path() + "/" + existingId)).andExpect(status().isUnauthorized());
        assertEquals(1, criterionRepository.count());
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
        Study saved = new Study("Estudo de critérios", "Objetivo", responsible.getId(),
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
        if (status == StudyStatus.CANCELLED) {
            saved.advanceStatus(StudyStatus.CANCELLED);
        }
        return studyRepository.saveAndFlush(saved);
    }

    private String path() {
        return PATH.formatted(study.getId());
    }
}
