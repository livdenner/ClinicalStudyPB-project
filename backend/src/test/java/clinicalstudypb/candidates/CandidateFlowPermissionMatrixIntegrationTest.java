package clinicalstudypb.candidates;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Matriz HTTP das rotas do fluxo do candidato da Release 2 (T17.5): cada rota nova ou alterada,
 * chamada por cada perfil (administrador, pesquisador responsável, coordenador, participante dono
 * da candidatura e anônimo), deve responder exatamente o status do contrato.
 *
 * <p>Quando o acesso é recusado (401 ou 403), nenhuma linha das tabelas do fluxo pode mudar. Quando
 * é aceito, a requisição é válida e produz o efeito esperado. Cada falha informa o RF, o passo do
 * fluxo, o perfil e a resposta recebida.
 *
 * <p>Também cobre a sessão restrita do primeiro acesso: com a troca de senha pendente, o candidato
 * só pode trocar a senha e sair.
 *
 * @author Júlia Pamplona
 * @since 2026-11-14
 * @version 0.0.1
 */
class CandidateFlowPermissionMatrixIntegrationTest extends CandidateFlowIntegrationSupport {

    private static final int OK = 200;
    private static final int CREATED = 201;
    private static final int UNAUTHORIZED = 401;
    private static final int FORBIDDEN = 403;

    /** Perfis da matriz; o pesquisador é o responsável pelo estudo e o participante é o dono da candidatura. */
    enum Profile {
        ADMINISTRADOR(UserRole.ADMINISTRATOR),
        PESQUISADOR(UserRole.RESEARCHER),
        COORDENADOR(UserRole.COORDINATOR),
        PARTICIPANTE(UserRole.PARTICIPANT),
        ANONIMO(null);

        private final UserRole role;

        Profile(UserRole role) {
            this.role = role;
        }
    }

    /**
     * As rotas do fluxo e o status esperado para cada perfil, na ordem de {@link Profile}. Os
     * marcadores {studyId}, {candidateId} (candidatura do participante, elegível e aguardando a
     * decisão), {invitedId} (conta convidada, ainda não ativada) e {grantedId} (elegível e com
     * aceite) são preenchidos pelo cenário.
     */
    private static final List<Route> ROUTES = List.of(
            new Route("RF08", "cadastro do candidato e vínculo da conta", HttpMethod.POST,
                    "/api/studies/{studyId}/candidates", """
                    {"name":"Nova Candidata","age":30,"email":"nova.candidata@clinicalstudypb.test",
                     "phone":"(83) 97777-0000"}
                    """, FORBIDDEN, FORBIDDEN, CREATED, FORBIDDEN, UNAUTHORIZED),
            new Route("RF08", "listagem dos candidatos do estudo", HttpMethod.GET,
                    "/api/studies/{studyId}/candidates", null, FORBIDDEN, OK, OK, FORBIDDEN, UNAUTHORIZED),
            new Route("RF08", "consulta de um candidato", HttpMethod.GET,
                    "/api/studies/{studyId}/candidates/{candidateId}", null,
                    FORBIDDEN, OK, OK, FORBIDDEN, UNAUTHORIZED),
            new Route("RF08", "novo código de ativação do convite", HttpMethod.POST,
                    "/api/studies/{studyId}/candidates/{invitedId}/activation-code", null,
                    FORBIDDEN, FORBIDDEN, OK, FORBIDDEN, UNAUTHORIZED),
            new Route("RF08", "cancelamento da candidatura", HttpMethod.POST,
                    "/api/studies/{studyId}/candidates/{candidateId}/cancellation",
                    "{\"reason\":\"Cadastro de teste cancelado\"}",
                    FORBIDDEN, FORBIDDEN, OK, FORBIDDEN, UNAUTHORIZED),
            new Route("RF10", "consulta do consentimento pela equipe", HttpMethod.GET,
                    "/api/studies/{studyId}/candidates/{candidateId}/consent", null,
                    FORBIDDEN, FORBIDDEN, OK, FORBIDDEN, UNAUTHORIZED),
            new Route("RF10", "registro do consentimento pela web (descontinuado)", HttpMethod.PUT,
                    "/api/studies/{studyId}/candidates/{candidateId}/consent", "{\"status\":\"GRANTED\"}",
                    FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN, UNAUTHORIZED),
            new Route("RF10", "lista de convites do candidato no app", HttpMethod.GET,
                    "/api/me/invitations", null, FORBIDDEN, FORBIDDEN, FORBIDDEN, OK, UNAUTHORIZED),
            new Route("RF10", "detalhe do convite com o termo simulado", HttpMethod.GET,
                    "/api/me/invitations/{candidateId}", null, FORBIDDEN, FORBIDDEN, FORBIDDEN, OK, UNAUTHORIZED),
            new Route("RF10", "decisão de consentimento pelo candidato", HttpMethod.POST,
                    "/api/me/invitations/{candidateId}/decision", "{\"status\":\"GRANTED\"}",
                    FORBIDDEN, FORBIDDEN, FORBIDDEN, OK, UNAUTHORIZED),
            new Route("RF11", "inclusão do candidato com aceite", HttpMethod.POST,
                    "/api/studies/{studyId}/candidates/{grantedId}/inclusion", null,
                    FORBIDDEN, FORBIDDEN, CREATED, FORBIDDEN, UNAUTHORIZED),
            new Route("RF02", "troca de senha do usuário autenticado", HttpMethod.PUT, "/api/auth/password",
                    "{\"currentPassword\":\"{password}\",\"newPassword\":\"NovaSenha2026\"}",
                    OK, OK, OK, OK, UNAUTHORIZED),
            new Route("RF02", "primeiro acesso com código de ativação (rota pública)", HttpMethod.POST,
                    "/api/auth/activation", "{\"email\":\"{invitedEmail}\",\"activationCode\":\"{invitedCode}\"}",
                    OK, OK, OK, OK, OK));

