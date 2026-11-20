package clinicalstudypb.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Garante que os scripts de demonstração de {@code backend/dev} (T16.3) continuam válidos para o
 * esquema atual: rodam no PostgreSQL real, podem ser repetidos sem duplicar dados e produzem
 * estudos que a API lê e altera como se tivessem sido criados por ela.
 *
 * @author Júlia Pamplona
 * @since 2026-11-09
 * @version 0.0.1
 */
class DemoSeedIntegrationTest extends IntegrationTestSupport {

    private static final Path USERS_SEED = Path.of("dev", "seed_demo_users.sql");
    private static final Path STUDIES_SEED = Path.of("dev", "seed_demo_studies.sql");
    private static final Path RECRUITMENT_SEED = Path.of("dev", "seed_demo_recruitment.sql");
    private static final Path FOLLOWUP_SEED = Path.of("dev", "seed_demo_followup.sql");
    private static final String RESEARCHER_EMAIL = "pesquisador@clinicalstudypb.test";
    private static final String COORDINATOR_EMAIL = "coordenador@clinicalstudypb.test";
    private static final String DEMO_PASSWORD = "Demo@Clinical2026";
    private static final String HYPERTENSION_STUDY = "Adesão ao tratamento da hipertensão arterial";
    private static final String INFLUENZA_STUDY = "Vacina contra influenza em idosos";
    private static final String LAST_VACANCY_STUDY = "Higiene do sono em trabalhadores noturnos";
    private static final String INCLUDED_CANDIDATE = "Antônia Ferreira Lima";
    private static final String FOLLOWUP_STUDY = "Controle glicêmico no diabetes tipo 2";
    private static final String PARTICIPANT_EMAIL = "participante@clinicalstudypb.test";
    private static final String DEMO_PARTICIPANT = "Participante Demo";
    private static final String INVITE_EMAIL = "convite@clinicalstudypb.test";
    private static final String INVITED_CANDIDATE = "Rosa Helena Prates";
    private static final String INVITE_CODE = "CONVITE-DEMO-2026";
    private static final String JSON_DECLINED = "{\"status\":\"DECLINED\"}";

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void candidatosCobremTodasAsSituacoesDeRecrutamento() throws IOException {
        runSeeds();

        // Inclui as duas candidaturas do acompanhamento: Participante Demo e o convite pendente.
        assertEquals(List.of("ELIGIBLE", "ELIGIBLE", "ELIGIBLE", "ELIGIBLE", "ELIGIBLE", "ELIGIBLE", "ELIGIBLE",
                        "INELIGIBLE", "PENDING", "PENDING"),
                jdbc.queryForList("""
                        SELECT c.eligibility_status FROM candidates c JOIN studies s ON s.id = c.study_id
                         WHERE s.title = ? ORDER BY c.eligibility_status
                        """, String.class, INFLUENZA_STUDY));

        // Mesma regra da API: com todas as respostas, atende à inclusão e não atende à exclusão.
        assertNone("""
                SELECT COUNT(*) FROM candidates c
                 WHERE (SELECT COUNT(*) FROM eligibility_answers a WHERE a.candidate_id = c.id)
                       = (SELECT COUNT(*) FROM study_criteria k WHERE k.study_id = c.study_id)
                   AND c.eligibility_status <> CASE WHEN EXISTS (
                           SELECT 1 FROM eligibility_answers a JOIN study_criteria k ON k.id = a.criterion_id
                            WHERE a.candidate_id = c.id AND a.matches <> (k.type = 'INCLUSION'))
                       THEN 'INELIGIBLE' ELSE 'ELIGIBLE' END
                """);
        assertNone("""
                SELECT COUNT(*) FROM candidates c
                 WHERE c.eligibility_status <> 'PENDING'
                   AND NOT EXISTS (SELECT 1 FROM eligibility_evaluations e WHERE e.candidate_id = c.id)
                """);
    }

