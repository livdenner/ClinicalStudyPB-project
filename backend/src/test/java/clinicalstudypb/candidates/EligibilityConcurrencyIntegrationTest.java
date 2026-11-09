package clinicalstudypb.candidates;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.candidates.infrastructure.EligibilityAnswerRepository;
import clinicalstudypb.criteria.domain.CriterionType;
import clinicalstudypb.criteria.domain.StudyCriterion;
import clinicalstudypb.criteria.infrastructure.StudyCriterionRepository;
import clinicalstudypb.participants.domain.Participant;
import clinicalstudypb.participants.infrastructure.ParticipantRepository;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Confere bloqueios reais entre avaliação, inclusão e criação concorrente de critérios.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
class EligibilityConcurrencyIntegrationTest extends IntegrationTestSupport {

    @Autowired
    private CandidateRepository candidateRepository;
    @Autowired
    private StudyCriterionRepository criterionRepository;
    @Autowired
    private EligibilityAnswerRepository answerRepository;
    @Autowired
    private ParticipantRepository participantRepository;
    @Autowired
    private PlatformTransactionManager transactionManager;
    @Autowired
    private JdbcTemplate jdbc;

    private Study study;
    private Candidate candidate;
    private User coordinator;
    private String token;
    private String path;
    private String body;

    @BeforeEach
    void setUp() throws Exception {
        User researcher = saveUser("Pesquisadora", "eligibility.lock.researcher@test.local", UserRole.RESEARCHER);
        coordinator = saveUser("Coordenadora", "eligibility.lock.coordinator@test.local", UserRole.COORDINATOR);
        token = tokenFor(coordinator.getEmail());
        study = studyRepository.saveAndFlush(new Study("Concorrência", "Objetivo", researcher.getId(),
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20));
        candidate = candidateRepository.saveAndFlush(new Candidate(study.getId(), "Ana Silva", "ana silva", 42));
        StudyCriterion inclusion = criterionRepository.saveAndFlush(
                new StudyCriterion(study.getId(), CriterionType.INCLUSION, "Inclusão"));
        StudyCriterion exclusion = criterionRepository.saveAndFlush(
                new StudyCriterion(study.getId(), CriterionType.EXCLUSION, "Exclusão"));
        study.advanceStatus(StudyStatus.RECRUITMENT);
        studyRepository.saveAndFlush(study);
        path = "/api/studies/" + study.getId() + "/candidates/" + candidate.getId() + "/eligibility";
        body = "{\"answers\":[{\"criterionId\":%d,\"matches\":true},{\"criterionId\":%d,\"matches\":false}]}"
                .formatted(inclusion.getId(), exclusion.getId());
    }

    @Test
    void evaluationWaitsForConcurrentInclusionAndPreservesPreviousEvaluation() throws Exception {
        ResultActions previous = evaluate().andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ELIGIBLE"));
        JsonNode before = objectMapper.readTree(previous.andReturn().getResponse().getContentAsString());

        evaluateAfterLockedChange(() -> participantRepository.saveAndFlush(
                new Participant(study.getId(), candidate.getId(), coordinator.getId(),
                        Instant.parse("2026-11-08T12:30:00Z"))))
                .andExpect(status().isConflict());

        String current = mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertEquals(before, objectMapper.readTree(current));
        assertEquals(2, answerRepository.count());
        assertEquals(1, participantRepository.count());
    }

    @Test
    void evaluationReadsCriterionCommittedWhileWaitingAndRemainsPending() throws Exception {
        evaluateAfterLockedChange(() -> criterionRepository.saveAndFlush(
                new StudyCriterion(study.getId(), CriterionType.EXCLUSION, "Critério concorrente")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.answers.length()").value(2));

        assertEquals(3, criterionRepository.count());
        assertEquals(2, answerRepository.count());
    }

    private ResultActions evaluateAfterLockedChange(Runnable change) throws Exception {
        CountDownLatch requestStarted = new CountDownLatch(1);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<ResultActions> response = new TransactionTemplate(transactionManager).execute(transaction -> {
                studyRepository.findByIdForUpdate(study.getId()).orElseThrow();
                Future<ResultActions> request = executor.submit(() -> {
                    requestStarted.countDown();
                    return evaluate();
                });
                try {
                    assertTrue(requestStarted.await(10, TimeUnit.SECONDS));
                    assertTrue(awaitStudyLockWait(), "A avaliação deve aguardar o bloqueio da linha do estudo.");
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("Aguardando a avaliação concorrente.", exception);
                }
                change.run();
                return request;
            });
            assertNotNull(response);
            return response.get(15, TimeUnit.SECONDS);
        } finally {
            executor.shutdown();
            if (!executor.awaitTermination(15, TimeUnit.SECONDS)) {
                executor.shutdownNow();
            }
        }
    }

    private boolean awaitStudyLockWait() throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
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

    private ResultActions evaluate() throws Exception {
        return mockMvc.perform(put(path).header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }
}