    private final Map<Profile, User> accounts = new EnumMap<>(Profile.class);
    private Candidate pending;
    private Candidate granted;
    private InvitedCandidate invited;

    @BeforeEach
    void setUpFlow() throws Exception {
        prepareTeamAndRecruitingStudy();
        User owner = activeParticipant("participante.dono");
        accounts.put(Profile.ADMINISTRADOR, administrator);
        accounts.put(Profile.PESQUISADOR, researcher);
        accounts.put(Profile.COORDENADOR, coordinator);
        accounts.put(Profile.PARTICIPANTE, owner);
        pending = candidacy(study, owner, EligibilityStatus.ELIGIBLE, null);
        granted = candidacy(study, activeParticipant("participante.aceite"), EligibilityStatus.ELIGIBLE,
                ConsentDecision.GRANTED);
        invited = invitedCandidate(study, "convidado.matriz");
    }

    static Stream<Arguments> matrix() {
        return ROUTES.stream().flatMap(route -> Arrays.stream(Profile.values())
                .map(profile -> Arguments.of(route, profile)));
    }

    static Stream<Route> protectedRoutes() {
        return ROUTES.stream().filter(route -> route.expected(Profile.ANONIMO) == UNAUTHORIZED);
    }

    @ParameterizedTest(name = "{0} · {1}")
    @MethodSource("matrix")
    void everyProfileGetsTheContractStatusOnEveryFlowRoute_T17_5(Route route, Profile profile) throws Exception {
        String token = profile.role == null ? null : tokenFor(accounts.get(profile).getEmail());
        List<String> before = flowSnapshot();

        MvcResult result = mockMvc.perform(toRequest(route, token)).andReturn();

        int expected = route.expected(profile);
        assertEquals(expected, result.getResponse().getStatus(), () -> route.failure(profile, expected, result));
        if (expected == UNAUTHORIZED || expected == FORBIDDEN) {
            assertEquals(before, flowSnapshot(), () -> route.describe(profile)
                    + " — o acesso foi recusado, mas o banco mudou.");
        }
        if (route.uri().endsWith("/consent") && route.method() == HttpMethod.PUT && profile.role != null) {
            // Contrato T17.1: a rota antiga recusa todos os perfis com um código próprio.
            assertEquals("CONSENT_DECIDED_BY_CANDIDATE", code(result), () -> route.failure(profile, expected, result));
        }
        if (route.uri().endsWith("/decision") && expected == OK) {
            assertEquals("GRANTED", storedConsent(pending.getId()), () -> route.describe(profile)
                    + " — a decisão do candidato não foi gravada.");
        }
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("protectedRoutes")
    void restrictedFirstAccessSessionOnlyChangesPassword_RF02(Route route) throws Exception {
        String restricted = restrictedSessionFor(invitedCandidate(study, uniqueLocalPart("restrita")));
        List<String> before = flowSnapshot();

        MvcResult result = mockMvc.perform(toRequest(route, restricted)).andReturn();

        if (route.uri().equals("/api/auth/password")) {
            // Primeiro acesso: a senha atual não é exigida e a sessão fica liberada.
            assertEquals(OK, result.getResponse().getStatus(),
                    () -> route.failure("sessão restrita", OK, result));
            return;
        }
        assertEquals(FORBIDDEN, result.getResponse().getStatus(),
                () -> route.failure("sessão restrita", FORBIDDEN, result));
        assertEquals("PASSWORD_CHANGE_REQUIRED", code(result),
                () -> route.failure("sessão restrita", FORBIDDEN, result));
        assertEquals(before, flowSnapshot(), () -> route.describe("sessão restrita")
                + " — o acesso foi recusado, mas o banco mudou.");
    }

    private MockHttpServletRequestBuilder toRequest(Route route, String token) {
        Map<String, String> values = Map.of(
                "studyId", String.valueOf(study.getId()),
                "candidateId", String.valueOf(pending.getId()),
                "grantedId", String.valueOf(granted.getId()),
                "invitedId", String.valueOf(invited.id()),
                "invitedEmail", invited.email(),
                "invitedCode", invited.activationCode(),
                "password", PASSWORD);
        MockHttpServletRequestBuilder builder = request(route.method(), fill(route.uri(), values));
        if (token != null) {
            builder.header(HttpHeaders.AUTHORIZATION, bearer(token));
        }
        if (route.body() != null) {
            builder.contentType(MediaType.APPLICATION_JSON).content(fill(route.body(), values));
        }
        return builder;
    }

    private String code(MvcResult result) throws Exception {
        String content = responseBody(result);
        if (content.isBlank()) {
            return null;
        }
        JsonNode node = objectMapper.readTree(content).path("code");
        return node.isMissingNode() ? null : node.asText();
    }

    private static String fill(String template, Map<String, String> values) {
        String filled = template;
        for (Map.Entry<String, String> value : values.entrySet()) {
            filled = filled.replace("{" + value.getKey() + "}", value.getValue());
        }
        return filled;
    }

    /** Uma linha da matriz: RF, passo do fluxo, rota e o status esperado por perfil. */
    record Route(String requirement, String step, HttpMethod method, String uri, String body, int admin,
                 int researcher, int coordinator, int participant, int anonymous) {

        int expected(Profile profile) {
            return switch (profile) {
                case ADMINISTRADOR -> admin;
                case PESQUISADOR -> researcher;
                case COORDENADOR -> coordinator;
                case PARTICIPANTE -> participant;
                case ANONIMO -> anonymous;
            };
        }

        String describe(Object profile) {
            return "[" + requirement + "] passo '" + step + "' (" + method + " " + uri + ") como " + profile;
        }

        String failure(Object profile, int expected, MvcResult result) {
            return describe(profile) + " — esperava " + expected + ", recebeu "
                    + result.getResponse().getStatus() + ": " + responseBody(result);
        }

        @Override
        public String toString() {
            return requirement + " " + method + " " + uri;
        }
    }
}
