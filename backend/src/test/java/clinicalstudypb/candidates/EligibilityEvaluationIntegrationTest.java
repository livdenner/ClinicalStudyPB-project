package clinicalstudypb.candidates;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.Mockito.when;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.EligibilityEvaluation;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.candidates.infrastructure.EligibilityAnswerRepository;
import clinicalstudypb.candidates.infrastructure.EligibilityEvaluationRepository;
import clinicalstudypb.criteria.domain.CriterionType;
import clinicalstudypb.criteria.domain.StudyCriterion;
import clinicalstudypb.criteria.infrastructure.StudyCriterionRepository;
import clinicalstudypb.participants.domain.Participant;
import clinicalstudypb.participants.infrastructure.ParticipantRepository;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Valida o contrato RF09 por HTTP com JWT, migrações e PostgreSQL reais.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
class EligibilityEvaluationIntegrationTest extends IntegrationTestSupport {

    private static final Instant NOW = Instant.parse("2026-11-08T12:30:00.123456Z");

    @Autowired
    private CandidateRepository candidateRepository;
    @Autowired
    private StudyCriterionRepository criterionRepository;
    @Autowired
    private EligibilityAnswerRepository answerRepository;
    @Autowired
    private EligibilityEvaluationRepository evaluationRepository;
    @Autowired
    private ParticipantRepository participantRepository;
    @MockitoBean(name = "eligibilityClock")
    private Clock clock;

    private User researcher;
    private User coordinator;
    private String coordinatorToken;
    private Study study;
    private Candidate candidate;
    private List<StudyCriterion> criteria;

    @BeforeEach
    void setUp() throws Exception {
        researcher = saveUser("Pesquisadora", "eligibility.researcher@test.local", UserRole.RESEARCHER);
        coordinator = saveUser("Coordenadora", "eligibility.coordinator@test.local", UserRole.COORDINATOR);
        coordinatorToken = tokenFor(coordinator.getEmail());
        study = saveStudy("Estudo de elegibilidade");
        candidate = saveCandidate(study);
        criteria = criterionRepository.saveAllAndFlush(List.of(
                new StudyCriterion(study.getId(), CriterionType.INCLUSION, "Inclusão A"),
                new StudyCriterion(study.getId(), CriterionType.INCLUSION, "Inclusão B"),
                new StudyCriterion(study.getId(), CriterionType.EXCLUSION, "Exclusão A"),
                new StudyCriterion(study.getId(), CriterionType.EXCLUSION, "Exclusão B")));
        when(clock.instant()).thenReturn(NOW);
    }

    @Test
    void beforeFirstEvaluationReturnsPendingWithNoAnswersOrTimestamp() throws Exception {
        mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studyId").value(study.getId()))
                .andExpect(jsonPath("$.candidateId").value(candidate.getId()))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.answers").isEmpty())
                .andExpect(jsonPath("$.evaluatedAt").doesNotHaveJsonPath());
        assertEquals(0, evaluationRepository.count());
    }

    @ParameterizedTest
    @CsvSource({"true,true,false,false,ELIGIBLE", "false,true,false,false,INELIGIBLE",
                "true,false,false,false,INELIGIBLE", "true,true,true,false,INELIGIBLE",
                "true,true,false,true,INELIGIBLE"})
    void completeEvaluationPersistsResultAndAuthenticatedAuthor(boolean firstInclusion, boolean secondInclusion,
            boolean firstExclusion, boolean secondExclusion, EligibilityStatus expected) throws Exception {
        evaluate(body(firstInclusion, secondInclusion, firstExclusion, secondExclusion))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(expected.name()))
                .andExpect(jsonPath("$.answers.length()").value(4))
                .andExpect(jsonPath("$.answers[0].criterionId").value(criteria.get(0).getId()))
                .andExpect(jsonPath("$.answers[0].matches").value(firstInclusion))
                .andExpect(jsonPath("$.answers[1].matches").value(secondInclusion))
                .andExpect(jsonPath("$.answers[2].matches").value(firstExclusion))
                .andExpect(jsonPath("$.answers[3].matches").value(secondExclusion))
                .andExpect(jsonPath("$.evaluatedAt").value(NOW.toString()));

