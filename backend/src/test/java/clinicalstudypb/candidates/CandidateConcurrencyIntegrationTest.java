package clinicalstudypb.candidates;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.infrastructure.CandidateActivationInviteRepository;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Verifica respostas de autorização e serialização entre cadastro e mudança de estado.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
class CandidateConcurrencyIntegrationTest extends IntegrationTestSupport {

    private static final String CANDIDATES_URL = "/api/studies/%d/candidates";

    @Autowired
    private CandidateRepository candidateRepository;

    @Autowired
    private CandidateActivationInviteRepository invitationRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private JdbcTemplate jdbc;

    private User researcher;
    private User participant;
    private Study study;
    private String researcherToken;

    @BeforeEach
    void setUp() throws Exception {
        researcher = saveUser("Pesquisadora", "candidate.lock@test.local", UserRole.RESEARCHER);
        participant = saveUser("Ana Silva", "candidate.lock.participant@test.local", UserRole.PARTICIPANT);
        study = studyRepository.saveAndFlush(new Study("Estudo", "Objetivo", researcher.getId(),
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20));
        researcherToken = tokenFor(researcher.getEmail());
    }

    @Test
    void missingStudyReturnsNotFoundOnBothReadEndpointsForResearcher() throws Exception {
        mockMvc.perform(get(CANDIDATES_URL.formatted(999L))
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isNotFound());

        mockMvc.perform(get(CANDIDATES_URL.formatted(999L) + "/1")
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    void databaseRejectsCandidateAgesOutsideContractRange() {
        assertThrows(DataIntegrityViolationException.class, () -> insertCandidateWithAge(0));
        assertThrows(DataIntegrityViolationException.class, () -> insertCandidateWithAge(131));
        assertEquals(0, candidateRepository.count());
    }

    @Test
    void registrationWaitsForConcurrentStudyTransitionAndRejectsClosedRecruitment() throws Exception {
        study.advanceStatus(StudyStatus.RECRUITMENT);
        studyRepository.saveAndFlush(study);
        String token = tokenFor(saveUser("Coordenador", "candidate.coord@test.local",
                UserRole.COORDINATOR).getEmail());
        CountDownLatch requestStarted = new CountDownLatch(1);
        ExecutorService executor = Executors.newSingleThreadExecutor();

        try {
            Future<ResultActions> response = new TransactionTemplate(transactionManager).execute(transaction -> {
                Study locked = studyRepository.findByIdForUpdate(study.getId()).orElseThrow();
                Future<ResultActions> request = executor.submit(() -> {
                    requestStarted.countDown();
                    return mockMvc.perform(post(CANDIDATES_URL.formatted(study.getId()))
                            .header(HttpHeaders.AUTHORIZATION, bearer(token))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Ana Silva\",\"age\":42,"
                                    + "\"email\":\"ana@test.local\",\"phone\":\"83999990000\"}"));
                });
                try {
                    assertTrue(requestStarted.await(5, TimeUnit.SECONDS));
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("Aguardando o início do cadastro concorrente.", exception);
                }
                try {
                    assertTrue(awaitRowLockWait("studies"),
                            "O cadastro deve aguardar o bloqueio da linha do estudo.");
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("Aguardando o bloqueio da linha do estudo.", exception);
                }
                locked.advanceStatus(StudyStatus.CANCELLED);
                return request;
            });

            assertNotNull(response);
            response.get(10, TimeUnit.SECONDS).andExpect(status().isConflict());
            assertEquals(0, candidateRepository.count());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void cancelWaitsForUserLockAndInvalidatesInviteWhenLastActiveCandidacyCloses() throws Exception {
        study.advanceStatus(StudyStatus.RECRUITMENT);
        studyRepository.saveAndFlush(study);
        Study otherStudy = new Study("Outro estudo", "Objetivo", researcher.getId(),
                LocalDate.of(2027, 2, 1), LocalDate.of(2027, 12, 31), 20);
        otherStudy.advanceStatus(StudyStatus.RECRUITMENT);
        otherStudy = studyRepository.saveAndFlush(otherStudy);
        User coordinator = saveUser("Coordenador", "candidate.multi.coord@test.local", UserRole.COORDINATOR);
        String token = tokenFor(coordinator.getEmail());

        String payload = "{\"name\":\"Ana Multi\",\"age\":42,"
                + "\"email\":\"ana.multi@test.local\",\"phone\":\"83999990000\"}";
        String firstBody = mockMvc.perform(post(CANDIDATES_URL.formatted(study.getId()))
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String secondBody = mockMvc.perform(post(CANDIDATES_URL.formatted(otherStudy.getId()))
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long firstCandidateId = objectMapper.readTree(firstBody).get("id").asLong();
        long secondCandidateId = objectMapper.readTree(secondBody).get("id").asLong();
        long userId = objectMapper.readTree(firstBody).get("userId").asLong();
        assertTrue(invitationRepository.existsById(userId));

        Long otherStudyId = otherStudy.getId();
        CountDownLatch requestStarted = new CountDownLatch(1);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<ResultActions> response = new TransactionTemplate(transactionManager).execute(transaction -> {
                userRepository.findForUpdate(userId).orElseThrow();
                Future<ResultActions> request = executor.submit(() -> {
                    requestStarted.countDown();
                    return mockMvc.perform(post(CANDIDATES_URL.formatted(study.getId()) + "/"
                                    + firstCandidateId + "/cancellation")
                            .header(HttpHeaders.AUTHORIZATION, bearer(token))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"reason\":\"Desistência estudo 1\"}"));
                });
                try {
                    assertTrue(requestStarted.await(5, TimeUnit.SECONDS));
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("Aguardando início do cancelamento concorrente.", exception);
                }
                try {
                    assertTrue(awaitRowLockWait("users"),
                            "O cancelamento deve aguardar o bloqueio da conta ao checar o convite.");
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("Aguardando bloqueio da conta do candidato.", exception);
                }
                Candidate second = candidateRepository.findForConsentUpdate(secondCandidateId, otherStudyId)
                        .orElseThrow();
                second.cancel("Desistência estudo 2", Instant.now().truncatedTo(ChronoUnit.MICROS),
                        coordinator.getId());
                candidateRepository.saveAndFlush(second);
                return request;
            });

            assertNotNull(response);
            response.get(10, TimeUnit.SECONDS)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CANCELLED"));
            assertTrue(candidateRepository.findById(firstCandidateId).orElseThrow().isCancelled());
            assertTrue(candidateRepository.findById(secondCandidateId).orElseThrow().isCancelled());
            assertFalse(invitationRepository.existsById(userId));
        } finally {
            executor.shutdownNow();
        }
    }

    private boolean awaitRowLockWait(String tableToken) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (System.nanoTime() < deadline) {
            // PostgreSQL may cache pg_stat_activity snapshots for the surrounding transaction.
            jdbc.execute("SELECT pg_stat_clear_snapshot()");
            Integer waitingQueries = jdbc.queryForObject("SELECT COUNT(*) FROM pg_stat_activity "
                    + "WHERE wait_event_type = 'Lock' AND query ILIKE ?",
                    Integer.class, "%" + tableToken + "%");
            if (waitingQueries != null && waitingQueries > 0) {
                return true;
            }
            Thread.sleep(25);
        }
        return false;
    }

    private void insertCandidateWithAge(int age) {
        jdbc.update("INSERT INTO candidates (study_id, name, name_key, age, email, phone, user_id, "
                + "eligibility_status) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')", study.getId(),
                "Ana Silva", "ana silva", age, participant.getEmail(), "83999990000", participant.getId());
    }
}
