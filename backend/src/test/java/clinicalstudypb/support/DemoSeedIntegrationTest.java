package clinicalstudypb.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
 * @since 2026-11-08
 * @version 0.0.1
 */
class DemoSeedIntegrationTest extends IntegrationTestSupport {

    private static final Path USERS_SEED = Path.of("dev", "seed_demo_users.sql");
    private static final Path STUDIES_SEED = Path.of("dev", "seed_demo_studies.sql");
    private static final String RESEARCHER_EMAIL = "pesquisador@clinicalstudypb.test";
    private static final String DEMO_PASSWORD = "Demo@Clinical2026";

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void criaUmEstudoEmCadaEstadoComHistoricoCoerente() throws IOException {
        runSeeds();

        List<String> statuses = jdbc.queryForList("SELECT status FROM studies ORDER BY status", String.class);
        assertEquals(List.of("CANCELLED", "CLOSED", "EXECUTION", "PLANNING", "RECRUITMENT"), statuses);

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
        assertEquals(5L, first.get("studies"));
    }

    @Test
    void apiLeEstudosVisitasEHistoricoDoSeed() throws Exception {
        runSeeds();
        String token = demoResearcherToken();

        mockMvc.perform(get("/api/studies").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(5));

        long recruiting = studyId("RECRUITMENT");
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
                       (SELECT COUNT(*) FROM planned_activities) AS activities
                """);
    }

    private long studyId(String studyStatus) {
        return jdbc.queryForObject("SELECT id FROM studies WHERE status = ?", Long.class, studyStatus);
    }

    private String demoResearcherToken() throws Exception {
        String response = login(RESEARCHER_EMAIL, DEMO_PASSWORD)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(response).get("accessToken").asText();
    }
}
