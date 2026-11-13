package clinicalstudypb.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.candidates.application.CandidateInvitationService;
import clinicalstudypb.candidates.infrastructure.CandidateActivationInviteRepository;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.Instant;
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

/** Verifica o primeiro acesso e a sessão restrita no PostgreSQL descartável. */
class ActivationIntegrationTest extends IntegrationTestSupport {

    private static final String EMAIL = "first.access@test.local";

    @Autowired
    private CandidateInvitationService invitationService;

    @Autowired
    private CandidateActivationInviteRepository invitationRepository;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private User invited;
    private String code;

    @BeforeEach
    void prepareInvitation() {
        invited = userRepository.saveAndFlush(User.invitedParticipant("Convidado", EMAIL,
                "{bcrypt}$2a$10$XvTRsPld615GPVfvH3j3fuIKUt4rxnR2D5IRbtCKk/WoUOM6m7ooy"));
        code = invitationService.issue(invited.getId()).value();
    }

    @Test
    void validCodeActivatesAccountButKeepsPasswordAndCodePending() throws Exception {
        String token = activate(EMAIL, code)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.active").value(true))
                .andExpect(jsonPath("$.user.mustChangePassword").value(true))
                .andExpect(jsonPath("$.accessToken").isString())
                .andReturn().getResponse().getContentAsString();
        String accessToken = objectMapper.readTree(token).path("accessToken").asText();
        User saved = userRepository.findById(invited.getId()).orElseThrow();
        assertTrue(saved.isActive());
        assertTrue(saved.isActivationPending());
        assertNull(invitationRepository.findById(saved.getId()).orElseThrow().getUsedAt());
        mockMvc.perform(get("/api/users").header(HttpHeaders.AUTHORIZATION, bearer(accessToken)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));
        mockMvc.perform(post("/api/auth/logout").header(HttpHeaders.AUTHORIZATION, bearer(accessToken)))
                .andExpect(status().isNoContent());
        activate(EMAIL, code).andExpect(status().isOk());
    }

