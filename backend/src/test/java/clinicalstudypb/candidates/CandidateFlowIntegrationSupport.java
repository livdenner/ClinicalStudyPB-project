package clinicalstudypb.candidates;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.consent.domain.SimulatedConsent;
import clinicalstudypb.consent.infrastructure.SimulatedConsentRepository;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Cenário comum dos testes do fluxo do candidato da Release 2 (T17.5): vínculo da conta,
 * convite com código de ativação, primeiro acesso, troca de senha, decisão de consentimento
 * pelo próprio candidato e inclusão.
 *
 * <p>Os estados de elegibilidade e consentimento são gravados direto no banco, sem passar pelas
 * rotas de escrita: assim o cenário não depende da rota de consentimento descontinuada do
 * coordenador nem da regra que está sendo testada. Todos os dados são fictícios
 * ({@code @clinicalstudypb.test}).
 *
 * @author Júlia Pamplona
 * @since 2026-11-14
 * @version 0.0.1
 */
abstract class CandidateFlowIntegrationSupport extends IntegrationTestSupport {

    /** Tabelas do fluxo comparadas antes e depois de uma requisição que não deve alterar nada. */
    private static final List<String> FLOW_TABLES = List.of(
            "users", "candidates", "candidate_activation_invites", "simulated_consents", "participants");

    @Autowired
    protected CandidateRepository candidateRepository;

    @Autowired
    protected SimulatedConsentRepository consentRepository;

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    private JwtEncoder jwtEncoder;

    /** Equipe e estudo em recrutamento, com uma visita prevista para o termo do convite. */
    protected User administrator;
    protected User researcher;
    protected User coordinator;
    protected Study study;

    protected void prepareTeamAndRecruitingStudy() {
        administrator = saveUser("Administradora Fluxo", "admin.fluxo@clinicalstudypb.test",
                UserRole.ADMINISTRATOR);
        researcher = saveUser("Pesquisadora Fluxo", "pesquisa.fluxo@clinicalstudypb.test", UserRole.RESEARCHER);
        coordinator = saveUser("Coordenadora Fluxo", "coordena.fluxo@clinicalstudypb.test",
                UserRole.COORDINATOR);
        study = recruitingStudy("Estudo do fluxo do candidato");
    }

    /** Estudo em RECRUITMENT com uma visita e uma atividade, criado direto no banco. */
    protected Study recruitingStudy(String title) {
        Study created = studyRepository.saveAndFlush(new Study(title, "Objetivo fictício do estudo",
                researcher.getId(), LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 10));
        Long visitId = jdbc.queryForObject("INSERT INTO planned_visits (study_id, name, planned_date, position) "
                + "VALUES (?, 'Visita inicial', ?, 1) RETURNING id", Long.class, created.getId(),
                LocalDate.of(2027, 2, 1));
        jdbc.update("INSERT INTO planned_activities (planned_visit_id, name, name_key, description, position) "
                + "VALUES (?, 'Entrevista', 'entrevista', 'Histórico clínico fictício', 1)", visitId);
        setStudyStatus(created.getId(), "RECRUITMENT");
        return studyRepository.findById(created.getId()).orElseThrow();
    }

    protected void setStudyStatus(Long studyId, String status) {
        jdbc.update("UPDATE studies SET status = ? WHERE id = ?", status, studyId);
    }

    /** Conta PARTICIPANT ativa, com a senha padrão dos testes, como a de quem já concluiu o primeiro acesso. */
    protected User activeParticipant(String localPart) {
        return saveUser("Participante " + localPart, localPart + "@clinicalstudypb.test", UserRole.PARTICIPANT);
    }

