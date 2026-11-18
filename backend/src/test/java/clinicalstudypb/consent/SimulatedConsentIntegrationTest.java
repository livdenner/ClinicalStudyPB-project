package clinicalstudypb.consent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.consent.application.SimulatedConsentService;
import clinicalstudypb.consent.domain.ConsentConflictException;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.consent.domain.SimulatedConsent;
import clinicalstudypb.consent.infrastructure.SimulatedConsentRepository;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
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
 * Confere a API de convites do candidato, a descontinuação do PUT legado e a persistência de RF10.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-07
 * @version 0.0.2
 */
class SimulatedConsentIntegrationTest extends IntegrationTestSupport {
    @Autowired
    private clinicalstudypb.candidates.infrastructure.CandidateRepository candidateRepository;

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
    private Long participantUserId;
    private String coordinatorToken;
    private String researcherToken;
    private String participantToken;

    @BeforeEach
    void setUp() throws Exception {
        User researcher = saveUser("Pesquisadora", "consent.researcher@test.local", UserRole.RESEARCHER);
        researcherId = researcher.getId();
        User coordinator = saveUser("Coordenador", "consent.coordinator@test.local", UserRole.COORDINATOR);
        Study study = studyRepository.save(new Study("Estudo Clínico", "Avaliar protocolo simulado",
                researcher.getId(), LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20));
        studyId = study.getId();
        Long visitId = jdbc.queryForObject(
                "INSERT INTO planned_visits (study_id, name, planned_date, position) "
                        + "VALUES (?, 'Triagem', '2027-02-01', 1) RETURNING id",
                Long.class, studyId);
        jdbc.update("INSERT INTO planned_activities (planned_visit_id, name, name_key, description, position) "
                + "VALUES (?, 'Coleta', 'coleta', 'Coleta fictícia', 1)", visitId);
        jdbc.update("UPDATE studies SET status = 'RECRUITMENT' WHERE id = ?", studyId);

        User participant = saveUser("Candidato", "consent.candidate@test.local", UserRole.PARTICIPANT);
        participantUserId = participant.getId();
        Candidate candidate = new Candidate(studyId, "Candidato", "candidato", 42,
                participant.getEmail(), "83999990000", participant.getId());
        candidate.updateEligibilityStatus(EligibilityStatus.ELIGIBLE);
        candidateId = candidateRepository.save(candidate).getId();

        coordinatorToken = tokenFor(coordinator.getEmail());
        researcherToken = tokenFor(researcher.getEmail());
        participantToken = tokenFor(participant.getEmail());
    }

    @Test
    void newCandidateHasPendingConsentWithoutTimestampActorOrStoredRow() throws Exception {
        mockMvc.perform(get(coordinatorConsentPath()).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studyId").value(studyId))
                .andExpect(jsonPath("$.candidateId").value(candidateId))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.recordedAt").doesNotExist())
                .andExpect(jsonPath("$.recordedByUserId").doesNotExist());
        assertFalse(consentRepository.existsById(candidateId));
    }

    @Test
    void legacyDecisionWithoutAuthorRemainsReadableWithoutRecordedByUserId() throws Exception {
        jdbc.update("""
                INSERT INTO simulated_consents (candidate_id, status, recorded_at, locked_after_inclusion)
                VALUES (?, 'GRANTED', TIMESTAMP WITH TIME ZONE '2026-11-08T12:00:00Z', FALSE)
                """, candidateId);

        mockMvc.perform(get(coordinatorConsentPath()).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studyId").value(studyId))
                .andExpect(jsonPath("$.candidateId").value(candidateId))
                .andExpect(jsonPath("$.status").value("GRANTED"))
                .andExpect(jsonPath("$.recordedAt").exists())
                .andExpect(jsonPath("$.recordedByUserId").doesNotExist());
    }

    @Test
    void participantCanGrantAndCoordinatorReadsPersistedDecisionWithAuthor() throws Exception {
        decide(candidateId, "GRANTED")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.candidateId").value(candidateId))
                .andExpect(jsonPath("$.status").value("GRANTED"))
                .andExpect(jsonPath("$.decidedAt").exists());

        mockMvc.perform(get(coordinatorConsentPath()).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GRANTED"))
                .andExpect(jsonPath("$.recordedAt").exists())
                .andExpect(jsonPath("$.recordedByUserId").value(participantUserId));

        SimulatedConsent persisted = consentRepository.findById(candidateId).orElseThrow();
        assertEquals(ConsentDecision.GRANTED, persisted.getStatus());
        assertEquals(participantUserId, persisted.getRecordedByUserId());
    }

    @Test
    void secondDecisionIsRejectedAndPreservesFirstDecisionAndAuthor() throws Exception {
        decide(candidateId, "GRANTED").andExpect(status().isOk());
        SimulatedConsent first = consentRepository.findById(candidateId).orElseThrow();

        decide(candidateId, "DECLINED")
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("CONSENT_ALREADY_DECIDED"));
        decide(candidateId, "GRANTED")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONSENT_ALREADY_DECIDED"));

        SimulatedConsent current = consentRepository.findById(candidateId).orElseThrow();
        assertEquals(ConsentDecision.GRANTED, current.getStatus());
        assertEquals(first.getRecordedAt(), current.getRecordedAt());
        assertEquals(participantUserId, current.getRecordedByUserId());
        assertEquals(1L, consentRepository.count());
    }

    @ParameterizedTest
    @EnumSource(UserRole.class)
    void deprecatedPutConsentReturnsForbiddenConsentDecidedByCandidateForAllProfiles(UserRole role) throws Exception {
        String token = tokenForRole(role);
        mockMvc.perform(put(coordinatorConsentPath())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"GRANTED\"}"))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("CONSENT_DECIDED_BY_CANDIDATE"));
        assertFalse(consentRepository.existsById(candidateId));
    }