    @Test
    void estadosDoEstudoSaoCoerentesComCriteriosECandidatos() throws IOException {
        runSeeds();

        assertNone("SELECT COUNT(*) FROM candidates c JOIN studies s ON s.id = c.study_id WHERE s.status = 'PLANNING'");
        assertNone("""
                SELECT COUNT(*) FROM studies s
                 WHERE NOT EXISTS (SELECT 1 FROM study_criteria k WHERE k.study_id = s.id AND k.type = 'INCLUSION')
                    OR NOT EXISTS (SELECT 1 FROM study_criteria k WHERE k.study_id = s.id AND k.type = 'EXCLUSION')
                """);
        assertNone("""
                SELECT COUNT(*) FROM studies s
                 WHERE s.status IN ('EXECUTION', 'CLOSED')
                   AND NOT EXISTS (SELECT 1 FROM participants p WHERE p.study_id = s.id)
                """);
    }

    @Test
    void participantesRespeitamAsRegrasDeInclusao() throws IOException {
        runSeeds();

        assertNone("""
                SELECT COUNT(*) FROM participants p
                  JOIN candidates c ON c.id = p.candidate_id
                  LEFT JOIN simulated_consents sc ON sc.candidate_id = c.id
                 WHERE c.eligibility_status <> 'ELIGIBLE' OR sc.status IS DISTINCT FROM 'GRANTED'
                    OR NOT sc.locked_after_inclusion
                """);
        assertNone("""
                SELECT COUNT(*) FROM simulated_consents sc
                 WHERE sc.locked_after_inclusion
                   AND NOT EXISTS (SELECT 1 FROM participants p WHERE p.candidate_id = sc.candidate_id)
                """);
        assertNone("""
                SELECT COUNT(*) FROM studies s
                 WHERE (SELECT COUNT(*) FROM participants p WHERE p.study_id = s.id) > s.participant_limit
                """);
        // A inclusão só acontece com o recrutamento aberto.
        assertNone("""
                SELECT COUNT(*) FROM participants p
                 WHERE p.included_at < (SELECT MIN(h.changed_at) FROM study_status_history h
                                         WHERE h.study_id = p.study_id AND h.to_status = 'RECRUITMENT')
                    OR EXISTS (SELECT 1 FROM study_status_history h
                                WHERE h.study_id = p.study_id AND h.from_status = 'RECRUITMENT'
                                  AND h.changed_at < p.included_at)
                """);
    }

    @Test
    void estudoDeUltimaVagaTemUmaVagaEDoisCandidatosProntos() throws IOException {
        runSeeds();

        Map<String, Object> scenario = jdbc.queryForMap("""
                SELECT s.status,
                       s.participant_limit - (SELECT COUNT(*) FROM participants p WHERE p.study_id = s.id) AS free,
                       (SELECT COUNT(*) FROM candidates c
                          JOIN simulated_consents sc ON sc.candidate_id = c.id
                         WHERE c.study_id = s.id AND c.eligibility_status = 'ELIGIBLE' AND sc.status = 'GRANTED'
                           AND NOT EXISTS (SELECT 1 FROM participants p WHERE p.candidate_id = c.id)) AS ready
                  FROM studies s WHERE s.title = ?
                """, LAST_VACANCY_STUDY);

        assertEquals("RECRUITMENT", scenario.get("status"));
        assertEquals(1L, ((Number) scenario.get("free")).longValue());
        assertEquals(2L, ((Number) scenario.get("ready")).longValue());
    }

