package clinicalstudypb.candidates;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.candidates.infrastructure.CandidateActivationInviteRepository;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Verifica regras, isolamento por estudo e permissões da API de candidatos com PostgreSQL real.
 *
 * @author Lívia
 */
class CandidateIntegrationTest extends IntegrationTestSupport {

    private static final String CANDIDATES_URL = "/api/studies/%d/candidates";

    @Autowired
    private CandidateRepository candidateRepository;

    @Autowired
    private CandidateActivationInviteRepository invitationRepository;

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
                .andExpect(jsonPath("$.userId").isNumber())
                .andExpect(jsonPath("$.status").value("INVITED"))
                .andExpect(jsonPath("$.activation.activationCode").isString())
                .andExpect(jsonPath("$.eligibilityStatus").value("PENDING"));
        long candidateId = candidateId(response);
        response.andExpect(header().string("Location",
                "/api/studies/" + study.getId() + "/candidates/" + candidateId));

        Candidate saved = candidateRepository.findById(candidateId).orElseThrow();
        assertEquals(study.getId(), saved.getStudyId());
        assertEquals(EligibilityStatus.PENDING, saved.getEligibilityStatus());
        User invited = userRepository.findByEmailIgnoreCase(saved.getEmail()).orElseThrow();
        assertFalse(invited.isActive());
        assertEquals(UserRole.PARTICIPANT, invited.getRole());
        String issuedCode = objectMapper.readTree(response.andReturn().getResponse().getContentAsString())
                .path("activation").path("activationCode").asText();
        assertFalse(invitationRepository.findById(invited.getId()).orElseThrow()
                .getCodeHash().contains(issuedCode));
        mockMvc.perform(get(candidatesUrl(study.getId()) + "/" + candidateId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(jsonPath("$.activation.activationCode").doesNotExist());
    }

    @Test
    void existingActiveParticipantIsLinkedWithoutNewAccountOrCode() throws Exception {
        User participant = saveUser("Ana", "ana.existing@test.local", UserRole.PARTICIPANT);
        long beforeUsers = userRepository.count();
        create(study.getId(), "{\"name\":\"Ana\",\"age\":42,"
                + "\"email\":\"ANA.EXISTING@test.local\",\"phone\":\"83999990000\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(participant.getId()))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.activation").doesNotExist());
        assertEquals(beforeUsers, userRepository.count());
        assertFalse(invitationRepository.existsById(participant.getId()));
    }

