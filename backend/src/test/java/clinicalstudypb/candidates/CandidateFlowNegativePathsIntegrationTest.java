package clinicalstudypb.candidates;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Caminhos de erro do fluxo do candidato da Release 2 (T17.5), no PostgreSQL descartável: token
 * expirado, decisão de consentimento duplicada, inclusão sem aceite, decisão por quem não é o
 * candidato e as recusas de vínculo e convite. Toda recusa é conferida também no banco.
 *
 * <p>Cada falha informa o RF e o passo do fluxo afetados.
 *
 * @author Júlia Pamplona
 * @since 2026-11-14
 * @version 0.0.1
 */
class CandidateFlowNegativePathsIntegrationTest extends CandidateFlowIntegrationSupport {

    private User owner;
    private Candidate pending;

    @BeforeEach
    void setUpFlow() {
        prepareTeamAndRecruitingStudy();
        owner = activeParticipant("candidata.titular");
        pending = candidacy(study, owner, EligibilityStatus.ELIGIBLE, null);
    }

    @Nested
    @DisplayName("Token expirado")
    class ExpiredToken {

        @Test
        void expiredParticipantTokenCannotListOrDecideInvitations_RF10() throws Exception {
            String expired = expiredTokenFor(owner);
            List<String> before = flowSnapshot();

            expectStatus("RF10", "lista de convites com token expirado", 401,
                    get("/api/me/invitations").header(HttpHeaders.AUTHORIZATION, bearer(expired)));
            expectStatus("RF10", "decisão com token expirado", 401,
                    decision(expired, pending.getId(), "GRANTED"));

            assertEquals(before, flowSnapshot(), "[RF10] passo 'decisão com token expirado' — o banco mudou.");
        }

        @Test
        void expiredCoordinatorTokenCannotInviteCancelOrInclude_RF08_RF11() throws Exception {
            InvitedCandidate invited = invitedCandidate(study, "convite.expirado");
            String expired = expiredTokenFor(coordinator);
            List<String> before = flowSnapshot();

            expectStatus("RF08", "novo código com token expirado", 401,
                    post(candidatePath(invited.id()) + "/activation-code")
                            .header(HttpHeaders.AUTHORIZATION, bearer(expired)));
            expectStatus("RF08", "cancelamento com token expirado", 401,
                    post(candidatePath(pending.getId()) + "/cancellation")
                            .header(HttpHeaders.AUTHORIZATION, bearer(expired))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Sem sessão\"}"));
            expectStatus("RF11", "inclusão com token expirado", 401,
                    post(candidatePath(pending.getId()) + "/inclusion")
                            .header(HttpHeaders.AUTHORIZATION, bearer(expired)));

            assertEquals(before, flowSnapshot(), "[RF08/RF11] passo 'operação com token expirado' — o banco mudou.");
        }

        @Test
        void expiredTokenCannotChangePassword_RF02() throws Exception {
            String hashBefore = passwordHash(owner);

            expectStatus("RF02", "troca de senha com token expirado", 401, put("/api/auth/password")
                    .header(HttpHeaders.AUTHORIZATION, bearer(expiredTokenFor(owner)))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"NovaSenha2026\"}"));

