package clinicalstudypb.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Verifica a autorização por perfil com a aplicação completa: cada perfil só alcança os
 * endpoints liberados para ele, e um acesso negado (403) não altera nenhum dado.
 *
 * <p>Os corpos enviados são válidos de propósito: o {@code @Valid} roda antes do
 * {@code @PreAuthorize}, então um corpo inválido daria 400 e esconderia a autorização.
 *
 * @author Júlia Pamplona
 * @since 2026-10-30
 * @version 0.0.1
 */
class AuthorizationIntegrationTest extends IntegrationTestSupport {

    /** Endpoints de usuários; {id} aponta para o coordenador, que não é responsável por estudos. */
    private static final List<Endpoint> USER_ENDPOINTS = List.of(
            new Endpoint(HttpMethod.GET, "/api/users", null),
            new Endpoint(HttpMethod.GET, "/api/users/{id}", null),
            new Endpoint(HttpMethod.POST, "/api/users", """
                    {"name":"Novo Usuário","email":"novo.usuario@clinicalstudypb.test",
                     "password":"Senha@Nova2026","role":"RESEARCHER"}
                    """),
            new Endpoint(HttpMethod.PUT, "/api/users/{id}", """
                    {"name":"Coordenador Renomeado","email":"coordenador.renomeado@clinicalstudypb.test",
                     "role":"COORDINATOR"}
                    """),
            new Endpoint(HttpMethod.PATCH, "/api/users/{id}/activate", null),
            new Endpoint(HttpMethod.PATCH, "/api/users/{id}/deactivate", null),
            new Endpoint(HttpMethod.DELETE, "/api/users/{id}", null));

    /** Endpoints de estudos; {id} aponta para um estudo existente e %d para o pesquisador. */
    private static final List<Endpoint> STUDY_ENDPOINTS = List.of(
            new Endpoint(HttpMethod.GET, "/api/studies", null),
            new Endpoint(HttpMethod.GET, "/api/studies/{id}", null),
            new Endpoint(HttpMethod.POST, "/api/studies", """
                    {"title":"Estudo novo","objective":"Objetivo do estudo novo","responsibleUserId":%d,
                     "startDate":"2027-01-01","endDate":"2027-06-30","participantLimit":30}
                    """),
            new Endpoint(HttpMethod.PUT, "/api/studies/{id}", """
                    {"title":"Estudo alterado","objective":"Objetivo alterado","responsibleUserId":%d,
                     "startDate":"2027-01-01","endDate":"2027-12-31","participantLimit":60}
                    """));

    private User researcher;
    private User coordinator;
    private Study study;

    @BeforeEach
    void setUp() {
        for (UserRole role : UserRole.values()) {
            User user = saveUser("Usuário " + role, emailOf(role), role);
            if (role == UserRole.RESEARCHER) {
                researcher = user;
            } else if (role == UserRole.COORDINATOR) {
                coordinator = user;
            }
        }
        study = studyRepository.save(new Study("Estudo existente", "Objetivo original", researcher.getId(),
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 6, 30), 40));
    }

    static Stream<Arguments> userEndpointsForOtherRoles() {
        return combine(USER_ENDPOINTS, UserRole.ADMINISTRATOR);
    }

    static Stream<Arguments> studyEndpointsForOtherRoles() {
        return combine(STUDY_ENDPOINTS, UserRole.RESEARCHER);
    }

    static Stream<Endpoint> userEndpoints() {
        return USER_ENDPOINTS.stream();
    }

    static Stream<Endpoint> studyEndpoints() {
        return STUDY_ENDPOINTS.stream();
    }

    @ParameterizedTest(name = "{0}: {1}")
    @MethodSource("userEndpointsForOtherRoles")
    void onlyAdministratorManagesUsers_otherRolesAreForbiddenWithoutSideEffects(UserRole role, Endpoint endpoint)
            throws Exception {
        assertForbiddenWithoutSideEffects(role, endpoint, coordinator.getId());
    }

    @ParameterizedTest(name = "{0}: {1}")
    @MethodSource("studyEndpointsForOtherRoles")
    void onlyResearcherManagesStudies_otherRolesAreForbiddenWithoutSideEffects(UserRole role, Endpoint endpoint)
            throws Exception {
        assertForbiddenWithoutSideEffects(role, endpoint, study.getId());
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("userEndpoints")
    void administratorIsAllowedOnEveryUserEndpoint(Endpoint endpoint) throws Exception {
        mockMvc.perform(endpoint.toRequest(tokenFor(emailOf(UserRole.ADMINISTRATOR)), coordinator.getId(),
                        researcher.getId()))
                .andExpect(status().is2xxSuccessful());
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("studyEndpoints")
    void researcherIsAllowedOnEveryStudyEndpoint(Endpoint endpoint) throws Exception {
        mockMvc.perform(endpoint.toRequest(tokenFor(emailOf(UserRole.RESEARCHER)), study.getId(),
                        researcher.getId()))
                .andExpect(status().is2xxSuccessful());
    }

    @ParameterizedTest
    @EnumSource(UserRole.class)
    void everyRoleCanLogout(UserRole role) throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout")
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenFor(emailOf(role)))))
                .andExpect(status().isNoContent());
    }

    private void assertForbiddenWithoutSideEffects(UserRole role, Endpoint endpoint, Long targetId)
            throws Exception {
        List<String> before = databaseSnapshot();

        mockMvc.perform(endpoint.toRequest(tokenFor(emailOf(role)), targetId, researcher.getId()))
                .andExpect(status().isForbidden());

        assertEquals(before, databaseSnapshot());
    }

    /** Estado de todos os usuários e estudos, para comparar antes e depois de um acesso negado. */
    private List<String> databaseSnapshot() {
        Stream<String> users = userRepository.findAll().stream()
                .map(user -> String.join("|", "user", String.valueOf(user.getId()), user.getName(),
                        user.getEmail(), String.valueOf(user.getRole()), String.valueOf(user.isActive())));
        Stream<String> studies = studyRepository.findAll().stream()
                .map(saved -> String.join("|", "study", String.valueOf(saved.getId()), saved.getTitle(),
                        saved.getObjective(), String.valueOf(saved.getResponsibleUserId()),
                        String.valueOf(saved.getStartDate()), String.valueOf(saved.getEndDate()),
                        String.valueOf(saved.getParticipantLimit())));
        return Stream.concat(users, studies).sorted().toList();
    }

    private static Stream<Arguments> combine(List<Endpoint> endpoints, UserRole allowedRole) {
        return Arrays.stream(UserRole.values())
                .filter(role -> role != allowedRole)
                .flatMap(role -> endpoints.stream().map(endpoint -> Arguments.of(role, endpoint)));
    }

    private static String emailOf(UserRole role) {
        return role.name().toLowerCase(Locale.ROOT) + "@clinicalstudypb.test";
    }

    /** Um endpoint da API, com corpo JSON opcional. */
    private record Endpoint(HttpMethod method, String uri, String body) {

        MockHttpServletRequestBuilder toRequest(String token, Long targetId, Long researcherId) {
            MockHttpServletRequestBuilder builder = uri.contains("{id}")
                    ? request(method, uri, targetId)
                    : request(method, uri);
            builder.header(HttpHeaders.AUTHORIZATION, bearer(token));
            if (body != null) {
                builder.contentType(MediaType.APPLICATION_JSON).content(body.formatted(researcherId));
            }
            return builder;
        }

        @Override
        public String toString() {
            return method + " " + uri;
        }
    }
}