    @Test
    void staffEmailIsRejectedWithoutCreatingCandidate() throws Exception {
        long beforeUsers = userRepository.count();
        create(study.getId(), "{\"name\":\"Pesquisador\",\"age\":42,"
                + "\"email\":\"CANDIDATE.RESEARCHER@test.local\",\"phone\":\"83999990000\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_BELONGS_TO_STAFF"));
        assertEquals(0, candidateRepository.count());
        assertEquals(beforeUsers, userRepository.count());
    }

    @Test
    void newCodeInvalidatesPreviousCodeAndIsNeverReturnedByGet() throws Exception {
        ResultActions created = create(study.getId(), "{\"name\":\"Ana\",\"age\":42}")
                .andExpect(status().isCreated());
        long candidateId = candidateId(created);
        String oldCode = objectMapper.readTree(created.andReturn().getResponse().getContentAsString())
                .path("activation").path("activationCode").asText();
        Long userId = candidateRepository.findById(candidateId).orElseThrow().getUserId();
        String oldHash = invitationRepository.findById(userId).orElseThrow().getCodeHash();

        String refreshed = mockMvc.perform(post(candidatesUrl(study.getId()) + "/" + candidateId
                        + "/activation-code").header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activationCode").isString())
                .andReturn().getResponse().getContentAsString();
        String newCode = objectMapper.readTree(refreshed).path("activationCode").asText();
        assertNotEquals(oldCode, newCode);
        assertNotEquals(oldHash, invitationRepository.findById(userId).orElseThrow().getCodeHash());
        mockMvc.perform(get(candidatesUrl(study.getId()) + "/" + candidateId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(jsonPath("$.activation.activationCode").doesNotExist());
        assertTrue(invitationRepository.existsById(userId));
    }

    @Test
    void invalidEmailAndPhoneDoNotCreateAccountsOrCandidates() throws Exception {
        long beforeUsers = userRepository.count();
        create(study.getId(), "{\"name\":\"Ana\",\"age\":42,"
                + "\"email\":\"invalido\",\"phone\":\"83999990000\"}")
                .andExpect(status().isBadRequest());
        create(study.getId(), "{\"name\":\"Ana\",\"age\":42,"
                + "\"email\":\"ana@test.local\",\"phone\":\"123\"}")
                .andExpect(status().isBadRequest());
        create(study.getId(), "{\"name\":\"Ana\",\"age\":42,"
                + "\"email\":\"ana@test.local\",\"phone\":\"+        \"}")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        create(study.getId(), "{\"name\":\"Ana\",\"age\":42,"
                + "\"email\":\"ana@test.local\",\"phone\":\"--------\"}")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        assertEquals(beforeUsers, userRepository.count());
        assertEquals(0, candidateRepository.count());
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
                .andExpect(jsonPath("$.code").value("CANDIDATE_ALREADY_IN_STUDY"));

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
                .andExpect(jsonPath("$.code").value("STUDY_NOT_RECRUITING"));

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

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = {"ADMINISTRATOR", "PARTICIPANT"})
    void unauthorizedProfilesCannotRegisterListOrReadCandidate(UserRole role) throws Exception {
        long existingCandidateId = candidateId(create(study.getId(), "{\"name\":\"Ana Silva\",\"age\":42}")
                .andExpect(status().isCreated()));
        User deniedUser = saveUser("Perfil sem acesso", "candidate.denied."
                + role.name().toLowerCase(Locale.ROOT) + "@test.local", role);
        String deniedToken = tokenFor(deniedUser.getEmail());

        create(study.getId(), "{\"name\":\"Beatriz Costa\",\"age\":35}", deniedToken)
                .andExpect(status().isForbidden());
        mockMvc.perform(get(candidatesUrl(study.getId()))
                        .header(HttpHeaders.AUTHORIZATION, bearer(deniedToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(candidatesUrl(study.getId()) + "/" + existingCandidateId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(deniedToken)))
                .andExpect(status().isForbidden());

        assertEquals(1, candidateRepository.count());
        assertEquals(List.of(existingCandidateId), candidateRepository.findAllByStudyIdOrderByIdAsc(study.getId())
                .stream().map(Candidate::getId).toList());
    }

    @Test
    void anonymousRegistrationReturnsUnauthorizedWithoutCreatingCandidate() throws Exception {
        mockMvc.perform(post(candidatesUrl(study.getId()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Beatriz Costa\",\"age\":35}"))
                .andExpect(status().isUnauthorized());

        assertEquals(0, candidateRepository.count());
    }

    @Test
    void cancelUpdatesStatusInvalidatesInviteAndAllowsReregistration() throws Exception {
        ResultActions created = create(study.getId(), "{\"name\":\"Ana Silva\",\"age\":42}")
                .andExpect(status().isCreated());
        long firstCandidateId = candidateId(created);
        Long userId = candidateRepository.findById(firstCandidateId).orElseThrow().getUserId();
        assertTrue(invitationRepository.existsById(userId));

        mockMvc.perform(post(candidatesUrl(study.getId()) + "/" + firstCandidateId + "/cancellation")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"  E-mail errado  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.activation").doesNotExist())
                .andExpect(jsonPath("$.cancellation.reason").value("E-mail errado"))
                .andExpect(jsonPath("$.cancellation.cancelledAt").isString())
                .andExpect(jsonPath("$.cancellation.cancelledByUserId").value(coordinator.getId()));

        User user = userRepository.findById(userId).orElseThrow();
        assertFalse(user.isActive());
        assertTrue(user.isActivationPending());
        assertFalse(invitationRepository.existsById(userId));

        mockMvc.perform(get(candidatesUrl(study.getId()))
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mockMvc.perform(get(candidatesUrl(study.getId()) + "?includeCancelled=true")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(firstCandidateId))
                .andExpect(jsonPath("$[0].status").value("CANCELLED"));

        mockMvc.perform(get(candidatesUrl(study.getId()) + "/" + firstCandidateId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancellation.reason").value("E-mail errado"));

        mockMvc.perform(post(candidatesUrl(study.getId()) + "/" + firstCandidateId + "/activation-code")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CANDIDATE_CANCELLED"));

        mockMvc.perform(post(candidatesUrl(study.getId()) + "/" + firstCandidateId + "/cancellation")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Nova tentativa\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CANDIDATE_ALREADY_CANCELLED"));

        ResultActions reregistered = create(study.getId(), "{\"name\":\"Ana Silva\",\"age\":42}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("INVITED"))
                .andExpect(jsonPath("$.activation.activationCode").isString())
                .andExpect(jsonPath("$.cancellation").doesNotExist());
        long secondCandidateId = candidateId(reregistered);
        assertNotEquals(firstCandidateId, secondCandidateId);
        assertTrue(invitationRepository.existsById(userId));
        assertEquals(2, candidateRepository.findAllByStudyIdOrderByIdAsc(study.getId()).size());
        assertEquals(1, candidateRepository.findAllByStudyIdAndCancelledAtIsNullOrderByIdAsc(study.getId()).size());
    }

    @Test
    void cancelPreservesInviteWhenInactiveUserHasAnotherActiveCandidacy() throws Exception {
        Study otherStudy = saveStudy(StudyStatus.RECRUITMENT);
        long firstId = candidateId(create(study.getId(), "{\"name\":\"Ana Silva\",\"age\":42}")
                .andExpect(status().isCreated()));
        create(otherStudy.getId(), "{\"name\":\"Ana Silva\",\"age\":42}")
                .andExpect(status().isCreated());
        Long userId = candidateRepository.findById(firstId).orElseThrow().getUserId();

        mockMvc.perform(post(candidatesUrl(study.getId()) + "/" + firstId + "/cancellation")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Desistiu só deste estudo\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        assertTrue(invitationRepository.existsById(userId));
    }

    @Test
    void cancelValidatesReasonScopePermissionsAndStudyStatus() throws Exception {
        long candidateId = candidateId(create(study.getId(), "{\"name\":\"Ana Silva\",\"age\":42}")
                .andExpect(status().isCreated()));
        String path = candidatesUrl(study.getId()) + "/" + candidateId + "/cancellation";

        mockMvc.perform(post(path).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(path).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"   \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(path).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"" + "x".repeat(501) + "\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Sem autenticação\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post(path).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Sem permissão\"}"))
                .andExpect(status().isForbidden());

        Study otherStudy = saveStudy(StudyStatus.RECRUITMENT);
        mockMvc.perform(post(candidatesUrl(otherStudy.getId()) + "/" + candidateId + "/cancellation")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Estudo diferente\"}"))
                .andExpect(status().isNotFound());

        study.advanceStatus(StudyStatus.CANCELLED);
        studyRepository.saveAndFlush(study);
        mockMvc.perform(post(path).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Estudo fechado\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STUDY_NOT_RECRUITING"));
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
        ObjectNode payload = (ObjectNode) objectMapper.readTree(body);
        if (!payload.has("email")) {
            String name = payload.path("name").asText("candidate").strip().replaceAll("\\s+", " ")
                    .toLowerCase(Locale.ROOT);
            payload.put("email", "candidate." + Integer.toUnsignedString(name.hashCode()) + "@test.local");
        }
        if (!payload.has("phone")) {
            payload.put("phone", "83999990000");
        }
        return mockMvc.perform(post(candidatesUrl(studyId))
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload.toString()));
    }

    private long candidateId(ResultActions result) throws Exception {
        String response = result.andReturn().getResponse().getContentAsString();
        assertNotNull(response);
        return objectMapper.readTree(response).get("id").asLong();
    }
}