            assertEquals(hashBefore, passwordHash(owner), "[RF02] passo 'troca de senha' — a senha mudou.");
        }

        @Test
        void expiredActivationCodeIsReplacedByCoordinatorAndOnlyTheNewCodeWorks_RF02_RF08() throws Exception {
            InvitedCandidate invited = invitedCandidate(study, "codigo.vencido");
            jdbc.update("UPDATE candidate_activation_invites SET created_at = ?, expires_at = ? "
                            + "WHERE user_id = (SELECT user_id FROM candidates WHERE id = ?)",
                    java.sql.Timestamp.from(Instant.now().minusSeconds(80 * 3600)),
                    java.sql.Timestamp.from(Instant.now().minusSeconds(60)), invited.id());

            expectCode("RF02", "primeiro acesso com código vencido", 410, "ACTIVATION_EXPIRED",
                    activation(invited.email(), invited.activationCode()));

            MvcResult reissued = expectStatus("RF08", "novo código após o vencimento", 200,
                    post(candidatePath(invited.id()) + "/activation-code")
                            .header(HttpHeaders.AUTHORIZATION, bearer(tokenFor(coordinator.getEmail()))));
            String newCode = objectMapper.readTree(responseBody(reissued)).path("activationCode").asText();

            expectCode("RF02", "primeiro acesso com o código vencido após a troca", 400, "ACTIVATION_INVALID",
                    activation(invited.email(), invited.activationCode()));
            expectStatus("RF02", "primeiro acesso com o código novo", 200, activation(invited.email(), newCode));
        }
    }

    @Nested
    @DisplayName("Decisão de consentimento duplicada")
    class DuplicateDecision {

        @ParameterizedTest(name = "primeira decisão {0}")
        @EnumSource(ConsentDecision.class)
        void secondDecisionIsRejectedAndKeepsTheFirstOne_RF10(ConsentDecision first) throws Exception {
            String token = tokenFor(owner.getEmail());
            ConsentDecision second = first == ConsentDecision.GRANTED ? ConsentDecision.DECLINED
                    : ConsentDecision.GRANTED;

            MvcResult decided = expectStatus("RF10", "primeira decisão do candidato", 200,
                    decision(token, pending.getId(), first.name()));
            JsonNode invitation = objectMapper.readTree(responseBody(decided));
            assertEquals(first.name(), invitation.path("status").asText(),
                    "[RF10] passo 'primeira decisão' — a resposta não traz a decisão registrada.");
            assertTrue(invitation.hasNonNull("decidedAt"),
                    "[RF10] passo 'primeira decisão' — a resposta não traz o instante da decisão.");
            List<String> afterFirst = flowSnapshot();

            expectCode("RF10", "segunda decisão do mesmo candidato", 409, "CONSENT_ALREADY_DECIDED",
                    decision(token, pending.getId(), second.name()));
            expectCode("RF10", "repetição da mesma decisão", 409, "CONSENT_ALREADY_DECIDED",
                    decision(token, pending.getId(), first.name()));

            assertEquals(afterFirst, flowSnapshot(),
                    "[RF10] passo 'decisão duplicada' — a decisão já registrada foi alterada.");
            assertEquals(first.name(), storedConsent(pending.getId()));
        }

        @Test
        void concurrentDecisionsRecordExactlyOneAnswer_RF10() throws Exception {
            String token = tokenFor(owner.getEmail());
            CountDownLatch start = new CountDownLatch(1);
            ExecutorService executor = Executors.newFixedThreadPool(2);
            try {
                List<Future<Integer>> responses = new ArrayList<>();
                for (String status : List.of("GRANTED", "DECLINED")) {
                    responses.add(executor.submit(() -> {
                        start.await(5, TimeUnit.SECONDS);
                        return mockMvc.perform(decision(token, pending.getId(), status)).andReturn()
                                .getResponse().getStatus();
                    }));
                }
                start.countDown();
                List<Integer> statuses = new ArrayList<>();
                for (Future<Integer> response : responses) {
                    statuses.add(response.get(15, TimeUnit.SECONDS));
                }
                assertTrue(statuses.contains(200) && statuses.contains(409),
                        "[RF10] passo 'decisões simultâneas' — esperava um 200 e um 409, recebeu " + statuses);
                Long rows = jdbc.queryForObject("SELECT COUNT(*) FROM simulated_consents WHERE candidate_id = ?",
                        Long.class, pending.getId());
                assertEquals(1L, rows, "[RF10] passo 'decisões simultâneas' — mais de uma decisão gravada.");
            } finally {
                executor.shutdownNow();
            }
        }
    }

    @Nested
    @DisplayName("Inclusão sem aceite (GRANTED)")
    class InclusionWithoutGrant {

        @Test
        void pendingConsentBlocksInclusion_RF11() throws Exception {
            assertInclusionBlocked(pending, "inclusão com consentimento pendente");
            assertNull(storedConsent(pending.getId()));
        }

        @Test
        void declinedConsentBlocksInclusion_RF11() throws Exception {
            Candidate declined = candidacy(study, activeParticipant("recusou.termo"), EligibilityStatus.ELIGIBLE,
                    ConsentDecision.DECLINED);
            assertInclusionBlocked(declined, "inclusão com consentimento recusado");
            Boolean locked = jdbc.queryForObject("SELECT locked_after_inclusion FROM simulated_consents "
                    + "WHERE candidate_id = ?", Boolean.class, declined.getId());
            assertEquals(Boolean.FALSE, locked, "[RF11] passo 'inclusão recusada' — o consentimento foi travado.");
        }

        @Test
        void candidateDecisionInTheAppEnablesInclusionByCoordinator_RF10_RF11() throws Exception {
            expectStatus("RF10", "aceite do termo pelo candidato", 200,
                    decision(tokenFor(owner.getEmail()), pending.getId(), "GRANTED"));

            expectStatus("RF11", "inclusão após o aceite do candidato", 201,
                    post(candidatePath(pending.getId()) + "/inclusion")
                            .header(HttpHeaders.AUTHORIZATION, bearer(tokenFor(coordinator.getEmail()))));
            assertEquals(1, participantCount(study.getId()));
        }

        private void assertInclusionBlocked(Candidate candidate, String step) throws Exception {
            List<String> before = flowSnapshot();
            expectStatus("RF11", step, 409, post(candidatePath(candidate.getId()) + "/inclusion")
                    .header(HttpHeaders.AUTHORIZATION, bearer(tokenFor(coordinator.getEmail()))));
            assertEquals(0, participantCount(study.getId()), "[RF11] passo '" + step + "' — participante criado.");
            assertEquals(before, flowSnapshot(), "[RF11] passo '" + step + "' — o banco mudou.");
        }
    }

    @Nested
    @DisplayName("Só o candidato registra o consentimento")
    class OnlyTheCandidateDecides {

        static Stream<UserRole> staffRoles() {
            return Stream.of(UserRole.ADMINISTRATOR, UserRole.RESEARCHER, UserRole.COORDINATOR);
        }

        @ParameterizedTest(name = "{0}")
        @MethodSource("staffRoles")
        void staffCannotRecordConsentThroughAnyRoute_RF10(UserRole role) throws Exception {
            String token = tokenFor(staffAccount(role).getEmail());
            List<String> before = flowSnapshot();

            for (String status : List.of("GRANTED", "DECLINED")) {
                expectCode("RF10", "registro pela web como " + role, 403, "CONSENT_DECIDED_BY_CANDIDATE",
                        put(candidatePath(pending.getId()) + "/consent")
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + status + "\"}"));
                expectStatus("RF10", "decisão pelo app como " + role, 403, decision(token, pending.getId(), status));
            }

            assertEquals(before, flowSnapshot(), "[RF10] passo 'consentimento por " + role + "' — o banco mudou.");
            assertNull(storedConsent(pending.getId()));
        }

        @Test
        void anotherParticipantCannotSeeOrDecideSomeoneElsesInvitation_RF10() throws Exception {
            String intruder = tokenFor(activeParticipant("outra.participante").getEmail());
            List<String> before = flowSnapshot();

            expectStatus("RF10", "detalhe do convite de outra conta", 404,
                    get("/api/me/invitations/" + pending.getId()).header(HttpHeaders.AUTHORIZATION, bearer(intruder)));
            expectStatus("RF10", "decisão no convite de outra conta", 404,
                    decision(intruder, pending.getId(), "GRANTED"));
            MvcResult list = expectStatus("RF10", "lista de convites de outra conta", 200,
                    get("/api/me/invitations").header(HttpHeaders.AUTHORIZATION, bearer(intruder)));
            assertEquals(0, objectMapper.readTree(responseBody(list)).size(),
                    "[RF10] passo 'lista de convites' — a lista mostra a candidatura de outra conta.");

            assertEquals(before, flowSnapshot(), "[RF10] passo 'decisão por outra conta' — o banco mudou.");
        }

        @Test
        void ownerStillInRestrictedFirstAccessSessionCannotDecide_RF02_RF10() throws Exception {
            InvitedCandidate invited = invitedCandidate(study, "primeiro.acesso");
            jdbc.update("UPDATE candidates SET eligibility_status = 'ELIGIBLE' WHERE id = ?", invited.id());
            String restricted = restrictedSessionFor(invited);
            List<String> before = flowSnapshot();

            expectCode("RF10", "decisão antes de definir a senha", 403, "PASSWORD_CHANGE_REQUIRED",
                    decision(restricted, invited.id(), "GRANTED"));

            assertEquals(before, flowSnapshot(), "[RF10] passo 'decisão na sessão restrita' — o banco mudou.");
        }

        @Test
        void candidateDecisionIsVisibleToTheCoordinatorAsRecorded_RF10() throws Exception {
            expectStatus("RF10", "recusa do termo pelo candidato", 200,
                    decision(tokenFor(owner.getEmail()), pending.getId(), "DECLINED"));

            MvcResult consent = expectStatus("RF10", "consulta do consentimento pelo coordenador", 200,
                    get(candidatePath(pending.getId()) + "/consent")
                            .header(HttpHeaders.AUTHORIZATION, bearer(tokenFor(coordinator.getEmail()))));
            JsonNode json = objectMapper.readTree(responseBody(consent));
            assertEquals("DECLINED", json.path("status").asText(),
                    "[RF10] passo 'consulta pelo coordenador' — a decisão do candidato não aparece.");
            assertNotNull(json.path("recordedAt").textValue(),
                    "[RF10] passo 'consulta pelo coordenador' — falta o instante da decisão.");
        }

        private User staffAccount(UserRole role) {
            return switch (role) {
                case ADMINISTRATOR -> administrator;
                case RESEARCHER -> researcher;
                case COORDINATOR -> coordinator;
                default -> throw new IllegalArgumentException("Perfil fora da equipe: " + role);
            };
        }
    }

    @Nested
    @DisplayName("Decisão fora do estado esperado")
    class DecisionStateRules {

        @Test
        void candidateWithoutCompletedEligibilityCannotDecide_RF09_RF10() throws Exception {
            Candidate notEvaluated = candidacy(study, activeParticipant("sem.avaliacao"), EligibilityStatus.PENDING,
                    null);
            assertDecisionConflict(notEvaluated, "CONSENT_NOT_AVAILABLE", "decisão antes da elegibilidade");
        }

        @Test
        void cancelledCandidacyCannotBeDecided_RF08_RF10() throws Exception {
            expectStatus("RF08", "cancelamento pelo coordenador", 200,
                    post(candidatePath(pending.getId()) + "/cancellation")
                            .header(HttpHeaders.AUTHORIZATION, bearer(tokenFor(coordinator.getEmail())))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Cadastro duplicado\"}"));
            assertDecisionConflict(pending, "CANDIDATE_CANCELLED", "decisão após o cancelamento");
        }

        @Test
        void decisionOutsideRecruitmentIsRejected_RF10() throws Exception {
            setStudyStatus(study.getId(), "EXECUTION");
            assertDecisionConflict(pending, "STUDY_NOT_RECRUITING", "decisão fora do recrutamento");
        }

        @Test
        void onlyGrantedOrDeclinedAreAccepted_RF10() throws Exception {
            String token = tokenFor(owner.getEmail());
            for (String invalid : List.of("PENDING", "TALVEZ", "")) {
                expectStatus("RF10", "decisão com status '" + invalid + "'", 400,
                        decision(token, pending.getId(), invalid));
            }
            assertNull(storedConsent(pending.getId()));
        }

        private void assertDecisionConflict(Candidate candidate, String code, String step) throws Exception {
            User account = userRepository.findById(candidate.getUserId()).orElseThrow();
            List<String> before = flowSnapshot();
            expectCode("RF10", step, 409, code, decision(tokenFor(account.getEmail()), candidate.getId(), "GRANTED"));
            assertEquals(before, flowSnapshot(), "[RF10] passo '" + step + "' — o banco mudou.");
        }
    }

    @Nested
    @DisplayName("Vínculo da conta e convite")
    class AccountLinkAndInvitation {

        @Test
        void deactivatedParticipantAccountIsNotLinked_RF08() throws Exception {
            User deactivated = activeParticipant("conta.desativada");
            deactivated.deactivate();
            userRepository.saveAndFlush(deactivated);
            List<String> before = flowSnapshot();

            expectCode("RF08", "vínculo de conta desativada", 409, "PARTICIPANT_ACCOUNT_DEACTIVATED",
                    registration(deactivated.getEmail()));

            assertEquals(before, flowSnapshot(), "[RF08] passo 'vínculo de conta desativada' — o banco mudou.");
        }

        @Test
        void emailIsMatchedIgnoringCaseAndLinksTheExistingAccount_RF08() throws Exception {
            User existing = activeParticipant("conta.existente");
            Study other = recruitingStudy("Outro estudo do fluxo");
            long accountsBefore = userRepository.count();

            MvcResult linked = expectStatus("RF08", "vínculo com e-mail em maiúsculas", 201,
                    registration(other.getId(), existing.getEmail().toUpperCase(java.util.Locale.ROOT)));
            JsonNode json = objectMapper.readTree(responseBody(linked));

            assertEquals(existing.getId(), json.path("userId").asLong(),
                    "[RF08] passo 'vínculo da conta' — a candidatura não usa a conta existente.");
            assertEquals("ACTIVE", json.path("status").asText());
            assertTrue(json.path("activation").isMissingNode() || json.path("activation").isNull(),
                    "[RF08] passo 'vínculo da conta' — conta ativa não deve receber código.");
            assertEquals(accountsBefore, userRepository.count(), "[RF08] passo 'vínculo da conta' — conta duplicada.");
        }

        @Test
        void sameAccountCannotHaveTwoOpenCandidaciesInTheStudy_RF08() throws Exception {
            List<String> before = flowSnapshot();
            expectCode("RF08", "segunda candidatura da mesma conta", 409, "CANDIDATE_ALREADY_IN_STUDY",
                    registration(owner.getEmail()));
            assertEquals(before, flowSnapshot(), "[RF08] passo 'candidatura duplicada' — o banco mudou.");
        }

        @Test
        void activeAccountDoesNotReceiveANewActivationCode_RF08() throws Exception {
            List<String> before = flowSnapshot();
            expectCode("RF08", "novo código para conta já ativa", 409, "CANDIDATE_ALREADY_ACTIVE",
                    post(candidatePath(pending.getId()) + "/activation-code")
                            .header(HttpHeaders.AUTHORIZATION, bearer(tokenFor(coordinator.getEmail()))));
            assertEquals(before, flowSnapshot(), "[RF08] passo 'novo código para conta ativa' — o banco mudou.");
        }

        @Test
        void cancelledCandidacyDoesNotReceiveANewActivationCode_RF08() throws Exception {
            InvitedCandidate invited = invitedCandidate(study, "convite.cancelado");
            String coordinatorToken = tokenFor(coordinator.getEmail());
            expectStatus("RF08", "cancelamento do convite", 200, post(candidatePath(invited.id()) + "/cancellation")
                    .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                    .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"E-mail digitado errado\"}"));
            List<String> before = flowSnapshot();

            expectCode("RF08", "novo código para candidatura cancelada", 409, "CANDIDATE_CANCELLED",
                    post(candidatePath(invited.id()) + "/activation-code")
                            .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken)));

            assertEquals(before, flowSnapshot(), "[RF08] passo 'novo código após cancelamento' — o banco mudou.");
            expectCode("RF02", "primeiro acesso após o cancelamento", 400, "ACTIVATION_INVALID",
                    activation(invited.email(), invited.activationCode()));
        }

        private MockHttpServletRequestBuilder registration(String email) throws Exception {
            return registration(study.getId(), email);
        }

        private MockHttpServletRequestBuilder registration(Long studyId, String email) throws Exception {
            return post("/api/studies/" + studyId + "/candidates")
                    .header(HttpHeaders.AUTHORIZATION, bearer(tokenFor(coordinator.getEmail())))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(Map.of("name", "Candidata Vínculo", "age", 33,
                            "email", email, "phone", "(83) 96666-0000")));
        }
    }

    private MvcResult expectStatus(String requirement, String step, int expected,
                                   MockHttpServletRequestBuilder request) throws Exception {
        MvcResult result = mockMvc.perform(request).andReturn();
        assertEquals(expected, result.getResponse().getStatus(), () -> failure(requirement, step, expected, result));
        return result;
    }

    private void expectCode(String requirement, String step, int expected, String code,
                            MockHttpServletRequestBuilder request) throws Exception {
        MvcResult result = expectStatus(requirement, step, expected, request);
        String content = responseBody(result);
        String actual = content.isBlank() ? null : objectMapper.readTree(content).path("code").asText(null);
        assertEquals(code, actual, () -> failure(requirement, step, expected, result));
    }

    private static String failure(String requirement, String step, int expected, MvcResult result) {
        return "[" + requirement + "] passo '" + step + "' — esperava " + expected + ", recebeu "
                + result.getResponse().getStatus() + ": " + responseBody(result);
    }

    private MockHttpServletRequestBuilder decision(String token, Long candidateId, String status) {
        return post("/api/me/invitations/" + candidateId + "/decision")
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + status + "\"}");
    }

    private MockHttpServletRequestBuilder activation(String email, String code) throws Exception {
        return post("/api/auth/activation")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email, "activationCode", code)));
    }

    private String candidatePath(Long candidateId) {
        return "/api/studies/" + study.getId() + "/candidates/" + candidateId;
    }

    private String passwordHash(User user) {
        return jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, user.getId());
    }
}
