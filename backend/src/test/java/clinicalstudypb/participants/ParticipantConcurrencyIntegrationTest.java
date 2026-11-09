package clinicalstudypb.participants;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Verifica disputas de vagas e serialização entre inclusão, avaliação, consentimento e transições.
 * Usa bloqueios observados no PostgreSQL, sem depender de uma ordem presumida das threads.
 *
 * @author Lívia
 * @since 2026-11-09
 * @version 0.0.1
 */
class ParticipantConcurrencyIntegrationTest extends ParticipantIntegrationSupport {

    @Autowired
    private PlatformTransactionManager transactionManager;

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void competingForLastPlaceOrSameCandidateCreatesExactlyOneParticipant(boolean sameCandidate) throws Exception {
        jdbc.update("UPDATE studies SET participant_limit = 1 WHERE id = ?", study.getId());
        Long other = sameCandidate ? candidateId
                : candidate(study, "Bruna", EligibilityStatus.ELIGIBLE, ConsentDecision.GRANTED);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch started = new CountDownLatch(2);
        try {
            List<Future<MvcResult>> requests = new TransactionTemplate(transactionManager).execute(transaction -> {
                studyRepository.findByIdForUpdate(study.getId()).orElseThrow();
                List<Future<MvcResult>> pending = new ArrayList<>();
                for (Long id : List.of(candidateId, other)) {
                    pending.add(executor.submit(() -> {
                        started.countDown();
                        return include(study.getId(), id).andReturn();
                    }));
                }
                awaitBlockedRequests(started, 2);
                return pending;
            });
            assertNotNull(requests);
            List<Integer> statuses = new ArrayList<>();
            for (Future<MvcResult> request : requests) {
                statuses.add(request.get(30, TimeUnit.SECONDS).getResponse().getStatus());
            }
            assertEquals(List.of(201, 409), statuses.stream().sorted().toList());
            assertEquals(1, participantRepository.countByStudyId(study.getId()));
            assertEquals(1, jdbc.queryForObject(
                    "SELECT COUNT(*) FROM simulated_consents WHERE locked_after_inclusion", Integer.class));
            if (!sameCandidate) {
                Long winner = participantRepository.findAllByStudyIdOrderByIdAsc(study.getId())
                        .getFirst().getCandidateId();
                Long loser = winner.equals(candidateId) ? other : candidateId;
                assertFalse(consentRepository.findById(loser).orElseThrow().isLockedAfterInclusion());
                assertEquals(EligibilityStatus.ELIGIBLE,
                        candidateRepository.findById(loser).orElseThrow().getEligibilityStatus());
            }
        } finally {
            stop(executor);
        }
    }

    @Test
    void inclusionWaitsForTransitionAndRejectsStudyThatStoppedRecruitment() throws Exception {
        int response = includeAfterLockedChange(locked -> transition(study.getId(), StudyStatus.CANCELLED,
                StudyStatus.RECRUITMENT).andExpect(status().isOk()));
        assertEquals(409, response);
        assertEquals(StudyStatus.CANCELLED, studyRepository.findById(study.getId()).orElseThrow().getStatus());
        assertNothingIncludedOrLocked();
    }

    @Test
    void inclusionUsesEligibilityCommittedWhileWaitingForTheStudyLock() throws Exception {
        int response = includeAfterLockedChange(locked -> evaluate(study.getId(), candidateId, false)
                .andExpect(status().isOk()));
        assertEquals(409, response);
        assertEquals(EligibilityStatus.INELIGIBLE,
                candidateRepository.findById(candidateId).orElseThrow().getEligibilityStatus());
        assertNothingIncludedOrLocked();
    }

    @Test
    void inclusionUsesConsentCommittedWhileWaitingForTheStudyLock() throws Exception {
        int response = includeAfterLockedChange(locked -> consent(study.getId(), candidateId, ConsentDecision.DECLINED)
                .andExpect(status().isOk()));
        assertEquals(409, response);
        assertEquals(ConsentDecision.DECLINED, consentRepository.findById(candidateId).orElseThrow().getStatus());
        assertNothingIncludedOrLocked();
    }

