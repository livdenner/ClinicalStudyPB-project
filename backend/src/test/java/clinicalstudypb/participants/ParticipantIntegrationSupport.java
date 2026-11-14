package clinicalstudypb.participants;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.consent.infrastructure.SimulatedConsentRepository;
import clinicalstudypb.criteria.domain.CriterionType;
import clinicalstudypb.criteria.domain.StudyCriterion;
import clinicalstudypb.criteria.infrastructure.StudyCriterionRepository;
import clinicalstudypb.participants.infrastructure.ParticipantRepository;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Prepara critérios, visita, recrutamento, avaliações e consentimentos reais para RF11.
 *
 * @author Lívia
 * @since 2026-11-09
 * @version 0.0.1
 */
abstract class ParticipantIntegrationSupport extends IntegrationTestSupport {

    protected static final Instant NOW = Instant.parse("2026-11-09T12:30:00.123456Z");

    @Autowired
    protected CandidateRepository candidateRepository;
    @Autowired
    protected StudyCriterionRepository criterionRepository;
    @Autowired
    protected ParticipantRepository participantRepository;
    @Autowired
    protected SimulatedConsentRepository consentRepository;
    @Autowired
    protected JdbcTemplate jdbc;
    @MockitoBean(name = "participantClock")
    protected Clock clock;

    protected User researcher;
    protected User coordinator;
    protected String researcherToken;
    protected String coordinatorToken;
    protected Study study;
    protected Long candidateId;

    @BeforeEach
    void prepareParticipants() throws Exception {
        researcher = saveUser("Pesquisadora", "participant.researcher@test.local", UserRole.RESEARCHER);
        coordinator = saveUser("Coordenadora", "participant.coordinator@test.local", UserRole.COORDINATOR);
        researcherToken = tokenFor(researcher.getEmail());
        coordinatorToken = tokenFor(coordinator.getEmail());
        when(clock.instant()).thenReturn(NOW);
        study = openStudy("Estudo de inclusão", 2);
        candidateId = candidate(study, "Ana Silva", EligibilityStatus.ELIGIBLE, ConsentDecision.GRANTED);
    }

    protected Study openStudy(String title, int capacity) throws Exception {
        Study created = studyRepository.saveAndFlush(new Study(title, "Objetivo", researcher.getId(),
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), capacity));
        criterionRepository.saveAllAndFlush(List.of(
                new StudyCriterion(created.getId(), CriterionType.INCLUSION, "Inclusão"),
                new StudyCriterion(created.getId(), CriterionType.EXCLUSION, "Exclusão")));
        mockMvc.perform(post(studyPath(created.getId()) + "/planned-visits")
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .header(HttpHeaders.IF_MATCH, "\"" + created.getVersion() + "\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Inicial","plannedDate":"2027-02-01",
                                 "activities":[{"name":"Entrevista","description":"Histórico"}]}
                                """))
                .andExpect(status().isCreated());
        transition(created.getId(), StudyStatus.RECRUITMENT, StudyStatus.PLANNING).andExpect(status().isOk());
        return studyRepository.findById(created.getId()).orElseThrow();
    }

    protected Long candidate(Study owner, String name, EligibilityStatus eligibility, ConsentDecision consent)
            throws Exception {
        String response = mockMvc.perform(post(studyPath(owner.getId()) + "/candidates")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", name, "age", 42,
                                "email", "participant-candidate-" + java.util.UUID.randomUUID()
                                        + "@clinicalstudypb.test", "phone", "(83) 99999-0000"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        Long id = objectMapper.readTree(response).get("id").asLong();
        if (eligibility != EligibilityStatus.PENDING) {
            evaluate(owner.getId(), id, eligibility == EligibilityStatus.ELIGIBLE).andExpect(status().isOk());
        }
        if (consent != null) {
            consent(owner.getId(), id, consent).andExpect(status().isOk());
        }
        return id;
    }

    protected ResultActions evaluate(Long studyId, Long id, boolean eligible) throws Exception {
        List<Map<String, Object>> answers = criterionRepository.findAllByStudyIdOrderByIdAsc(studyId).stream()
                .map(criterion -> Map.<String, Object>of("criterionId", criterion.getId(),
                        "matches", criterion.getType() == CriterionType.INCLUSION && eligible)).toList();
        return mockMvc.perform(put(studyPath(studyId) + "/candidates/" + id + "/eligibility")
                .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("answers", answers))));
    }

    protected ResultActions consent(Long studyId, Long id, ConsentDecision decision) throws Exception {
        return mockMvc.perform(put(studyPath(studyId) + "/candidates/" + id + "/consent")
                .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", decision))));
    }

    protected ResultActions include(Long studyId, Long id) throws Exception {
        return mockMvc.perform(post(inclusionPath(studyId, id))
                .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)));
    }

    protected JsonNode includeSuccessfully(Long studyId, Long id) throws Exception {
        return objectMapper.readTree(include(studyId, id).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
    }

    protected ResultActions transition(Long studyId, StudyStatus next, StudyStatus expected) throws Exception {
        return mockMvc.perform(patch(studyPath(studyId) + "/status")
                .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("status", next, "expectedStatus", expected,
                        "reason", "Justificativa de teste"))));
    }

    protected String studyPath(Long studyId) {
        return "/api/studies/" + studyId;
    }

    protected String inclusionPath(Long studyId, Long id) {
        return studyPath(studyId) + "/candidates/" + id + "/inclusion";
    }

    protected DatabaseSnapshot snapshot() {
        return new DatabaseSnapshot(jdbc.queryForList("SELECT * FROM participants ORDER BY id"),
                jdbc.queryForList("SELECT * FROM simulated_consents ORDER BY candidate_id"),
                jdbc.queryForList("SELECT * FROM candidates ORDER BY id"),
                jdbc.queryForList("SELECT * FROM eligibility_evaluations ORDER BY candidate_id"),
                jdbc.queryForList("SELECT * FROM eligibility_answers ORDER BY candidate_id, criterion_id"));
    }

    protected record DatabaseSnapshot(List<Map<String, Object>> participants, List<Map<String, Object>> consents,
                                      List<Map<String, Object>> candidates, List<Map<String, Object>> evaluations,
                                      List<Map<String, Object>> answers) {
    }
}
