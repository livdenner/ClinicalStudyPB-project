package clinicalstudypb.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Verifica a autorização por perfil com a aplicação completa: cada perfil só alcança os
 * endpoints liberados para ele, e um acesso negado (403) não altera nenhum dado.
 *
 * <p>As requisições são válidas de propósito: o {@code @Valid} e os cabeçalhos obrigatórios
 * ({@code If-Match}) são conferidos antes do {@code @PreAuthorize}, então uma requisição
 * inválida daria 400 e esconderia a autorização.
 *
 * <p>Nos endpoints de estudos, o usuário que recebe 403 é o responsável pelo estudo. Assim, a
 * recusa só pode vir da regra de perfil, e não da regra "somente o responsável altera", que
 * responde com o mesmo 403.
 *
 * @author Júlia Pamplona
 * @since 2026-10-30
 * @version 0.0.2
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

    /**
     * Endpoints de estudos, estados e visitas previstas. {id} é o estudo, {visitId} a primeira
     * visita (com duas atividades), {otherVisitId} a segunda e {activityId}/{otherActivityId} as
     * atividades da primeira visita. As leituras (GET) são liberadas também ao coordenador.
     */
    private static final List<Endpoint> STUDY_ENDPOINTS = List.of(
            new Endpoint(HttpMethod.GET, "/api/studies", null),
            new Endpoint(HttpMethod.GET, "/api/studies/{id}", null),
            new Endpoint(HttpMethod.POST, "/api/studies", """
                    {"title":"Estudo novo","objective":"Objetivo do estudo novo","responsibleUserId":{ownerId},
                     "startDate":"2027-01-01","endDate":"2027-06-30","participantLimit":30}
                    """),
            new Endpoint(HttpMethod.PUT, "/api/studies/{id}", """
                    {"title":"Estudo alterado","objective":"Objetivo alterado","responsibleUserId":{ownerId},
                     "startDate":"2027-01-01","endDate":"2027-12-31","participantLimit":60}
                    """),
            new Endpoint(HttpMethod.PATCH, "/api/studies/{id}/status", """
                    {"status":"CANCELLED","expectedStatus":"PLANNING","reason":"Teste de autorização"}
                    """),
            new Endpoint(HttpMethod.GET, "/api/studies/{id}/status-history", null),
            new Endpoint(HttpMethod.GET, "/api/studies/{id}/planned-visits", null),
            new Endpoint(HttpMethod.GET, "/api/studies/{id}/planned-visits/{visitId}", null),
            Endpoint.versioned(HttpMethod.POST, "/api/studies/{id}/planned-visits", """
                    {"name":"Visita nova","plannedDate":"2027-03-01",
                     "activities":[{"name":"Coleta","description":"Coleta de sangue"}]}
                    """),
            Endpoint.versioned(HttpMethod.PUT, "/api/studies/{id}/planned-visits/{visitId}", """
                    {"name":"Visita alterada","plannedDate":"2027-02-15",
                     "activities":[{"id":{activityId},"name":"Entrevista","description":"Histórico clínico"},
                                   {"id":{otherActivityId},"name":"Exame","description":"Exame físico"}]}
                    """),
            Endpoint.versioned(HttpMethod.PUT, "/api/studies/{id}/planned-visits/order", """
                    {"ids":[{otherVisitId},{visitId}]}
                    """),
            Endpoint.versioned(HttpMethod.DELETE, "/api/studies/{id}/planned-visits/{otherVisitId}", null),
            Endpoint.versioned(HttpMethod.DELETE,
                    "/api/studies/{id}/planned-visits/{visitId}/activities/{activityId}", null));

    /** Tabelas comparadas antes e depois de um acesso negado. */
    private static final List<String> SNAPSHOT_TABLES = List.of(
            "users", "studies", "study_status_history", "planned_visits", "planned_activities");

    @Autowired
    private JdbcTemplate jdbc;

    private final Map<UserRole, User> users = new EnumMap<>(UserRole.class);
    private Study study;
    private Long visitId;
    private Long otherVisitId;
    private Long activityId;
    private Long otherActivityId;

    @BeforeEach
    void setUp() {
        for (UserRole role : UserRole.values()) {
            users.put(role, saveUser("Usuário " + role, emailOf(role), role));
        }
        study = studyRepository.save(new Study("Estudo existente", "Objetivo original",
                users.get(UserRole.RESEARCHER).getId(), LocalDate.of(2027, 1, 1), LocalDate.of(2027, 6, 30), 40));
        visitId = insertVisit("Visita inicial", LocalDate.of(2027, 2, 1), 1);
        otherVisitId = insertVisit("Visita final", LocalDate.of(2027, 6, 1), 2);
        activityId = insertActivity(visitId, "Entrevista", "Histórico clínico", 1);
        otherActivityId = insertActivity(visitId, "Exame", "Exame físico", 2);
        insertActivity(otherVisitId, "Entrevista", "Encerramento", 1);
    }

    static Stream<Arguments> userEndpointsForOtherRoles() {
        return combine(USER_ENDPOINTS, UserRole.ADMINISTRATOR);
    }

    static Stream<Arguments> studyEndpointsForOtherRoles() {
        return Arrays.stream(UserRole.values())
                .filter(role -> role != UserRole.RESEARCHER)
                .flatMap(role -> STUDY_ENDPOINTS.stream()
                        .filter(endpoint -> role != UserRole.COORDINATOR || !endpoint.isRead())
                        .map(endpoint -> Arguments.of(role, endpoint)));
    }

    static Stream<Endpoint> userEndpoints() {
        return USER_ENDPOINTS.stream();
    }

    static Stream<Endpoint> studyEndpoints() {
        return STUDY_ENDPOINTS.stream();
    }

    static Stream<Endpoint> studyReadEndpoints() {
        return STUDY_ENDPOINTS.stream().filter(Endpoint::isRead);
    }

    @ParameterizedTest(name = "{0}: {1}")
    @MethodSource("userEndpointsForOtherRoles")
    void onlyAdministratorManagesUsers_otherRolesAreForbiddenWithoutSideEffects(UserRole role, Endpoint endpoint)
            throws Exception {
        assertForbiddenWithoutSideEffects(role, endpoint, users.get(UserRole.COORDINATOR).getId());
    }

    @ParameterizedTest(name = "{0}: {1}")
    @MethodSource("studyEndpointsForOtherRoles")
    void onlyResearcherManagesStudies_otherRolesAreForbiddenWithoutSideEffects(UserRole role, Endpoint endpoint)
            throws Exception {
        // O próprio usuário vira o responsável: a única regra que pode negar é a de perfil.
        makeResponsible(role);
        assertForbiddenWithoutSideEffects(role, endpoint, study.getId());
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("userEndpoints")
    void administratorIsAllowedOnEveryUserEndpoint(Endpoint endpoint) throws Exception {
        mockMvc.perform(toRequest(endpoint, UserRole.ADMINISTRATOR, users.get(UserRole.COORDINATOR).getId()))
                .andExpect(status().is2xxSuccessful());
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("studyEndpoints")
    void researcherIsAllowedOnEveryStudyEndpoint(Endpoint endpoint) throws Exception {
        mockMvc.perform(toRequest(endpoint, UserRole.RESEARCHER, study.getId()))
                .andExpect(status().is2xxSuccessful());
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("studyReadEndpoints")
    void coordinatorCanReadStudiesStatusHistoryAndPlannedVisits(Endpoint endpoint) throws Exception {
        mockMvc.perform(toRequest(endpoint, UserRole.COORDINATOR, study.getId()))
                .andExpect(status().isOk());
    }

    @ParameterizedTest
    @EnumSource(UserRole.class)
    void everyRoleCanLogout(UserRole role) throws Exception {
        mockMvc.perform(post("/api/auth/logout")
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenFor(emailOf(role)))))
                .andExpect(status().isNoContent());
    }

    private void assertForbiddenWithoutSideEffects(UserRole role, Endpoint endpoint, Long targetId)
            throws Exception {
        List<String> before = databaseSnapshot();

        mockMvc.perform(toRequest(endpoint, role, targetId))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Perfil sem permissão para a operação."));

        assertEquals(before, databaseSnapshot());
    }

    /** Monta a requisição com os identificadores do cenário e a versão atual do estudo. */
    private MockHttpServletRequestBuilder toRequest(Endpoint endpoint, UserRole role, Long targetId)
            throws Exception {
        Map<String, Long> ids = Map.of(
                "id", targetId,
                "ownerId", responsibleId(),
                "visitId", visitId,
                "otherVisitId", otherVisitId,
                "activityId", activityId,
                "otherActivityId", otherActivityId);
        MockHttpServletRequestBuilder builder = request(endpoint.method(), fill(endpoint.uri(), ids))
                .header(HttpHeaders.AUTHORIZATION, bearer(tokenFor(emailOf(role))));
        if (endpoint.versioned()) {
            builder.header(HttpHeaders.IF_MATCH, "\"" + studyVersion() + "\"");
        }
        if (endpoint.body() != null) {
            builder.contentType(MediaType.APPLICATION_JSON).content(fill(endpoint.body(), ids));
        }
        return builder;
    }

    private void makeResponsible(UserRole role) {
        jdbc.update("UPDATE studies SET responsible_user_id = ? WHERE id = ?",
                users.get(role).getId(), study.getId());
    }

    private Long responsibleId() {
        return jdbc.queryForObject("SELECT responsible_user_id FROM studies WHERE id = ?", Long.class,
                study.getId());
    }

    private Long studyVersion() {
        return jdbc.queryForObject("SELECT version FROM studies WHERE id = ?", Long.class, study.getId());
    }

    private Long insertVisit(String name, LocalDate date, int position) {
        return jdbc.queryForObject("INSERT INTO planned_visits (study_id, name, planned_date, position) "
                + "VALUES (?, ?, ?, ?) RETURNING id", Long.class, study.getId(), name, date, position);
    }

    private Long insertActivity(Long plannedVisitId, String name, String description, int position) {
        return jdbc.queryForObject("INSERT INTO planned_activities "
                        + "(planned_visit_id, name, name_key, description, position) VALUES (?, ?, ?, ?, ?) "
                        + "RETURNING id", Long.class,
                plannedVisitId, name, name.toLowerCase(Locale.ROOT), description, position);
    }

    /**
     * Todas as linhas das tabelas de usuários, estudos, histórico e visitas, para comparar antes
     * e depois de um acesso negado. Inclui estado, versão e revisão do protocolo do estudo.
     */
    private List<String> databaseSnapshot() {
        return SNAPSHOT_TABLES.stream()
                .flatMap(table -> jdbc.queryForList("SELECT * FROM " + table + " ORDER BY id").stream()
                        .map(row -> table + "|" + row))
                .toList();
    }

    private static String fill(String template, Map<String, Long> ids) {
        String filled = template;
        for (Map.Entry<String, Long> id : ids.entrySet()) {
            filled = filled.replace("{" + id.getKey() + "}", String.valueOf(id.getValue()));
        }
        return filled;
    }

    private static Stream<Arguments> combine(List<Endpoint> endpoints, UserRole allowedRole) {
        return Arrays.stream(UserRole.values())
                .filter(role -> role != allowedRole)
                .flatMap(role -> endpoints.stream().map(endpoint -> Arguments.of(role, endpoint)));
    }

    private static String emailOf(UserRole role) {
        return role.name().toLowerCase(Locale.ROOT) + "@clinicalstudypb.test";
    }

    /** Um endpoint da API, com corpo JSON opcional; {@code versioned} exige o cabeçalho If-Match. */
    private record Endpoint(HttpMethod method, String uri, String body, boolean versioned) {

        Endpoint(HttpMethod method, String uri, String body) {
            this(method, uri, body, false);
        }

        static Endpoint versioned(HttpMethod method, String uri, String body) {
            return new Endpoint(method, uri, body, true);
        }

        boolean isRead() {
            return method == HttpMethod.GET;
        }

        @Override
        public String toString() {
            return method + " " + uri;
        }
    }
}