    @Test
    void apiLeCandidatosElegibilidadeEConsentimentoDoSeed() throws Exception {
        runSeeds();
        long study = studyIdByTitle(INFLUENZA_STUDY);
        long candidate = candidateId(INCLUDED_CANDIDATE);
        String token = bearer(demoToken(COORDINATOR_EMAIL));

        mockMvc.perform(get("/api/studies/" + study + "/criteria").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));
        mockMvc.perform(get("/api/studies/" + study + "/candidates").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(10));
        mockMvc.perform(get("/api/studies/" + study + "/candidates/" + candidate + "/eligibility")
                        .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ELIGIBLE"))
                .andExpect(jsonPath("$.answers.length()").value(3));
        mockMvc.perform(get("/api/studies/" + study + "/candidates/" + candidate + "/consent")
                        .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GRANTED"))
                .andExpect(jsonPath("$.recordedByUserId").value(candidateUserId(INCLUDED_CANDIDATE)));
        // No fluxo da Release 2, toda decisão é do próprio candidato.
        assertNone("""
                SELECT COUNT(*) FROM simulated_consents sc JOIN candidates c ON c.id = sc.candidate_id
                 WHERE sc.recorded_by_user_id IS DISTINCT FROM c.user_id
                """);
    }

    @Test
    void apiTrataParticipanteDoSeedComoJaIncluido() throws Exception {
        runSeeds();
        long study = studyIdByTitle(INFLUENZA_STUDY);
        long candidate = candidateId(INCLUDED_CANDIDATE);
        String token = bearer(demoToken(COORDINATOR_EMAIL));

        mockMvc.perform(put("/api/studies/" + study + "/candidates/" + candidate + "/consent")
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON_DECLINED))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CONSENT_DECIDED_BY_CANDIDATE"));
        mockMvc.perform(put("/api/studies/" + study + "/candidates/" + candidate + "/eligibility")
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\":[{\"criterionId\":1,\"matches\":true}]}"))
                .andExpect(status().isConflict());
    }

    @Test
    void apiRecusaCandidatoDuplicadoDoSeed() throws Exception {
        runSeeds();

        String email = jdbc.queryForObject("""
                SELECT c.email FROM candidates c JOIN studies s ON s.id = c.study_id
                 WHERE s.title = ? AND c.name = ?
                """, String.class, INFLUENZA_STUDY, INCLUDED_CANDIDATE);
        mockMvc.perform(post("/api/studies/" + studyIdByTitle(INFLUENZA_STUDY) + "/candidates")
                        .header(HttpHeaders.AUTHORIZATION, bearer(demoToken(COORDINATOR_EMAIL)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "ANTÔNIA FERREIRA LIMA",
                                "age", 71, "email", email, "phone", "(83) 99999-0000"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CANDIDATE_ALREADY_IN_STUDY"));
    }

    @Test
    void estudoEmPlanejamentoPodeAbrirRecrutamentoPelaApi() throws Exception {
        runSeeds();
        long study = studyIdByTitle(HYPERTENSION_STUDY);

        mockMvc.perform(patch("/api/studies/" + study + "/status")
                        .header(HttpHeaders.AUTHORIZATION, bearer(demoResearcherToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RECRUITMENT\",\"expectedStatus\":\"PLANNING\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RECRUITMENT"));
    }

    @Test
    void semOsEstudosDeDemonstracaoFalhaSemGravarRecrutamento() throws IOException {
        run(USERS_SEED);

        DataAccessException error = assertThrows(DataAccessException.class, () -> run(RECRUITMENT_SEED));

        assertTrue(error.getMostSpecificCause().getMessage().contains("seed_demo_studies.sql"),
                error.getMostSpecificCause().getMessage());
        assertNone("SELECT COUNT(*) FROM study_criteria");
    }

    @Test
    void naoSobrescreveEstudoQueJaTemCriterios() throws Exception {
        runSeeds();
        long study = studyIdByTitle(HYPERTENSION_STUDY);
        jdbc.update("DELETE FROM study_criteria WHERE study_id = ? AND type = 'INCLUSION'", study);

        run(RECRUITMENT_SEED);

        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM study_criteria WHERE study_id = ?",
                Integer.class, study));
    }

    @Test
    void criaUmEstudoEmCadaEstadoComHistoricoCoerente() throws IOException {
        runSeeds();

        List<String> statuses = jdbc.queryForList("SELECT status FROM studies ORDER BY status", String.class);
        assertEquals(List.of("CANCELLED", "CLOSED", "EXECUTION", "PLANNING", "RECRUITMENT", "RECRUITMENT"), statuses);

        // O último registro do histórico leva ao estado atual; sem histórico, o estudo está em PLANNING.
        Integer incoherent = jdbc.queryForObject("""
                SELECT COUNT(*) FROM studies s
                 WHERE s.status <> COALESCE((SELECT h.to_status FROM study_status_history h
                                              WHERE h.study_id = s.id ORDER BY h.id DESC LIMIT 1), 'PLANNING')
                """, Integer.class);
        assertEquals(0, incoherent);

        // Mesmas regras que a API aplica às visitas: pelo menos uma atividade e data no período do estudo.
        Integer invalidVisits = jdbc.queryForObject("""
                SELECT COUNT(*) FROM planned_visits v JOIN studies s ON s.id = v.study_id
                 WHERE v.planned_date NOT BETWEEN s.start_date AND s.end_date
                    OR NOT EXISTS (SELECT 1 FROM planned_activities a WHERE a.planned_visit_id = v.id)
                """, Integer.class);
        assertEquals(0, invalidVisits);
    }

    @Test
    void rodarDeNovoNaoDuplicaDados() throws IOException {
        runSeeds();
        Map<String, Object> first = counts();

        runSeeds();

        assertEquals(first, counts());
        assertEquals(26L, first.get("users"));
        assertEquals(6L, first.get("studies"));
        assertEquals(14L, first.get("criteria"));
        assertEquals(24L, first.get("candidates"));
        assertEquals(22L, first.get("invites"));
        assertEquals(51L, first.get("answers"));
        assertEquals(22L, first.get("evaluations"));
        assertEquals(15L, first.get("consents"));
        assertEquals(11L, first.get("participants"));
        assertEquals(9L, first.get("scheduledVisits"));
        assertEquals(6L, first.get("results"));
        assertEquals(1L, first.get("withdrawn"));
    }

    @Test
    void apiLeEstudosVisitasEHistoricoDoSeed() throws Exception {
        runSeeds();
        String token = demoResearcherToken();

        mockMvc.perform(get("/api/studies").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6));

        long recruiting = studyIdByTitle(INFLUENZA_STUDY);
        mockMvc.perform(get("/api/studies/" + recruiting + "/planned-visits")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].position").value(1))
                .andExpect(jsonPath("$[0].activities.length()").value(2))
                .andExpect(jsonPath("$[2].position").value(3));

        mockMvc.perform(get("/api/studies/" + studyId("CLOSED") + "/status-history")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[2].fromStatus").value("EXECUTION"))
                .andExpect(jsonPath("$[2].toStatus").value("CLOSED"));
    }

    @Test
    void estudoCanceladoPodeSerRestauradoPelaApi() throws Exception {
        runSeeds();
        long cancelled = studyId("CANCELLED");

        // A API só restaura para o estado de origem, lido da última linha do histórico.
        mockMvc.perform(patch("/api/studies/" + cancelled + "/status")
                        .header(HttpHeaders.AUTHORIZATION, bearer(demoResearcherToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RECRUITMENT\",\"expectedStatus\":\"CANCELLED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RECRUITMENT"));

        assertEquals("RECRUITMENT",
                jdbc.queryForObject("SELECT status FROM studies WHERE id = ?", String.class, cancelled));
    }

    @Test
    void semAsContasDeDemonstracaoFalhaSemGravarEstudos() {
        DataAccessException error = assertThrows(DataAccessException.class, () -> run(STUDIES_SEED));

        assertTrue(error.getMostSpecificCause().getMessage().contains("seed_demo_users.sql"),
                error.getMostSpecificCause().getMessage());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM studies", Integer.class));
    }

    @Test
    void coordenadorVeAceiteRecusaEConvitesNaSituacaoDaApi() throws Exception {
        runSeeds();
        String token = bearer(demoToken(COORDINATOR_EMAIL));

        Map<String, String> influenza = candidateStatuses(studyIdByTitle(INFLUENZA_STUDY), token);
        assertEquals("INCLUDED", influenza.get(INCLUDED_CANDIDATE));
        assertEquals("GRANTED", influenza.get("Conceição Alves Prado"));
        assertEquals("DECLINED", influenza.get("Elza Martins Teixeira"));
        assertEquals("INVITED", influenza.get("Domingos Pereira Dias"));
        assertEquals("CONSENT_PENDING", influenza.get(DEMO_PARTICIPANT));
        assertEquals("INVITED", influenza.get(INVITED_CANDIDATE));

        // Com o aceite do candidato, a última vaga pode ser disputada pela web.
        Map<String, String> lastVacancy = candidateStatuses(studyIdByTitle(LAST_VACANCY_STUDY), token);
        assertEquals("GRANTED", lastVacancy.get("Vera Lúcia Fonseca"));
        assertEquals("GRANTED", lastVacancy.get("Wilson Barbosa Leite"));

        // Quem decidiu já ativou a conta: o convite foi consumido antes da decisão.
        assertNone("""
                SELECT COUNT(*) FROM simulated_consents sc
                  JOIN candidates c ON c.id = sc.candidate_id
                  JOIN users u ON u.id = c.user_id
                  LEFT JOIN candidate_activation_invites i ON i.user_id = u.id
                 WHERE u.activation_pending OR NOT u.active
                    OR (i.user_id IS NOT NULL AND (i.used_at IS NULL OR i.used_at > sc.recorded_at))
                """);
    }

    @Test
    void conviteComCodigoConhecidoPermitePrimeiroAcesso() throws Exception {
        runSeeds();

        mockMvc.perform(post("/api/auth/activation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", INVITE_EMAIL, "activationCode", INVITE_CODE))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("PARTICIPANT"))
                .andExpect(jsonPath("$.user.mustChangePassword").value(true));
    }

    @Test
    void rodarDeNovoRenovaOCodigoAindaNaoUsado() throws Exception {
        runSeeds();
        jdbc.update("""
                UPDATE candidate_activation_invites
                   SET created_at = CURRENT_TIMESTAMP - INTERVAL '80 hours',
                       expires_at = CURRENT_TIMESTAMP - INTERVAL '8 hours'
                 WHERE user_id = (SELECT id FROM users WHERE email = ?)
                """, INVITE_EMAIL);

        run(FOLLOWUP_SEED);

        assertEquals(1, jdbc.queryForObject("""
                SELECT COUNT(*) FROM candidate_activation_invites i JOIN users u ON u.id = i.user_id
                 WHERE u.email = ? AND i.used_at IS NULL AND i.expires_at > CURRENT_TIMESTAMP + INTERVAL '71 hours'
                """, Integer.class, INVITE_EMAIL));
        mockMvc.perform(post("/api/auth/activation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", INVITE_EMAIL, "activationCode", INVITE_CODE))))
                .andExpect(status().isOk());
    }

    @Test
    void participanteDemoVeEstudosVisitasEConviteNoAplicativo() throws Exception {
        runSeeds();
        String token = bearer(demoToken(PARTICIPANT_EMAIL));

        mockMvc.perform(get("/api/me/studies").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].studyTitle").value(FOLLOWUP_STUDY));
        mockMvc.perform(get("/api/me/visits").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.upcoming.length()").value(1))
                .andExpect(jsonPath("$.upcoming[0].status").value("SCHEDULED"))
                .andExpect(jsonPath("$.history.length()").value(1))
                .andExpect(jsonPath("$.history[0].status").value("DONE"));

        long invitation = jdbc.queryForObject("""
                SELECT c.id FROM candidates c JOIN studies s ON s.id = c.study_id
                 WHERE s.title = ? AND c.email = ?
                """, Long.class, INFLUENZA_STUDY, PARTICIPANT_EMAIL);
        mockMvc.perform(get("/api/me/invitations?status=CONSENT_PENDING").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].candidateId").value(invitation));
        mockMvc.perform(post("/api/me/invitations/" + invitation + "/decision")
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"GRANTED\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void acompanhamentoCobreDesfechosResultadosERetirada() throws Exception {
        runSeeds();
        long study = studyIdByTitle(FOLLOWUP_STUDY);

        Map<String, Long> byStatus = jdbc.query("""
                        SELECT status, COUNT(*) AS total FROM scheduled_visits WHERE study_id = ? GROUP BY status
                        """, (rs, row) -> Map.entry(rs.getString("status"), rs.getLong("total")), study)
                .stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        assertEquals(Map.of("SCHEDULED", 3L, "DONE", 3L, "ABSENT", 1L, "CANCELLED", 2L), byStatus);
        // Mesmas regras da API: resultado só em visita realizada; desfecho final com autoria e instante.
        assertNone("""
                SELECT COUNT(*) FROM activity_results r JOIN scheduled_visits v ON v.id = r.scheduled_visit_id
                 WHERE v.status <> 'DONE' OR r.recorded_at < v.outcome_at
                """);
        assertNone("""
                SELECT COUNT(*) FROM scheduled_visits
                 WHERE (status = 'SCHEDULED') <> (outcome_at IS NULL AND outcome_by_user_id IS NULL AND version = 0)
                    OR created_at >= scheduled_at
                """);
        // A retirada cancelou a visita futura, como POST .../withdrawal.
        Map<String, Object> withdrawal = jdbc.queryForMap("""
                SELECT p.withdrawal_cancelled_visit_count AS cancelled,
                       (SELECT COUNT(*) FROM scheduled_visits v
                         WHERE v.participant_id = p.id AND v.status = 'CANCELLED'
                           AND v.outcome_note = 'Retirada do participante'
                           AND v.outcome_at = p.withdrawn_at) AS matching,
                       (SELECT COUNT(*) FROM scheduled_visits v
                         WHERE v.participant_id = p.id AND v.status = 'SCHEDULED') AS pending
                  FROM participants p WHERE p.status = 'WITHDRAWN'
                """);
        assertEquals(1, ((Number) withdrawal.get("cancelled")).intValue());
        assertEquals(1L, ((Number) withdrawal.get("matching")).longValue());
        assertEquals(0L, ((Number) withdrawal.get("pending")).longValue());

        String token = bearer(demoToken(COORDINATOR_EMAIL));
        mockMvc.perform(get("/api/studies/" + study + "/visits").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(9));
        Map<String, Object> done = jdbc.queryForMap("""
                SELECT v.id, v.participant_id FROM scheduled_visits v
                  JOIN participants p ON p.id = v.participant_id JOIN candidates c ON c.id = p.candidate_id
                 WHERE c.name = 'Irene Gomes Vieira' AND v.status = 'DONE'
                """);
        mockMvc.perform(get("/api/studies/" + study + "/participants/" + done.get("participant_id") + "/visits/"
                        + done.get("id") + "/results").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"))
                .andExpect(jsonPath("$.activities.length()").value(2))
                .andExpect(jsonPath("$.activities[0].result.value").value("7,8%"))
                .andExpect(jsonPath("$.activities[1].result.value").value("Plano alimentar entregue"));
    }

    @Test
    void ajustaDecisoesDeBancosCarregadosAntesDaT266() throws IOException {
        runSeeds();
        long user = candidateUserId("Conceição Alves Prado");
        // Estado de um banco carregado com a versão anterior do script.
        jdbc.update("UPDATE users SET active = FALSE, activation_pending = TRUE WHERE id = ?", user);
        jdbc.update("UPDATE candidate_activation_invites SET used_at = NULL WHERE user_id = ?", user);
        jdbc.update("""
                UPDATE simulated_consents SET recorded_by_user_id = NULL
                 WHERE candidate_id IN (SELECT id FROM candidates
                                         WHERE email LIKE 'demo-candidate-%@clinicalstudypb.invalid')
                """);

        run(RECRUITMENT_SEED);
        Map<String, Object> afterFix = counts();
        run(RECRUITMENT_SEED);

        assertEquals(afterFix, counts());
        assertNone("""
                SELECT COUNT(*) FROM simulated_consents sc JOIN candidates c ON c.id = sc.candidate_id
                 WHERE sc.recorded_by_user_id IS DISTINCT FROM c.user_id
                """);
        assertEquals(Boolean.FALSE, jdbc.queryForObject(
                "SELECT activation_pending FROM users WHERE id = ?", Boolean.class, user));
        assertEquals(1, jdbc.queryForObject("""
                SELECT COUNT(*) FROM candidate_activation_invites WHERE user_id = ? AND used_at IS NOT NULL
                """, Integer.class, user));
    }

    @Test
    void semORecrutamentoFalhaSemGravarAcompanhamento() throws IOException {
        run(USERS_SEED);
        run(STUDIES_SEED);
        long users = jdbc.queryForObject("SELECT COUNT(*) FROM users", Long.class);

        DataAccessException error = assertThrows(DataAccessException.class, () -> run(FOLLOWUP_SEED));

        assertTrue(error.getMostSpecificCause().getMessage().contains("seed_demo_recruitment.sql"),
                error.getMostSpecificCause().getMessage());
        assertEquals(users, jdbc.queryForObject("SELECT COUNT(*) FROM users", Long.class));
        assertNone("SELECT COUNT(*) FROM scheduled_visits");
    }

    private Map<String, String> candidateStatuses(long study, String token) throws Exception {
        String body = mockMvc.perform(get("/api/studies/" + study + "/candidates")
                        .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String, String> statuses = new HashMap<>();
        objectMapper.readTree(body).forEach(node -> statuses.put(node.get("name").asText(),
                node.get("status").asText()));
        return statuses;
    }

    private void runSeeds() throws IOException {
        run(USERS_SEED);
        run(STUDIES_SEED);
        run(RECRUITMENT_SEED);
        run(FOLLOWUP_SEED);
    }

    private void assertNone(String countQuery) {
        assertEquals(0, jdbc.queryForObject(countQuery, Integer.class), countQuery);
    }

    /** Executa o arquivo inteiro de uma vez, como o {@code psql -f} da stack de demonstração. */
    private void run(Path script) throws IOException {
        jdbc.execute(Files.readString(script, StandardCharsets.UTF_8));
    }

    private Map<String, Object> counts() {
        return jdbc.queryForMap("""
                SELECT (SELECT COUNT(*) FROM users) AS users,
                       (SELECT COUNT(*) FROM studies) AS studies,
                       (SELECT COUNT(*) FROM study_status_history) AS history,
                       (SELECT COUNT(*) FROM planned_visits) AS visits,
                       (SELECT COUNT(*) FROM planned_activities) AS activities,
                       (SELECT COUNT(*) FROM study_criteria) AS criteria,
                       (SELECT COUNT(*) FROM candidates) AS candidates,
                       (SELECT COUNT(*) FROM candidate_activation_invites) AS invites,
                       (SELECT COUNT(*) FROM eligibility_answers) AS answers,
                       (SELECT COUNT(*) FROM eligibility_evaluations) AS evaluations,
                       (SELECT COUNT(*) FROM simulated_consents) AS consents,
                       (SELECT COUNT(*) FROM participants) AS participants,
                       (SELECT COUNT(*) FROM participants WHERE status = 'WITHDRAWN') AS withdrawn,
                       (SELECT COUNT(*) FROM scheduled_visits) AS "scheduledVisits",
                       (SELECT COUNT(*) FROM activity_results) AS results
                """);
    }

    private long studyIdByTitle(String title) {
        return jdbc.queryForObject("SELECT id FROM studies WHERE title = ?", Long.class, title);
    }

    private long candidateId(String name) {
        return jdbc.queryForObject("SELECT id FROM candidates WHERE name = ?", Long.class, name);
    }

    private long candidateUserId(String name) {
        return jdbc.queryForObject("SELECT user_id FROM candidates WHERE name = ?", Long.class, name);
    }

    private long studyId(String studyStatus) {
        return jdbc.queryForObject("SELECT id FROM studies WHERE status = ?", Long.class, studyStatus);
    }

    private String demoResearcherToken() throws Exception {
        return demoToken(RESEARCHER_EMAIL);
    }

    private String demoToken(String email) throws Exception {
        String response = login(email, DEMO_PASSWORD)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(response).get("accessToken").asText();
    }
}
