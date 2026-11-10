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
import java.util.List;
import java.util.Map;
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
    private static final String RESEARCHER_EMAIL = "pesquisador@clinicalstudypb.test";
    private static final String COORDINATOR_EMAIL = "coordenador@clinicalstudypb.test";
    private static final String DEMO_PASSWORD = "Demo@Clinical2026";
    private static final String HYPERTENSION_STUDY = "Adesão ao tratamento da hipertensão arterial";
    private static final String INFLUENZA_STUDY = "Vacina contra influenza em idosos";
    private static final String LAST_VACANCY_STUDY = "Higiene do sono em trabalhadores noturnos";
    private static final String INCLUDED_CANDIDATE = "Antônia Ferreira Lima";
    private static final String JSON_DECLINED = "{\"status\":\"DECLINED\"}";

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void candidatosCobremTodasAsSituacoesDeRecrutamento() throws IOException {
        runSeeds();

        assertEquals(List.of("ELIGIBLE", "ELIGIBLE", "ELIGIBLE", "ELIGIBLE", "ELIGIBLE",
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
                .andExpect(jsonPath("$.length()").value(8));
        mockMvc.perform(get("/api/studies/" + study + "/candidates/" + candidate + "/eligibility")
                        .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ELIGIBLE"))
                .andExpect(jsonPath("$.answers.length()").value(3));
        mockMvc.perform(get("/api/studies/" + study + "/candidates/" + candidate + "/consent")
                        .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GRANTED"));
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
                .andExpect(status().isConflict());
        mockMvc.perform(put("/api/studies/" + study + "/candidates/" + candidate + "/eligibility")
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\":[{\"criterionId\":1,\"matches\":true}]}"))
                .andExpect(status().isConflict());
    }

    @Test
    void apiRecusaCandidatoDuplicadoDoSeed() throws Exception {
        runSeeds();

        // Confere que o name_key gravado pelo script é o mesmo que a API calcula.
        mockMvc.perform(post("/api/studies/" + studyIdByTitle(INFLUENZA_STUDY) + "/candidates")
                        .header(HttpHeaders.AUTHORIZATION, bearer(demoToken(COORDINATOR_EMAIL)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"ANTÔNIA FERREIRA LIMA\",\"age\":71}"))
                .andExpect(status().isConflict());
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
        assertEquals(4L, first.get("users"));
        assertEquals(6L, first.get("studies"));
        assertEquals(14L, first.get("criteria"));
        assertEquals(21L, first.get("candidates"));
        assertEquals(43L, first.get("answers"));
        assertEquals(19L, first.get("evaluations"));
        assertEquals(14L, first.get("consents"));
        assertEquals(10L, first.get("participants"));
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

    private void runSeeds() throws IOException {
        run(USERS_SEED);
        run(STUDIES_SEED);
        run(RECRUITMENT_SEED);
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
                       (SELECT COUNT(*) FROM eligibility_answers) AS answers,
                       (SELECT COUNT(*) FROM eligibility_evaluations) AS evaluations,
                       (SELECT COUNT(*) FROM simulated_consents) AS consents,
                       (SELECT COUNT(*) FROM participants) AS participants
                """);
    }

    private long studyIdByTitle(String title) {
        return jdbc.queryForObject("SELECT id FROM studies WHERE title = ?", Long.class, title);
    }

    private long candidateId(String name) {
        return jdbc.queryForObject("SELECT id FROM candidates WHERE name = ?", Long.class, name);
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
