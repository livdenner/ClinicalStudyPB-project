package clinicalstudypb.consent;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.consent.application.SimulatedConsentService;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.consent.infrastructure.SimulatedConsentRepository;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Confere a API, a persistência e as permissões do consentimento simulado.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-07
 * @version 0.0.1
 */
class SimulatedConsentIntegrationTest extends IntegrationTestSupport {
    @Autowired
    private CandidateRepository candidateRepository;

    @Autowired
    private SimulatedConsentRepository consentRepository;

    @Autowired
    private SimulatedConsentService consentService;

    @Autowired
    private JdbcTemplate jdbc;

    private Long studyId;
    private Long candidateId;
    private Long researcherId;
    private String coordinatorToken;
    private String researcherToken;

    @BeforeEach
    void setUp() throws Exception {
        User researcher = saveUser("Pesquisador", "consent.researcher@test.local", UserRole.RESEARCHER);
        researcherId = researcher.getId();
        User coordinator = saveUser("Coordenador", "consent.coordinator@test.local", UserRole.COORDINATOR);
        Study study = studyRepository.save(new Study("Estudo", "Objetivo", researcher.getId(),
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20));
        studyId = study.getId();
        jdbc.update("UPDATE studies SET status = 'RECRUITMENT' WHERE id = ?", studyId);
        Candidate candidate = candidateRepository.save(new Candidate(studyId, "Candidato", "candidato", 42));
        candidateId = candidate.getId();
        coordinatorToken = tokenFor(coordinator.getEmail());
        researcherToken = tokenFor(researcher.getEmail());
    }

    @Test
    void newCandidateHasPendingConsentWithoutTimestampOrStoredRow() throws Exception {
        mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studyId").value(studyId))
                .andExpect(jsonPath("$.candidateId").value(candidateId))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.recordedAt").doesNotExist());
        org.junit.jupiter.api.Assertions.assertFalse(consentRepository.existsById(candidateId));
    }

    @Test
    void coordinatorCanGrantAndReadPersistedDecision() throws Exception {
        write("GRANTED")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GRANTED"))
                .andExpect(jsonPath("$.recordedAt").exists());
        mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GRANTED"))
                .andExpect(jsonPath("$.recordedAt").exists());
        org.junit.jupiter.api.Assertions.assertEquals(ConsentDecision.GRANTED,
                consentRepository.findById(candidateId).orElseThrow().getStatus());
    }

    @Test
    void coordinatorCanReplaceDecisionBeforeInclusion() throws Exception {
        write("GRANTED").andExpect(status().isOk());
        write("DECLINED")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DECLINED"));
        org.junit.jupiter.api.Assertions.assertEquals(1L, consentRepository.count());
    }

    @Test
    void pendingIsNotARecordableDecision() throws Exception {
        write("PENDING").andExpect(status().isBadRequest());
        write("UNKNOWN").andExpect(status().isBadRequest());
        mockMvc.perform(put(path()).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        org.junit.jupiter.api.Assertions.assertFalse(consentRepository.existsById(candidateId));
    }

    @Test
    void researcherCannotConsultOrChangeConsent() throws Exception {
        mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(put(path()).header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"GRANTED\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void missingTokenIsRejected() throws Exception {
        mockMvc.perform(get(path())).andExpect(status().isUnauthorized());
        mockMvc.perform(put(path()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"GRANTED\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void wrongStudyOrCandidateReturnsNotFound() throws Exception {
        Long otherStudy = studyRepository.save(new Study("Outro", "Objetivo", researcherId,
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20)).getId();
        mockMvc.perform(get("/api/studies/" + otherStudy + "/candidates/" + candidateId + "/consent")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/studies/" + studyId + "/candidates/999999/consent")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"GRANTED\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void consentCannotChangeOutsideRecruitment() throws Exception {
        jdbc.update("UPDATE studies SET status = 'EXECUTION' WHERE id = ?", studyId);
        write("GRANTED").andExpect(status().isConflict());
        org.junit.jupiter.api.Assertions.assertFalse(consentRepository.existsById(candidateId));
    }

    @Test
    void includedCandidateKeepsItsGrantedDecision() throws Exception {
        write("GRANTED").andExpect(status().isOk());
        consentService.lockAfterInclusion(studyId, candidateId);
        write("DECLINED").andExpect(status().isConflict());
        org.junit.jupiter.api.Assertions.assertEquals(ConsentDecision.GRANTED,
                consentRepository.findById(candidateId).orElseThrow().getStatus());
    }

    @Test
    void inclusionLockRequiresGrantedConsent() throws Exception {
        org.junit.jupiter.api.Assertions.assertThrows(
                clinicalstudypb.consent.domain.ConsentConflictException.class,
                () -> consentService.lockAfterInclusion(studyId, candidateId));
        write("DECLINED").andExpect(status().isOk());
        org.junit.jupiter.api.Assertions.assertThrows(
                clinicalstudypb.consent.domain.ConsentConflictException.class,
                () -> consentService.lockAfterInclusion(studyId, candidateId));
    }

    private String path() {
        return "/api/studies/" + studyId + "/candidates/" + candidateId + "/consent";
    }

    private org.springframework.test.web.servlet.ResultActions write(String decision) throws Exception {
        return mockMvc.perform(put(path()).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + decision + "\"}"));
    }
}
