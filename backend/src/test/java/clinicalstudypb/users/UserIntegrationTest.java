package clinicalstudypb.users;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Verifica a API de usuários de ponta a ponta: requisição autenticada por JWT real de
 * administrador, regras do serviço e persistência no PostgreSQL com as migrações Flyway.
 *
 * @author Júlia Pamplona
 * @since 2026-10-30
 * @version 0.0.2
 */
class UserIntegrationTest extends IntegrationTestSupport {

    private static final String USERS_URL = "/api/users";
    private static final String ADMIN_EMAIL = "administrador@clinicalstudypb.test";
    private static final String RESEARCHER_EMAIL = "pesquisador@clinicalstudypb.test";
    private static final String NEW_PASSWORD = "Senha@Nova2026";

    private User admin;
    private User researcher;
    private String token;

    @BeforeEach
    void setUp() throws Exception {
        admin = saveUser("Administradora Teste", ADMIN_EMAIL, UserRole.ADMINISTRATOR);
        researcher = saveUser("Pesquisador Teste", RESEARCHER_EMAIL, UserRole.RESEARCHER);
        token = tokenFor(ADMIN_EMAIL);
    }

    @Test
    void createdUserIsStoredWithBcryptHashAndCanLogin() throws Exception {
        Long id = idOf(create(new CreateUserBody("  Nova Pesquisadora  ", "nova@clinicalstudypb.test",
                        NEW_PASSWORD, "RESEARCHER"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Nova Pesquisadora"))
                .andExpect(jsonPath("$.role").value("RESEARCHER"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist()));

        User saved = userRepository.findById(id).orElseThrow();
        assertNotEquals(NEW_PASSWORD, saved.getPasswordHash());
        assertTrue(saved.getPasswordHash().startsWith("{bcrypt}"));
        login("nova@clinicalstudypb.test", NEW_PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id").value(id));
    }

    @Test
    void createResponseLocationPointsToTheNewUser() throws Exception {
        String location = create(new CreateUserBody("Coordenadora", "coordenadora@clinicalstudypb.test",
                        NEW_PASSWORD, "COORDINATOR"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader(HttpHeaders.LOCATION);

        mockMvc.perform(get(location).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("coordenadora@clinicalstudypb.test"))
                .andExpect(jsonPath("$.role").value("COORDINATOR"));
    }

    @Test
    void emailIsStoredInLowerCase() throws Exception {
        Long id = idOf(create(new CreateUserBody("Pesquisadora", "Pesquisadora@ClinicalStudyPB.TEST",
                        NEW_PASSWORD, "RESEARCHER"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("pesquisadora@clinicalstudypb.test")));

        assertEquals("pesquisadora@clinicalstudypb.test", userRepository.findById(id).orElseThrow().getEmail());
    }

    @Test
    void duplicateEmailIgnoringCaseIsAConflict() throws Exception {
        create(new CreateUserBody("Outro Pesquisador", "PESQUISADOR@clinicalstudypb.test", NEW_PASSWORD,
                        "RESEARCHER"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("E-mail já cadastrado: pesquisador@clinicalstudypb.test"));

        assertEquals(2, userRepository.count());
    }

    @Test
    void invalidBodyIsRejectedWithoutCreatingUser() throws Exception {
        mockMvc.perform(post(USERS_URL)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"email\":\"nao-e-email\",\"role\":\"RESEARCHER\"}"))
                .andExpect(status().isBadRequest());

        assertEquals(2, userRepository.count());
    }

    @Test
    void unknownRoleIsRejectedWithoutCreatingUser() throws Exception {
        create(new CreateUserBody("Usuário", "usuario@clinicalstudypb.test", NEW_PASSWORD, "SUPERUSER"))
                .andExpect(status().isBadRequest());

        assertEquals(2, userRepository.count());
    }

    @Test
    void listReturnsEveryUserWithoutPasswordData() throws Exception {
        mockMvc.perform(get(USERS_URL).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[*].email", containsInAnyOrder(ADMIN_EMAIL, RESEARCHER_EMAIL)))
                .andExpect(jsonPath("$[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$[1].passwordHash").doesNotExist());
    }

    @Test
    void listExcludesParticipantAccounts() throws Exception {
        User participant = saveUser("Participante", "participante@clinicalstudypb.test", UserRole.PARTICIPANT);

        mockMvc.perform(get(USERS_URL).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[*].email", containsInAnyOrder(ADMIN_EMAIL, RESEARCHER_EMAIL)));

        assertTrue(userRepository.existsById(participant.getId()));
    }

    @Test
    void createAndUpdateRejectParticipantRoleWithoutChangingUsers() throws Exception {
        create(new CreateUserBody("Participante", "novo.participante@clinicalstudypb.test",
                        NEW_PASSWORD, "PARTICIPANT"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTICIPANT_ROLE_NOT_ALLOWED"));

        update(researcher.getId(), new UpdateUserBody("Nome alterado", "alterado@clinicalstudypb.test",
                        "PARTICIPANT"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTICIPANT_ROLE_NOT_ALLOWED"));

        assertEquals(2, userRepository.count());
        User unchanged = userRepository.findById(researcher.getId()).orElseThrow();
        assertEquals("Pesquisador Teste", unchanged.getName());
        assertEquals(RESEARCHER_EMAIL, unchanged.getEmail());
        assertEquals(UserRole.RESEARCHER, unchanged.getRole());
    }

    @Test
    void participantAccountIsNotAccessibleThroughAdministrativeRoutes() throws Exception {
        User participant = userRepository.save(User.invitedParticipant("Participante",
                "convidado@clinicalstudypb.test", "{bcrypt}senha-inutilizavel"));
        Long id = participant.getId();

        mockMvc.perform(get(USERS_URL + "/{id}", id).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isNotFound());
        update(id, new UpdateUserBody("Outro nome", "outro@clinicalstudypb.test", "RESEARCHER"))
                .andExpect(status().isNotFound());
        mockMvc.perform(patch(USERS_URL + "/{id}/activate", id)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isNotFound());
        mockMvc.perform(patch(USERS_URL + "/{id}/deactivate", id)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete(USERS_URL + "/{id}", id).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isNotFound());

        User unchanged = userRepository.findById(id).orElseThrow();
        assertEquals("Participante", unchanged.getName());
        assertEquals("convidado@clinicalstudypb.test", unchanged.getEmail());
        assertEquals(UserRole.PARTICIPANT, unchanged.getRole());
        assertFalse(unchanged.isActive());
        assertTrue(unchanged.isActivationPending());
    }

    @Test
    void getReturnsTheStoredUser() throws Exception {
        mockMvc.perform(get(USERS_URL + "/{id}", researcher.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(researcher.getId()))
                .andExpect(jsonPath("$.name").value("Pesquisador Teste"))
                .andExpect(jsonPath("$.email").value(RESEARCHER_EMAIL))
                .andExpect(jsonPath("$.role").value("RESEARCHER"))
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void unknownUserIsNotFound() throws Exception {
        mockMvc.perform(get(USERS_URL + "/{id}", 999_999).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Usuário não encontrado: 999999"));
    }

    @Test
    void updatePersistsDetailsAndRoleAndTheNewEmailIsUsedToLogin() throws Exception {
        update(researcher.getId(), new UpdateUserBody("Coordenador Promovido", "Promovido@ClinicalStudyPB.test",
                        "COORDINATOR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Coordenador Promovido"))
                .andExpect(jsonPath("$.email").value("promovido@clinicalstudypb.test"))
                .andExpect(jsonPath("$.role").value("COORDINATOR"));

        User saved = userRepository.findById(researcher.getId()).orElseThrow();
        assertEquals("promovido@clinicalstudypb.test", saved.getEmail());
        assertEquals(UserRole.COORDINATOR, saved.getRole());
        login(RESEARCHER_EMAIL, PASSWORD).andExpect(status().isUnauthorized());
        login("promovido@clinicalstudypb.test", PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("COORDINATOR"));
    }

    @Test
    void updateKeepingTheSameEmailIsAccepted() throws Exception {
        update(researcher.getId(), new UpdateUserBody("Pesquisador Renomeado", RESEARCHER_EMAIL, "RESEARCHER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Pesquisador Renomeado"));
    }

    @Test
    void updateToAnEmailOfAnotherUserIsAConflictAndKeepsTheStoredData() throws Exception {
        update(researcher.getId(), new UpdateUserBody("Nome Novo", ADMIN_EMAIL, "COORDINATOR"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("E-mail já cadastrado: " + ADMIN_EMAIL));

        User saved = userRepository.findById(researcher.getId()).orElseThrow();
        assertEquals("Pesquisador Teste", saved.getName());
        assertEquals(RESEARCHER_EMAIL, saved.getEmail());
        assertEquals(UserRole.RESEARCHER, saved.getRole());
    }

    @Test
    void updateOfUnknownUserIsNotFound() throws Exception {
        update(999_999L, new UpdateUserBody("Ninguém", "ninguem@clinicalstudypb.test", "RESEARCHER"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deactivatedUserIsKeptAndCanBeReactivatedToLoginAgain() throws Exception {
        mockMvc.perform(patch(USERS_URL + "/{id}/deactivate", researcher.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
        assertFalse(userRepository.findById(researcher.getId()).orElseThrow().isActive());
        login(RESEARCHER_EMAIL, PASSWORD).andExpect(status().isUnauthorized());

        mockMvc.perform(patch(USERS_URL + "/{id}/activate", researcher.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
        assertTrue(userRepository.findById(researcher.getId()).orElseThrow().isActive());
        login(RESEARCHER_EMAIL, PASSWORD).andExpect(status().isOk());
    }

    @Test
    void deleteRemovesTheUser() throws Exception {
        mockMvc.perform(delete(USERS_URL + "/{id}", researcher.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isNoContent());

        assertFalse(userRepository.existsById(researcher.getId()));
        mockMvc.perform(get(USERS_URL + "/{id}", researcher.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteOfUnknownUserIsNotFound() throws Exception {
        mockMvc.perform(delete(USERS_URL + "/{id}", 999_999).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isNotFound());

        assertEquals(2, userRepository.count());
    }

    @Test
    void researcherResponsibleForAStudyCannotBeDeleted() throws Exception {
        studyRepository.save(new Study("Estudo em andamento", "Objetivo", researcher.getId(),
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 6, 30), 30));

        mockMvc.perform(delete(USERS_URL + "/{id}", researcher.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Dados em conflito com um registro existente."));

        assertTrue(userRepository.existsById(researcher.getId()));
        assertEquals(1, studyRepository.count());
    }

    @Test
    void administratorCanEditOwnNameAndEmailButCannotChangeRoleDeactivateOrDeleteSelf() throws Exception {
        update(admin.getId(), new UpdateUserBody("Administradora Renomeada", "admin.novo@clinicalstudypb.test",
                        "ADMINISTRATOR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Administradora Renomeada"))
                .andExpect(jsonPath("$.email").value("admin.novo@clinicalstudypb.test"))
                .andExpect(jsonPath("$.role").value("ADMINISTRATOR"));

        update(admin.getId(), new UpdateUserBody("Outro Nome", "admin.novo@clinicalstudypb.test", "RESEARCHER"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SELF_ACCOUNT_CHANGE_NOT_ALLOWED"));

        mockMvc.perform(patch(USERS_URL + "/{id}/deactivate", admin.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SELF_ACCOUNT_CHANGE_NOT_ALLOWED"));

        mockMvc.perform(delete(USERS_URL + "/{id}", admin.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SELF_ACCOUNT_CHANGE_NOT_ALLOWED"));

        User stored = userRepository.findById(admin.getId()).orElseThrow();
        assertTrue(stored.isActive());
        assertEquals(UserRole.ADMINISTRATOR, stored.getRole());
        assertEquals("Administradora Renomeada", stored.getName());
        assertEquals("admin.novo@clinicalstudypb.test", stored.getEmail());
    }

    @Test
    void lastActiveAdministratorCannotBeDemotedDeactivatedOrDeleted() throws Exception {
        String secondAdminEmail = "admin2@clinicalstudypb.test";
        User secondAdmin = saveUser("Segundo Admin", secondAdminEmail, UserRole.ADMINISTRATOR);
        String secondAdminToken = tokenFor(secondAdminEmail);

        mockMvc.perform(patch(USERS_URL + "/{id}/deactivate", secondAdmin.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(put(USERS_URL + "/{id}", admin.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(secondAdminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new UpdateUserBody("Administradora Teste", ADMIN_EMAIL, "COORDINATOR"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LAST_ACTIVE_ADMINISTRATOR"));

        mockMvc.perform(patch(USERS_URL + "/{id}/deactivate", admin.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(secondAdminToken)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LAST_ACTIVE_ADMINISTRATOR"));

        mockMvc.perform(delete(USERS_URL + "/{id}", admin.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(secondAdminToken)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LAST_ACTIVE_ADMINISTRATOR"));

        User remainingAdmin = userRepository.findById(admin.getId()).orElseThrow();
        assertTrue(remainingAdmin.isActive());
        assertEquals(UserRole.ADMINISTRATOR, remainingAdmin.getRole());
    }

    @Test
    void concurrentDeactivationOfTwoActiveAdministratorsKeepsOneActive() throws Exception {
        String secondAdminEmail = "admin.concorrente@clinicalstudypb.test";
        User secondAdmin = saveUser("Admin Concorrente", secondAdminEmail, UserRole.ADMINISTRATOR);
        String secondAdminToken = tokenFor(secondAdminEmail);

        List<ConcurrentResult> results = runConcurrently(
                () -> deactivateAndCapture(secondAdmin.getId(), token),
                () -> deactivateAndCapture(admin.getId(), secondAdminToken));

        List<Integer> statuses = results.stream().map(ConcurrentResult::status).sorted().toList();
        assertEquals(List.of(HttpStatus.OK.value(), HttpStatus.CONFLICT.value()), statuses);

        ConcurrentResult conflict = results.stream()
                .filter(result -> result.status() == HttpStatus.CONFLICT.value())
                .findFirst()
                .orElseThrow();
        assertEquals("LAST_ACTIVE_ADMINISTRATOR", conflict.code());

        long activeAdmins = userRepository.findAll().stream()
                .filter(user -> user.getRole() == UserRole.ADMINISTRATOR && user.isActive())
                .count();
        assertEquals(1, activeAdmins);
    }

    private ConcurrentResult deactivateAndCapture(Long targetUserId, String actorToken) throws Exception {
        MvcResult result = mockMvc.perform(patch(USERS_URL + "/{id}/deactivate", targetUserId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(actorToken)))
                .andReturn();
        int statusCode = result.getResponse().getStatus();
        String code = null;
        if (statusCode == HttpStatus.CONFLICT.value()) {
            code = objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                    .get("code").asText();
        }
        return new ConcurrentResult(statusCode, code);
    }

    private static List<ConcurrentResult> runConcurrently(
            Callable<ConcurrentResult> first,
            Callable<ConcurrentResult> second) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch release = new CountDownLatch(1);
        try {
            List<Future<ConcurrentResult>> futures = List.of(
                    executor.submit(() -> awaitAndCall(ready, release, first)),
                    executor.submit(() -> awaitAndCall(ready, release, second)));
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            release.countDown();
            return List.of(futures.get(0).get(30, TimeUnit.SECONDS), futures.get(1).get(30, TimeUnit.SECONDS));
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
    }

    private static ConcurrentResult awaitAndCall(
            CountDownLatch ready,
            CountDownLatch release,
            Callable<ConcurrentResult> call) throws Exception {
        ready.countDown();
        if (!release.await(10, TimeUnit.SECONDS)) {
            throw new IllegalStateException("A requisição concorrente não foi liberada.");
        }
        return call.call();
    }

    private ResultActions create(CreateUserBody body) throws Exception {
        return mockMvc.perform(post(USERS_URL)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    private ResultActions update(Long id, UpdateUserBody body) throws Exception {
        return mockMvc.perform(put(USERS_URL + "/{id}", id)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    private Long idOf(ResultActions created) throws Exception {
        String response = created
                .andExpect(header().exists(HttpHeaders.LOCATION))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(response).get("id").asLong();
    }

    private record CreateUserBody(String name, String email, String password, String role) {
    }

    private record UpdateUserBody(String name, String email, String role) {
    }

    private record ConcurrentResult(int status, String code) {
    }
}