    @Test
    void settingInitialPasswordConsumesCodeUnlocksSessionAndAllowsLogin() throws Exception {
        String restrictedBody = activate(EMAIL, code)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String restrictedToken = objectMapper.readTree(restrictedBody).path("accessToken").asText();

        String updatedBody = changePassword(restrictedToken, null, "NovaSenha2026")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.active").value(true))
                .andExpect(jsonPath("$.user.mustChangePassword").value(false))
                .andExpect(jsonPath("$.accessToken").isString())
                .andReturn().getResponse().getContentAsString();
        String unrestrictedToken = objectMapper.readTree(updatedBody).path("accessToken").asText();

        User saved = userRepository.findById(invited.getId()).orElseThrow();
        assertTrue(saved.isActive());
        assertFalse(saved.isActivationPending());
        assertNotNull(invitationRepository.findById(saved.getId()).orElseThrow().getUsedAt());

        activate(EMAIL, code)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ACTIVATION_INVALID"));

        changePassword(restrictedToken, null, "OutraSenha2026")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CURRENT_PASSWORD_INVALID"));

        mockMvc.perform(get("/api/studies").header(HttpHeaders.AUTHORIZATION, bearer(unrestrictedToken)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        login(EMAIL, "NovaSenha2026")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.mustChangePassword").value(false));
    }

    @Test
    void invalidInitialPasswordKeepsInvitePendingAndAllowsRetry() throws Exception {
        String restrictedBody = activate(EMAIL, code)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String restrictedToken = objectMapper.readTree(restrictedBody).path("accessToken").asText();

        changePassword(restrictedToken, null, "fraca")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_POLICY"));

        User saved = userRepository.findById(invited.getId()).orElseThrow();
        assertTrue(saved.isActivationPending());
        assertNull(invitationRepository.findById(saved.getId()).orElseThrow().getUsedAt());
        activate(EMAIL, code).andExpect(status().isOk());
    }

    @Test
    void regularUserPasswordChangeRequiresCurrentPasswordAndUpdatesLogin() throws Exception {
        String staffEmail = "equipe.senha@test.local";
        saveUser("Pesquisador Senha", staffEmail, UserRole.RESEARCHER);
        String token = tokenFor(staffEmail);

        changePassword(token, null, "NovaSenha2026")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CURRENT_PASSWORD_INVALID"));
        changePassword(token, "Errada2026", "NovaSenha2026")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CURRENT_PASSWORD_INVALID"));
        changePassword(token, PASSWORD, "SemDigito")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_POLICY"));
        changePassword(token, PASSWORD, "NovaSenha2026")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.mustChangePassword").value(false));

        login(staffEmail, PASSWORD).andExpect(status().isUnauthorized());
        login(staffEmail, "NovaSenha2026").andExpect(status().isOk());
    }

    @Test
    void passwordChangeWithoutTokenIsUnauthorized() throws Exception {
        mockMvc.perform(put("/api/auth/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PasswordBody(null, "NovaSenha2026"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidCodeOrUnknownEmailDoesNotActivateAccount() throws Exception {
        activate(EMAIL, "wrong-code").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ACTIVATION_INVALID"));
        activate("unknown@test.local", code).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ACTIVATION_INVALID"));
        assertFalse(userRepository.findById(invited.getId()).orElseThrow().isActive());
    }

    @Test
    void expiredCodeIsGoneAndDoesNotActivateAccount() throws Exception {
        jdbc.update("UPDATE candidate_activation_invites SET created_at = ?, expires_at = ? WHERE user_id = ?",
                java.sql.Timestamp.from(Instant.now().minusSeconds(7200)),
                java.sql.Timestamp.from(Instant.now().minusSeconds(1)), invited.getId());
        activate(EMAIL, code).andExpect(status().isGone())
                .andExpect(jsonPath("$.code").value("ACTIVATION_EXPIRED"));
        assertFalse(userRepository.findById(invited.getId()).orElseThrow().isActive());
    }

    @Test
    void replacedCodeIsRejected() throws Exception {
        String previous = code;
        code = invitationService.issue(invited.getId()).value();
        activate(EMAIL, previous).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ACTIVATION_INVALID"));
        activate(EMAIL, code).andExpect(status().isOk());
    }

    @Test
    void invalidActivationPayloadReturnsActivationInvalidProblemDetail() throws Exception {
        activate("invalido", " ")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("ACTIVATION_INVALID"));
        User saved = userRepository.findById(invited.getId()).orElseThrow();
        assertFalse(saved.isActive());
    }

    @Test
    void activationWaitsForConcurrentInviteReplacementAndRejectsPreviousCode() throws Exception {
        String previous = code;
        CountDownLatch requestStarted = new CountDownLatch(1);
        ExecutorService executor = Executors.newSingleThreadExecutor();

        try {
            Future<ResultActions> response = new TransactionTemplate(transactionManager).execute(transaction -> {
                userRepository.findForUpdate(invited.getId()).orElseThrow();
                Future<ResultActions> request = executor.submit(() -> {
                    requestStarted.countDown();
                    return activate(EMAIL, previous);
                });
                try {
                    assertTrue(requestStarted.await(5, TimeUnit.SECONDS));
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("Aguardando início da ativação concorrente.", exception);
                }
                try {
                    assertTrue(awaitUsersRowLockWait(),
                            "A ativação deve aguardar o bloqueio da conta ao validar o código.");
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("Aguardando bloqueio da conta na ativação.", exception);
                }
                code = invitationService.issue(invited.getId()).value();
                return request;
            });

            assertNotNull(response);
            response.get(10, TimeUnit.SECONDS)
                    .andExpect(status().isBadRequest())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.code").value("ACTIVATION_INVALID"));
            User saved = userRepository.findById(invited.getId()).orElseThrow();
            assertFalse(saved.isActive());
            assertTrue(saved.isActivationPending());
        } finally {
            executor.shutdownNow();
        }
    }

    private boolean awaitUsersRowLockWait() throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (System.nanoTime() < deadline) {
            // PostgreSQL may cache pg_stat_activity snapshots for the surrounding transaction.
            jdbc.execute("SELECT pg_stat_clear_snapshot()");
            Integer waitingQueries = jdbc.queryForObject("SELECT COUNT(*) FROM pg_stat_activity "
                    + "WHERE wait_event_type = 'Lock' AND query ILIKE '%users%'", Integer.class);
            if (waitingQueries != null && waitingQueries > 0) {
                return true;
            }
            Thread.sleep(25);
        }
        return false;
    }

    private ResultActions activate(String email, String activationCode) throws Exception {
        return mockMvc.perform(post("/api/auth/activation")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ActivationBody(email, activationCode))));
    }

    private ResultActions changePassword(String accessToken, String currentPassword, String newPassword)
            throws Exception {
        return mockMvc.perform(put("/api/auth/password")
                .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new PasswordBody(currentPassword, newPassword))));
    }

    private record ActivationBody(String email, String activationCode) {
    }

    private record PasswordBody(String currentPassword, String newPassword) {
    }
}