    /** Candidatura vinculada à conta, com a elegibilidade e o consentimento indicados (null = pendente). */
    protected Candidate candidacy(Study owner, User account, EligibilityStatus eligibility,
                                  ConsentDecision consent) {
        Candidate saved = candidateRepository.saveAndFlush(new Candidate(owner.getId(), account.getName(),
                account.getName().toLowerCase(Locale.ROOT), 40, account.getEmail(), "(83) 90000-0000",
                account.getId()));
        if (eligibility != EligibilityStatus.PENDING) {
            jdbc.update("UPDATE candidates SET eligibility_status = ? WHERE id = ?", eligibility.name(),
                    saved.getId());
        }
        if (consent != null) {
            consentRepository.saveAndFlush(new SimulatedConsent(saved.getId(), consent,
                    Instant.now().truncatedTo(ChronoUnit.MICROS)));
        }
        return candidateRepository.findById(saved.getId()).orElseThrow();
    }

    /** Cadastra pela API um candidato com e-mail novo: conta convidada e código de ativação. */
    protected InvitedCandidate invitedCandidate(Study owner, String localPart) throws Exception {
        String email = localPart + "@clinicalstudypb.test";
        MvcResult result = mockMvc.perform(post("/api/studies/" + owner.getId() + "/candidates")
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenFor(coordinator.getEmail())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Convidado " + localPart,
                                "age", 35, "email", email, "phone", "(83) 98888-0000"))))
                .andReturn();
        assertEquals(201, result.getResponse().getStatus(),
                () -> "[RF08] passo 'cadastro do candidato convidado' — esperava 201: " + responseBody(result));
        JsonNode created = objectMapper.readTree(responseBody(result));
        return new InvitedCandidate(created.path("id").asLong(), email,
                created.path("activation").path("activationCode").asText());
    }

    /** Faz o primeiro acesso e devolve o token da sessão restrita (troca de senha pendente). */
    protected String restrictedSessionFor(InvitedCandidate invited) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/activation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", invited.email(),
                                "activationCode", invited.activationCode()))))
                .andReturn();
        assertEquals(200, result.getResponse().getStatus(),
                () -> "[RF02] passo 'primeiro acesso com código' — esperava 200: " + responseBody(result));
        return objectMapper.readTree(responseBody(result)).path("accessToken").asText();
    }

    /** JWT assinado com a chave dos testes, mas vencido há uma hora. */
    protected String expiredTokenFor(User user) {
        Instant twoHoursAgo = Instant.now().minusSeconds(7200);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("clinicalstudypb")
                .subject(user.getEmail())
                .issuedAt(twoHoursAgo)
                .expiresAt(twoHoursAgo.plusSeconds(3600))
                .claim("userId", user.getId())
                .claim("role", user.getRole().name())
                .build();
        return jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
    }

    /** Linhas das tabelas do fluxo, para provar que uma requisição recusada não gravou nada. */
    protected List<String> flowSnapshot() {
        return FLOW_TABLES.stream()
                .flatMap(table -> jdbc.queryForList("SELECT * FROM " + table + " ORDER BY 1").stream()
                        .map(row -> table + "|" + row))
                .toList();
    }

    /** Decisão gravada para a candidatura, ou null quando ainda não há decisão. */
    protected String storedConsent(Long candidateId) {
        return jdbc.queryForList("SELECT status FROM simulated_consents WHERE candidate_id = ?", String.class,
                candidateId).stream().findFirst().orElse(null);
    }

    protected long participantCount(Long studyId) {
        Long count = jdbc.queryForObject("SELECT COUNT(*) FROM participants WHERE study_id = ?", Long.class,
                studyId);
        return count == null ? 0 : count;
    }

    /** Corpo da resposta em UTF-8, para as mensagens de falha e a leitura do JSON. */
    protected static String responseBody(MvcResult result) {
        try {
            return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        } catch (java.io.UnsupportedEncodingException exception) {
            return "(corpo ilegível)";
        }
    }

    protected static String uniqueLocalPart(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    /** Candidato convidado pela API: identificador, e-mail e código de ativação devolvido ao coordenador. */
    protected record InvitedCandidate(Long id, String email, String activationCode) {
    }
}