    @Test
    void invalidDecisionOrInvitationFilterReturnsBadRequest() throws Exception {
        decide(candidateId, "PENDING").andExpect(status().isBadRequest());
        decide(candidateId, "UNKNOWN").andExpect(status().isBadRequest());
        mockMvc.perform(post(decisionPath(candidateId))
                        .header(HttpHeaders.AUTHORIZATION, bearer(participantToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/me/invitations")
                        .param("status", "INCLUDED")
                        .header(HttpHeaders.AUTHORIZATION, bearer(participantToken)))
                .andExpect(status().isBadRequest());
        assertFalse(consentRepository.existsById(candidateId));
    }

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = {"RESEARCHER", "ADMINISTRATOR", "PARTICIPANT"})
    void otherRolesCannotConsultCoordinatorConsentEndpoint(UserRole role) throws Exception {
        String token = tokenForRole(role);
        mockMvc.perform(get(coordinatorConsentPath()).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden());
        assertFalse(consentRepository.existsById(candidateId));
    }

    @ParameterizedTest
    @EnumSource(value = UserRole.class, names = {"COORDINATOR", "RESEARCHER", "ADMINISTRATOR"})
    void staffRolesCannotAccessParticipantInvitations(UserRole role) throws Exception {
        String token = tokenForRole(role);
        mockMvc.perform(get("/api/me/invitations").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/me/invitations/" + candidateId).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(decisionPath(candidateId))
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"GRANTED\"}"))
                .andExpect(status().isForbidden());
        assertFalse(consentRepository.existsById(candidateId));
    }