        assertEquals(expected, candidateRepository.findById(candidate.getId()).orElseThrow().getEligibilityStatus());
        EligibilityEvaluation saved = evaluationRepository.findById(candidate.getId()).orElseThrow();
        assertEquals(candidate.getId(), saved.getCandidateId());
        assertEquals(coordinator.getId(), saved.getEvaluatedBy());
        assertEquals(NOW, saved.getEvaluatedAt());
        assertEquals(4, answerRepository.count());
        assertEquals(expected.name(), currentEvaluation().get("status").asText());
    }

    @ParameterizedTest
    @CsvSource({"INCLUSION,true,ELIGIBLE", "INCLUSION,false,INELIGIBLE",
                "EXCLUSION,false,ELIGIBLE", "EXCLUSION,true,INELIGIBLE"})
    void singleCriterionStudyCanBeEvaluated(CriterionType type, boolean matches,
                                            EligibilityStatus expected) throws Exception {
        criterionRepository.deleteAll(criteria);
        StudyCriterion single = criterionRepository.saveAndFlush(new StudyCriterion(study.getId(), type, "Único"));
        String request = objectMapper.writeValueAsString(Map.of("answers", List.of(
                Map.of("criterionId", single.getId(), "matches", matches))));

        evaluate(request).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(expected.name()))
                .andExpect(jsonPath("$.answers.length()").value(1));

        assertEquals(expected, candidateRepository.findById(candidate.getId()).orElseThrow().getEligibilityStatus());
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 2, 3})
    void everyMissingCriterionKeepsPendingEvenWhenOtherAnswersFail(int missingIndex) throws Exception {
        List<Map<String, Object>> answers = answers(false, false, true, true);
        answers.remove(missingIndex);

        evaluate(objectMapper.writeValueAsString(Map.of("answers", answers)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.answers.length()").value(3));

        assertEquals(EligibilityStatus.PENDING,
                candidateRepository.findById(candidate.getId()).orElseThrow().getEligibilityStatus());
    }

    @Test
    void replacementRemovesOmittedAnswersAndUpdatesAuthorAndTimestamp() throws Exception {
        evaluate(body(true, true, false, false)).andExpect(status().isOk());
        User otherCoordinator = saveUser("Outro coordenador", "eligibility.other@test.local", UserRole.COORDINATOR);
        String otherToken = tokenFor(otherCoordinator.getEmail());
        Instant later = NOW.plusSeconds(60);
        when(clock.instant()).thenReturn(later);
        String partial = objectMapper.writeValueAsString(Map.of("answers", List.of(
                Map.of("criterionId", criteria.get(0).getId(), "matches", true))));

        mockMvc.perform(put(path()).header(HttpHeaders.AUTHORIZATION, bearer(otherToken))
                        .contentType(MediaType.APPLICATION_JSON).content(partial))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.answers.length()").value(1))
                .andExpect(jsonPath("$.answers[0].criterionId").value(criteria.get(0).getId()))
                .andExpect(jsonPath("$.evaluatedAt").value(later.toString()));

        assertEquals(1, answerRepository.count());
        assertEquals(1, evaluationRepository.count());
        assertEquals(EligibilityStatus.PENDING,
                candidateRepository.findById(candidate.getId()).orElseThrow().getEligibilityStatus());
        assertEquals(otherCoordinator.getId(),
                evaluationRepository.findById(candidate.getId()).orElseThrow().getEvaluatedBy());
        assertEquals(later.toString(), currentEvaluation().get("evaluatedAt").asText());
    }

    @ParameterizedTest
    @MethodSource("invalidPayloads")
    void invalidPayloadPreservesPreviouslyStoredEvaluation(String template) throws Exception {
        evaluate(body(true, true, false, false)).andExpect(status().isOk());
        JsonNode before = currentEvaluation();

        evaluate(template.formatted(criteria.get(0).getId(), criteria.get(0).getId()))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400));

        assertEquals(before, currentEvaluation());
        assertEquals(4, answerRepository.count());
        assertEquals(1, evaluationRepository.count());
    }

    @Test
    void criterionFromAnotherStudyIsRejectedWithoutReplacingExistingAnswers() throws Exception {
        evaluate(body(true, true, false, false)).andExpect(status().isOk());
        JsonNode before = currentEvaluation();
        Study otherStudy = saveStudy("Outro estudo");
        StudyCriterion foreign = criterionRepository.saveAndFlush(
                new StudyCriterion(otherStudy.getId(), CriterionType.INCLUSION, "Outro protocolo"));
        String invalid = objectMapper.writeValueAsString(Map.of("answers", List.of(
                Map.of("criterionId", criteria.get(0).getId(), "matches", false),
                Map.of("criterionId", foreign.getId(), "matches", true))));

        evaluate(invalid).andExpect(status().isBadRequest());

        assertEquals(before, currentEvaluation());
        assertEquals(4, answerRepository.count());
    }

    @ParameterizedTest
    @ValueSource(strings = {"study", "candidate", "another-study"})
    void missingResourcesOrCandidateOutsideRouteReturnNotFound(String scenario) throws Exception {
        Long studyId = scenario.equals("study") ? 999999L : study.getId();
        Long candidateId = scenario.equals("candidate") ? 999999L : candidate.getId();
        if (scenario.equals("another-study")) {
            studyId = saveStudy("Outro estudo da rota").getId();
        }
        String target = path(studyId, candidateId);

        mockMvc.perform(get(target).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isNotFound());
        mockMvc.perform(put(target).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON).content(body(true, true, false, false)))
                .andExpect(status().isNotFound());

        assertEquals(0, answerRepository.count());
        assertEquals(0, evaluationRepository.count());
    }

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = "COORDINATOR", mode = EnumSource.Mode.EXCLUDE)
    void onlyCoordinatorCanReadAndWriteEligibility(UserRole role) throws Exception {
        User user = role == UserRole.RESEARCHER ? researcher
                : saveUser("Perfil sem acesso", role.name().toLowerCase(java.util.Locale.ROOT) + "@test.local", role);
        String token = tokenFor(user.getEmail());

        mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden());
        mockMvc.perform(put(path()).header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(body(true, true, false, false)))
                .andExpect(status().isForbidden());

        assertEquals(0, answerRepository.count());
        assertEquals(0, evaluationRepository.count());
    }

    @Test
    void anonymousRequestsAreUnauthorized() throws Exception {
        mockMvc.perform(get(path())).andExpect(status().isUnauthorized());
        mockMvc.perform(put(path()).contentType(MediaType.APPLICATION_JSON).content(body(true, true, false, false)))
                .andExpect(status().isUnauthorized());
        assertEquals(0, answerRepository.count());
    }

    @Test
    void studyWithoutCriteriaCannotBeEvaluated() throws Exception {
        Study emptyStudy = saveStudy("Sem critérios");
        Candidate otherCandidate = saveCandidate(emptyStudy);
        String target = path(emptyStudy.getId(), otherCandidate.getId());

        mockMvc.perform(put(target).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON).content(body(true, true, false, false)))
                .andExpect(status().isConflict());
        mockMvc.perform(get(target).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING"));
        assertEquals(0, answerRepository.count());
        assertEquals(0, evaluationRepository.count());
    }

    @Test
    void includedCandidateCannotBeReevaluatedAndKeepsItsStoredEvaluation() throws Exception {
        evaluate(body(true, true, false, false)).andExpect(status().isOk());
        JsonNode before = currentEvaluation();
        Participant participant = participantRepository.saveAndFlush(
                new Participant(study.getId(), candidate.getId(), coordinator.getId(), NOW));

        evaluate(body(false, true, false, false)).andExpect(status().isConflict());

        assertEquals(before, currentEvaluation());
        Participant saved = participantRepository.findById(participant.getId()).orElseThrow();
        assertEquals(study.getId(), saved.getStudyId());
        assertEquals(candidate.getId(), saved.getCandidateId());
        assertEquals(coordinator.getId(), saved.getIncludedBy());
        assertEquals(NOW, saved.getIncludedAt());
    }

    @Test
    void firstAnswerPreventsAddingMoreCriteriaToStudyProtocol() throws Exception {
        evaluate(objectMapper.writeValueAsString(Map.of("answers", List.of(
                Map.of("criterionId", criteria.get(0).getId(), "matches", true)))))
                .andExpect(status().isOk());
        String researcherToken = tokenFor(researcher.getEmail());

        mockMvc.perform(post("/api/studies/{studyId}/criteria", study.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"EXCLUSION\",\"description\":\"Critério tardio\"}"))
                .andExpect(status().isConflict());

        assertEquals(4, criterionRepository.count());
        assertEquals(1, answerRepository.count());
    }

    @Test
    void swaggerExposesBothOperationsAndRequiresAtLeastOneAnswer() throws Exception {
        String root = "$.paths['/api/studies/{studyId}/candidates/{candidateId}/eligibility']";
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath(root + ".get.responses['200']").exists())
                .andExpect(jsonPath(root + ".put.responses['409']").exists())
                .andExpect(jsonPath("$.components.schemas.EligibilityEvaluationWriteRequest"
                        + ".properties.answers.minItems").value(1));
    }

    private Study saveStudy(String title) {
        return studyRepository.saveAndFlush(new Study(title, "Objetivo", researcher.getId(),
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20));
    }

    private Candidate saveCandidate(Study owner) {
        return candidateRepository.saveAndFlush(new Candidate(owner.getId(), "Ana Silva", "ana silva", 42));
    }

    private String path() {
        return path(study.getId(), candidate.getId());
    }

    private String path(Long studyId, Long candidateId) {
        return "/api/studies/" + studyId + "/candidates/" + candidateId + "/eligibility";
    }

    private List<Map<String, Object>> answers(boolean... matches) {
        List<Map<String, Object>> answers = new ArrayList<>();
        for (int index = 0; index < matches.length; index++) {
            answers.add(Map.of("criterionId", criteria.get(index).getId(), "matches", matches[index]));
        }
        return answers;
    }

    private String body(boolean... matches) throws Exception {
        return objectMapper.writeValueAsString(Map.of("answers", answers(matches)));
    }

    private ResultActions evaluate(String body) throws Exception {
        return mockMvc.perform(put(path()).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private JsonNode currentEvaluation() throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(path())
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private static Stream<String> invalidPayloads() {
        return Stream.of("{}", "{\"answers\":null}", "{\"answers\":[]}", "{\"answers\":[null]}",
                "{\"answers\":[{\"matches\":true}]}", "{\"answers\":[{\"criterionId\":%d}]}",
                "{\"answers\":[{\"criterionId\":%d,\"matches\":null}]}",
                "{\"answers\":[{\"criterionId\":0,\"matches\":true}]}",
                "{\"answers\":[{\"criterionId\":-1,\"matches\":true}]}",
                "{\"answers\":[{\"criterionId\":999999,\"matches\":true}]}",
                "{\"answers\":[{\"criterionId\":%d,\"matches\":false},{\"criterionId\":%d,\"matches\":true}]}");
    }
}
