package clinicalstudypb.consent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.consent.application.SimulatedConsentService;
import clinicalstudypb.consent.domain.ConsentConflictException;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.consent.infrastructure.SimulatedConsentRepository;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

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

    @Autowired
    private PlatformTransactionManager transactionManager;

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
        User participant = saveUser("Candidato", "consent.candidate@test.local", UserRole.PARTICIPANT);
        Candidate candidate = candidateRepository.save(new Candidate(studyId, "Candidato", "candidato", 42,
                participant.getEmail(), "83999990000", participant.getId()));
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
        assertFalse(consentRepository.existsById(candidateId));
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
        assertEquals(ConsentDecision.GRANTED,
                consentRepository.findById(candidateId).orElseThrow().getStatus());
    }

    @Test
    void coordinatorCanReplaceDecisionBeforeInclusion() throws Exception {
        write("GRANTED").andExpect(status().isOk());
        Instant firstRecordedAt = consentRepository.findById(candidateId).orElseThrow().getRecordedAt();
        write("DECLINED")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DECLINED"));
        var saved = consentRepository.findById(candidateId).orElseThrow();
        assertEquals(ConsentDecision.DECLINED, saved.getStatus());
        assertNotEquals(firstRecordedAt, saved.getRecordedAt());
        assertEquals(1L, consentRepository.count());
    }

    @Test
    void pendingIsNotARecordableDecision() throws Exception {
        write("PENDING").andExpect(status().isBadRequest());
        write("UNKNOWN").andExpect(status().isBadRequest());
        mockMvc.perform(put(path()).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        assertFalse(consentRepository.existsById(candidateId));
    }

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = {"RESEARCHER", "ADMINISTRATOR", "PARTICIPANT"})
    void otherRolesCannotConsultOrChangeConsent(UserRole role) throws Exception {
        String token = role == UserRole.RESEARCHER ? researcherToken
                : tokenFor(saveUser("Usuário " + role,
                        "consent." + role.name().toLowerCase(Locale.ROOT) + "@test.local", role).getEmail());
        mockMvc.perform(get(path()).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden());
        mockMvc.perform(put(path()).header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"GRANTED\"}"))
                .andExpect(status().isForbidden());
        assertFalse(consentRepository.existsById(candidateId));
    }

    @Test
    void missingTokenIsRejected() throws Exception {
        mockMvc.perform(get(path())).andExpect(status().isUnauthorized());
        mockMvc.perform(put(path()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"GRANTED\"}"))
                .andExpect(status().isUnauthorized());
        assertFalse(consentRepository.existsById(candidateId));
    }

    @Test
    void wrongStudyOrCandidateReturnsNotFound() throws Exception {
        Long otherStudy = studyRepository.save(new Study("Outro", "Objetivo", researcherId,
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20)).getId();
        mockMvc.perform(get("/api/studies/" + otherStudy + "/candidates/" + candidateId + "/consent")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/studies/" + otherStudy + "/candidates/" + candidateId + "/consent")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"GRANTED\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/studies/" + studyId + "/candidates/999999/consent")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"GRANTED\"}"))
                .andExpect(status().isNotFound());
        assertFalse(consentRepository.existsById(candidateId));
    }

    @ParameterizedTest
    @EnumSource(value = StudyStatus.class, names = {"PLANNING", "EXECUTION", "CLOSED", "CANCELLED"})
    void consentCannotChangeOutsideRecruitment(StudyStatus state) throws Exception {
        write("GRANTED").andExpect(status().isOk());
        Instant recordedAt = consentRepository.findById(candidateId).orElseThrow().getRecordedAt();
        jdbc.update("UPDATE studies SET status = ? WHERE id = ?", state.name(), studyId);
        write("DECLINED")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("O consentimento só pode mudar durante o recrutamento."));
        var saved = consentRepository.findById(candidateId).orElseThrow();
        assertEquals(ConsentDecision.GRANTED, saved.getStatus());
        assertEquals(recordedAt, saved.getRecordedAt());
    }

    @Test
    void consentWaitsForStudyTransitionAndDoesNotOverwritePriorDecision() throws Exception {
        write("GRANTED").andExpect(status().isOk());
        Instant recordedAt = consentRepository.findById(candidateId).orElseThrow().getRecordedAt();
        CountDownLatch requestStarted = new CountDownLatch(1);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<ResultActions> response = new TransactionTemplate(transactionManager).execute(transaction -> {
                Study locked = studyRepository.findByIdForUpdate(studyId).orElseThrow();
                Future<ResultActions> request = executor.submit(() -> {
                    requestStarted.countDown();
                    return mockMvc.perform(put(path())
                            .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"status\":\"DECLINED\"}"));
                });
                try {
                    assertTrue(requestStarted.await(5, TimeUnit.SECONDS));
                    assertTrue(awaitStudyRowLockWait(),
                            "O registro de consentimento deve aguardar o bloqueio do estudo.");
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("Aguardando o bloqueio do estudo.", exception);
                }
                locked.advanceStatus(StudyStatus.CANCELLED);
                return request;
            });
            assertNotNull(response);
            response.get(10, TimeUnit.SECONDS)
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.detail").value("O consentimento só pode mudar durante o recrutamento."));
            var saved = consentRepository.findById(candidateId).orElseThrow();
            assertEquals(ConsentDecision.GRANTED, saved.getStatus());
            assertEquals(recordedAt, saved.getRecordedAt());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void includedCandidateKeepsItsGrantedDecision() throws Exception {
        write("GRANTED").andExpect(status().isOk());
        Instant recordedAt = consentRepository.findById(candidateId).orElseThrow().getRecordedAt();
        consentService.lockAfterInclusion(studyId, candidateId);
        write("DECLINED")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("O consentimento não pode mudar após a inclusão."));
        var saved = consentRepository.findById(candidateId).orElseThrow();
        assertEquals(ConsentDecision.GRANTED, saved.getStatus());
        assertEquals(recordedAt, saved.getRecordedAt());
    }

    @Test
    void inclusionLockRequiresGrantedConsent() throws Exception {
        assertThrows(
                ConsentConflictException.class,
                () -> consentService.lockAfterInclusion(studyId, candidateId));
        write("DECLINED").andExpect(status().isOk());
        assertThrows(
                ConsentConflictException.class,
                () -> consentService.lockAfterInclusion(studyId, candidateId));
    }

    private String path() {
        return "/api/studies/" + studyId + "/candidates/" + candidateId + "/consent";
    }

    private boolean awaitStudyRowLockWait() throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (System.nanoTime() < deadline) {
            jdbc.execute("SELECT pg_stat_clear_snapshot()");
            Integer waiting = jdbc.queryForObject("SELECT COUNT(*) FROM pg_stat_activity "
                    + "WHERE wait_event_type = 'Lock' AND query ILIKE '%studies%'", Integer.class);
            if (waiting != null && waiting > 0) {
                return true;
            }
            Thread.sleep(25);
        }
        return false;
    }

    private org.springframework.test.web.servlet.ResultActions write(String decision) throws Exception {
        return mockMvc.perform(put(path()).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + decision + "\"}"));
    }
}