    @Test
    void missingTokenIsRejected() throws Exception {
        mockMvc.perform(get(coordinatorConsentPath())).andExpect(status().isUnauthorized());
        mockMvc.perform(put(coordinatorConsentPath()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"GRANTED\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/me/invitations")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/me/invitations/" + candidateId)).andExpect(status().isUnauthorized());
        mockMvc.perform(post(decisionPath(candidateId)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"GRANTED\"}"))
                .andExpect(status().isUnauthorized());
        assertFalse(consentRepository.existsById(candidateId));
    }

    @Test
    void wrongStudyAnotherAccountOrNonVisibleStatusesReturnNotFound() throws Exception {
        Long otherStudy = studyRepository.save(new Study("Outro", "Objetivo", researcherId,
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20)).getId();
        User intruder = saveUser("Intruso", "consent.intruder@test.local", UserRole.PARTICIPANT);
        String intruderToken = tokenFor(intruder.getEmail());

        mockMvc.perform(get("/api/studies/" + otherStudy + "/candidates/" + candidateId + "/consent")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/me/invitations/" + candidateId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(intruderToken)))
                .andExpect(status().isNotFound());
        mockMvc.perform(post(decisionPath(candidateId))
                        .header(HttpHeaders.AUTHORIZATION, bearer(intruderToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"GRANTED\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/me/invitations/" + 999999L)
                        .header(HttpHeaders.AUTHORIZATION, bearer(participantToken)))
                .andExpect(status().isNotFound());

        Candidate notEligible = new Candidate(otherStudy, "Pendente", "pendente", 30,
                "consent.candidate@test.local", "83999990001", participantUserId);
        Long notEligibleId = candidateRepository.save(notEligible).getId();
        mockMvc.perform(get("/api/me/invitations/" + notEligibleId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(participantToken)))
                .andExpect(status().isNotFound());
        decide(notEligibleId, "GRANTED")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONSENT_NOT_AVAILABLE"));
        assertFalse(consentRepository.existsById(candidateId));
        assertFalse(consentRepository.existsById(notEligibleId));
    }

    @ParameterizedTest
    @EnumSource(value = StudyStatus.class, names = {"PLANNING", "EXECUTION", "CLOSED", "CANCELLED"})
    void consentCannotBeDecidedOutsideRecruitment(StudyStatus state) throws Exception {
        jdbc.update("UPDATE studies SET status = ? WHERE id = ?", state.name(), studyId);
        decide(candidateId, "DECLINED")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STUDY_NOT_RECRUITING"));
        assertFalse(consentRepository.existsById(candidateId));
    }

    @Test
    void decisionWaitsForStudyTransitionAndConcurrentDecisionsPersistOnlyOne() throws Exception {
        CountDownLatch requestStarted = new CountDownLatch(1);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<ResultActions> response = new TransactionTemplate(transactionManager).execute(transaction -> {
                Study locked = studyRepository.findByIdForUpdate(studyId).orElseThrow();
                Future<ResultActions> request = executor.submit(() -> {
                    requestStarted.countDown();
                    return decide(candidateId, "DECLINED");
                });
                try {
                    assertTrue(requestStarted.await(5, TimeUnit.SECONDS));
                    assertTrue(awaitStudyRowLockWait(),
                            "A decisão do candidato deve aguardar o bloqueio do estudo.");
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
                    .andExpect(jsonPath("$.code").value("STUDY_NOT_RECRUITING"));
            assertFalse(consentRepository.existsById(candidateId));
        } finally {
            executor.shutdownNow();
        }

        jdbc.update("UPDATE studies SET status = 'RECRUITMENT' WHERE id = ?", studyId);
        CountDownLatch startBoth = new CountDownLatch(1);
        ExecutorService racePool = Executors.newFixedThreadPool(2);
        try {
            List<Future<Integer>> results = new ArrayList<>();
            for (String choice : List.of("GRANTED", "DECLINED")) {
                results.add(racePool.submit(() -> {
                    startBoth.await(5, TimeUnit.SECONDS);
                    return decide(candidateId, choice).andReturn().getResponse().getStatus();
                }));
            }
            startBoth.countDown();
            List<Integer> statuses = List.of(
                    results.get(0).get(15, TimeUnit.SECONDS),
                    results.get(1).get(15, TimeUnit.SECONDS));
            assertTrue(statuses.contains(200) && statuses.contains(409),
                    "Decisões concorrentes devem retornar um 200 e um 409, recebeu " + statuses);
            assertEquals(1L, consentRepository.count());
        } finally {
            racePool.shutdownNow();
        }
    }

    @Test
    void includedCandidateRejectsDecisionWithConsentNotAvailableAndHidesInvitation() throws Exception {
        decide(candidateId, "GRANTED").andExpect(status().isOk());
        Instant recordedAt = consentRepository.findById(candidateId).orElseThrow().getRecordedAt();
        mockMvc.perform(post("/api/studies/" + studyId + "/candidates/" + candidateId + "/inclusion")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isCreated());

        decide(candidateId, "DECLINED")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONSENT_NOT_AVAILABLE"));
        mockMvc.perform(get("/api/me/invitations").header(HttpHeaders.AUTHORIZATION, bearer(participantToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/me/invitations/" + candidateId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(participantToken)))
                .andExpect(status().isNotFound());

        SimulatedConsent saved = consentRepository.findById(candidateId).orElseThrow();
        assertEquals(ConsentDecision.GRANTED, saved.getStatus());
        assertEquals(recordedAt, saved.getRecordedAt());
        assertTrue(saved.isLockedAfterInclusion());
    }

    @Test
    void inclusionLockRequiresGrantedConsent() throws Exception {
        assertThrows(
                ConsentConflictException.class,
                () -> consentService.lockAfterInclusion(studyId, candidateId));
        decide(candidateId, "DECLINED").andExpect(status().isOk());
        assertThrows(
                ConsentConflictException.class,
                () -> consentService.lockAfterInclusion(studyId, candidateId));
    }

    @Test
    void cancelledCandidateRejectsDecisionWithCancelledPriorityAndPreservesHistory() throws Exception {
        decide(candidateId, "GRANTED").andExpect(status().isOk());
        mockMvc.perform(post("/api/studies/" + studyId + "/candidates/" + candidateId + "/cancellation")
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Desistência antes da inclusão\"}"))
                .andExpect(status().isOk());

        decide(candidateId, "DECLINED")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CANDIDATE_CANCELLED"));
        mockMvc.perform(get(coordinatorConsentPath()).header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GRANTED"))
                .andExpect(jsonPath("$.recordedByUserId").value(participantUserId));
        mockMvc.perform(get("/api/me/invitations/" + candidateId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(participantToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    void participantCanListFilterAndInspectInvitationWithProtocolAndSimulatedTerm() throws Exception {
        Study secondStudy = studyRepository.save(new Study("Estudo Novo", "Segundo objetivo", researcherId,
                LocalDate.of(2027, 3, 1), LocalDate.of(2027, 10, 31), 15));
        jdbc.update("UPDATE studies SET status = 'RECRUITMENT' WHERE id = ?", secondStudy.getId());
        Candidate newer = new Candidate(secondStudy.getId(), "Candidato", "candidato", 42,
                "consent.candidate@test.local", "83999990000", participantUserId);
        newer.updateEligibilityStatus(EligibilityStatus.ELIGIBLE);
        Long newerId = candidateRepository.save(newer).getId();

        decide(candidateId, "DECLINED").andExpect(status().isOk());

        mockMvc.perform(get("/api/me/invitations").header(HttpHeaders.AUTHORIZATION, bearer(participantToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].candidateId").value(newerId))
                .andExpect(jsonPath("$[0].status").value("CONSENT_PENDING"))
                .andExpect(jsonPath("$[0].decidedAt").doesNotExist())
                .andExpect(jsonPath("$[1].candidateId").value(candidateId))
                .andExpect(jsonPath("$[1].status").value("DECLINED"))
                .andExpect(jsonPath("$[1].decidedAt").exists());

        mockMvc.perform(get("/api/me/invitations")
                        .param("status", "CONSENT_PENDING")
                        .header(HttpHeaders.AUTHORIZATION, bearer(participantToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].candidateId").value(newerId));

        mockMvc.perform(get("/api/me/invitations/" + candidateId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(participantToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studyTitle").value("Estudo Clínico"))
                .andExpect(jsonPath("$.studyObjective").value("Avaliar protocolo simulado"))
                .andExpect(jsonPath("$.responsibleName").value("Pesquisadora"))
                .andExpect(jsonPath("$.plannedVisits.length()").value(1))
                .andExpect(jsonPath("$.plannedVisits[0].name").value("Triagem"))
                .andExpect(jsonPath("$.plannedVisits[0].activities[0].name").value("Coleta"))
                .andExpect(jsonPath("$.termText").value(org.hamcrest.Matchers.containsString("fictício")))
                .andExpect(jsonPath("$.status").value("DECLINED"))
                .andExpect(jsonPath("$.decidedAt").exists());
    }

    private String coordinatorConsentPath() {
        return "/api/studies/" + studyId + "/candidates/" + candidateId + "/consent";
    }

    private String decisionPath(Long id) {
        return "/api/me/invitations/" + id + "/decision";
    }

    private ResultActions decide(Long id, String status) throws Exception {
        return mockMvc.perform(post(decisionPath(id))
                .header(HttpHeaders.AUTHORIZATION, bearer(participantToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + status + "\"}"));
    }

    private String tokenForRole(UserRole role) throws Exception {
        return switch (role) {
            case COORDINATOR -> coordinatorToken;
            case RESEARCHER -> researcherToken;
            case PARTICIPANT -> participantToken;
            case ADMINISTRATOR -> tokenFor(saveUser("Admin",
                    "consent." + role.name().toLowerCase(Locale.ROOT) + "@test.local", role).getEmail());
        };
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
}