    @Test
    void inclusionReadsReducedCapacityAfterConcurrentStudyEditCommits() throws Exception {
        Long initial = candidate(study, "Participante inicial", EligibilityStatus.ELIGIBLE, ConsentDecision.GRANTED);
        includeSuccessfully(study.getId(), initial);
        int response = includeAfterLockedChange(locked -> mockMvc.perform(
                        put(studyPath(study.getId()))
                                .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {"title":"Estudo","objective":"Objetivo","responsibleUserId":%d,
                                         "startDate":"2027-01-01","endDate":"2027-12-31","participantLimit":1}
                                        """.formatted(researcher.getId())))
                .andExpect(status().isOk()));
        assertEquals(409, response);
        assertEquals(1, studyRepository.findById(study.getId()).orElseThrow().getParticipantLimit());
        assertEquals(1, participantRepository.countByStudyId(study.getId()));
        assertFalse(consentRepository.findById(candidateId).orElseThrow().isLockedAfterInclusion());
    }

    @Test
    void lockingOneStudyDoesNotBlockInclusionInAnotherStudy() throws Exception {
        Study other = openStudy("Estudo independente", 1);
        Long id = candidate(other, "Outra candidata", EligibilityStatus.ELIGIBLE, ConsentDecision.GRANTED);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            new TransactionTemplate(transactionManager).executeWithoutResult(transaction -> {
                studyRepository.findByIdForUpdate(study.getId()).orElseThrow();
                Future<MvcResult> request = executor.submit(() -> include(other.getId(), id).andReturn());
                try {
                    assertEquals(201, request.get(30, TimeUnit.SECONDS).getResponse().getStatus());
                    assertEquals(0, participantRepository.countByStudyId(study.getId()));
                    assertEquals(1, participantRepository.countByStudyId(other.getId()));
                } catch (Exception exception) {
                    throw new IllegalStateException("A inclusão em outro estudo não deveria aguardar.", exception);
                }
            });
        } finally {
            stop(executor);
        }
    }

    private int includeAfterLockedChange(CheckedChange change) throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        CountDownLatch started = new CountDownLatch(1);
        try {
            Future<MvcResult> response = new TransactionTemplate(transactionManager).execute(transaction -> {
                Study locked = studyRepository.findByIdForUpdate(study.getId()).orElseThrow();
                Future<MvcResult> request = executor.submit(() -> {
                    started.countDown();
                    return include(study.getId(), candidateId).andReturn();
                });
                awaitBlockedRequests(started, 1);
                try {
                    change.run(locked);
                } catch (Exception exception) {
                    throw new IllegalStateException("Alteração concorrente de teste falhou.", exception);
                }
                return request;
            });
            assertNotNull(response);
            return response.get(30, TimeUnit.SECONDS).getResponse().getStatus();
        } finally {
            stop(executor);
        }
    }

    private void awaitBlockedRequests(CountDownLatch started, int expected) {
        try {
            assertTrue(started.await(20, TimeUnit.SECONDS), "As requisições devem iniciar.");
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(20);
            while (System.nanoTime() < deadline) {
                jdbc.execute("SELECT pg_stat_clear_snapshot()");
                Integer waiting = jdbc.queryForObject("SELECT COUNT(*) FROM pg_stat_activity "
                        + "WHERE datname = current_database() AND wait_event_type = 'Lock' "
                        + "AND query ILIKE '%studies%'", Integer.class);
                if (waiting != null && waiting >= expected) {
                    return;
                }
                Thread.sleep(25);
            }
            throw new AssertionError("A inclusão precisa aguardar o bloqueio da linha do estudo.");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Aguardando requisições concorrentes.", exception);
        }
    }

    private void assertNothingIncludedOrLocked() {
        assertEquals(0, participantRepository.count());
        assertFalse(consentRepository.findById(candidateId).orElseThrow().isLockedAfterInclusion());
    }

    private void stop(ExecutorService executor) throws InterruptedException {
        executor.shutdown();
        if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
            executor.shutdownNow();
        }
    }

    @FunctionalInterface
    private interface CheckedChange {
        void run(Study locked) throws Exception;
    }
}
