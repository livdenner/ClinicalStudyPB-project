package clinicalstudypb.studies;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.criteria.domain.CriterionType;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Percorre pela API o encadeamento de RF05 a RF07 no PostgreSQL real (T16.4): criar o estudo,
 * cadastrar critérios, definir visitas previstas e avançar o estado.
 *
 * <p>Nada é simulado: a prontidão para o recrutamento vem do {@code StudyCriterionService} real, e
 * cada cenário confere as linhas gravadas no banco. O contrato isolado da rota de critérios fica em
 * {@code StudyCriterionIntegrationTest} (T9.2).
 *
 * @author Júlia Pamplona
 * @since 2026-11-09
 * @version 0.0.1
 */
class StudyProtocolFlowIntegrationTest extends IntegrationTestSupport {

    private static final String RESEARCHER_EMAIL = "protocolo.responsavel@clinicalstudypb.test";
    private static final String OTHER_RESEARCHER_EMAIL = "protocolo.outro@clinicalstudypb.test";
    private static final String OPEN_RECRUITMENT = "{\"status\":\"RECRUITMENT\",\"expectedStatus\":\"PLANNING\"}";
    private static final String VALID_VISIT = """
            {"name":"Triagem","plannedDate":"2027-02-01",
             "activities":[{"name":"Entrevista","description":"Histórico clínico"}]}
            """;
    private static final long MISSING_ID = 999_999L;

    @Autowired
    private JdbcTemplate jdbc;

    private User researcher;
    private String token;
    private long studyId;

    @BeforeEach
    void setUp() throws Exception {
        researcher = saveUser("Pesquisador responsável", RESEARCHER_EMAIL, UserRole.RESEARCHER);
        token = tokenFor(RESEARCHER_EMAIL);
        studyId = createStudy();
    }

    @Test
    void fluxoCompletoGravaProtocoloEAbreRecrutamento() throws Exception {
        addCriterion(CriterionType.INCLUSION, "  Ter 18 anos ou mais  ").andExpect(status().isCreated());
        addCriterion(CriterionType.EXCLUSION, "Estar em gestação").andExpect(status().isCreated());
        addVisit(VALID_VISIT, etag()).andExpect(status().isCreated());

        changeStatus(OPEN_RECRUITMENT, token)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RECRUITMENT"));

        assertEquals(List.of(Map.of("type", "INCLUSION", "description", "Ter 18 anos ou mais"),
                        Map.of("type", "EXCLUSION", "description", "Estar em gestação")),
                jdbc.queryForList("SELECT type, description FROM study_criteria WHERE study_id = ? ORDER BY id",
                        studyId));
        assertEquals(Map.of("name", "Triagem", "position", 1),
                jdbc.queryForMap("SELECT name, position FROM planned_visits WHERE study_id = ?", studyId));
        assertEquals(Map.of("name", "Entrevista", "name_key", "entrevista", "description", "Histórico clínico"),
                jdbc.queryForMap("""
                        SELECT a.name, a.name_key, a.description FROM planned_activities a
                          JOIN planned_visits v ON v.id = a.planned_visit_id WHERE v.study_id = ?
                        """, studyId));
        assertEquals("RECRUITMENT", storedStatus());
        assertEquals(Map.of("from_status", "PLANNING", "to_status", "RECRUITMENT", "actor_user_id", researcher.getId()),
                jdbc.queryForMap("SELECT from_status, to_status, actor_user_id FROM study_status_history "
                        + "WHERE study_id = ?", studyId));
    }

    @Test
    void recrutamentoExigeVisitaComAtividadeAntesDosCriterios() throws Exception {
        addCriterion(CriterionType.INCLUSION, "Ter 18 anos ou mais").andExpect(status().isCreated());
        addCriterion(CriterionType.EXCLUSION, "Estar em gestação").andExpect(status().isCreated());

        changeStatus(OPEN_RECRUITMENT, token)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail", containsString("visita prevista")));

        assertStaysInPlanning();
    }

    @Test
    void recrutamentoExigeCriterios() throws Exception {
        addVisit(VALID_VISIT, etag()).andExpect(status().isCreated());

        changeStatus(OPEN_RECRUITMENT, token)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail", containsString("critérios de inclusão e exclusão")));

        assertStaysInPlanning();
    }

    @Test
    void execucaoExigeParticipanteIncluido() throws Exception {
        prepareProtocol();
        changeStatus(OPEN_RECRUITMENT, token).andExpect(status().isOk());

        changeStatus("{\"status\":\"EXECUTION\",\"expectedStatus\":\"RECRUITMENT\"}", token)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail", containsString("participante")));

        assertEquals("RECRUITMENT", storedStatus());
        assertEquals(1, count("study_status_history"));
    }

    @Test
    void voltarAoPlanejamentoPreservaCriteriosEVisitas() throws Exception {
        prepareProtocol();
        changeStatus(OPEN_RECRUITMENT, token).andExpect(status().isOk());

        changeStatus("{\"status\":\"PLANNING\",\"expectedStatus\":\"RECRUITMENT\"}", token)
                .andExpect(status().isOk());

        assertEquals("PLANNING", storedStatus());
        assertEquals(2, count("study_criteria"));
        assertEquals(1, count("planned_visits"));
        changeStatus(OPEN_RECRUITMENT, token).andExpect(status().isOk());
        assertEquals(3, count("study_status_history"));
    }

    @Test
    void cadastrarCriterioInvalidaVersaoUsadaPelasVisitas() throws Exception {
        String staleVersion = etag();
        addCriterion(CriterionType.INCLUSION, "Ter 18 anos ou mais").andExpect(status().isCreated());

        addVisit(VALID_VISIT, staleVersion).andExpect(status().isConflict());

        assertEquals(0, count("planned_visits"));
    }

    @ParameterizedTest
    @EnumSource(value = StudyStatus.class, names = {"EXECUTION", "CLOSED", "CANCELLED"})
    void protocoloNaoMudaForaDosEstadosEditaveis(StudyStatus state) throws Exception {
        prepareProtocol();
        jdbc.update("UPDATE studies SET status = ? WHERE id = ?", state.name(), studyId);

        addVisit(VALID_VISIT.replace("Triagem", "Visita tardia"), etag()).andExpect(status().isConflict());

        assertEquals(1, count("planned_visits"));
    }

    @Test
    void estadoInvalidoRetorna400SemAlterarEstudo() throws Exception {
        changeStatus("{\"status\":\"INEXISTENTE\",\"expectedStatus\":\"PLANNING\"}", token)
                .andExpect(status().isBadRequest());

        assertStaysInPlanning();
    }

    @Test
    void somenteOResponsavelAlteraOProtocolo() throws Exception {
        saveUser("Outro pesquisador", OTHER_RESEARCHER_EMAIL, UserRole.RESEARCHER);
        String otherToken = tokenFor(OTHER_RESEARCHER_EMAIL);
        prepareProtocol();

        changeStatus(OPEN_RECRUITMENT, otherToken).andExpect(status().isForbidden());

        assertStaysInPlanning();
    }

    @Test
    void estudoInexistenteRetorna404() throws Exception {
        mockMvc.perform(patch("/api/studies/{id}/status", MISSING_ID)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(OPEN_RECRUITMENT))
                .andExpect(status().isNotFound());
    }

    @Test
    void estadoEsperadoDesatualizadoRetorna409() throws Exception {
        prepareProtocol();

        changeStatus("{\"status\":\"RECRUITMENT\",\"expectedStatus\":\"EXECUTION\"}", token)
                .andExpect(status().isConflict());

        assertStaysInPlanning();
    }

    @Test
    void bancoRejeitaCriterioForaDasConstraints() {
        String insert = "INSERT INTO study_criteria (study_id, type, description) VALUES (?, ?, ?)";

        assertThrows(DataIntegrityViolationException.class,
                () -> jdbc.update(insert, studyId, "OUTRO", "Tipo inexistente"));
        assertThrows(DataIntegrityViolationException.class,
                () -> jdbc.update(insert, studyId, "INCLUSION", "   "));
        assertThrows(DataIntegrityViolationException.class,
                () -> jdbc.update(insert, MISSING_ID, "INCLUSION", "Estudo inexistente"));

        assertEquals(0, count("study_criteria"));
    }

    @Test
    void removerEstudoRemoveCriteriosVisitasEAtividades() throws Exception {
        prepareProtocol();
        assertTrue(count("study_criteria") > 0);

        jdbc.update("DELETE FROM studies WHERE id = ?", studyId);

        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM study_criteria", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM planned_visits", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM planned_activities", Integer.class));
    }

    private long createStudy() throws Exception {
        String response = mockMvc.perform(post("/api/studies")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Estudo do fluxo","objective":"Validar o protocolo",
                                 "responsibleUserId":%d,"startDate":"2027-01-01",
                                 "endDate":"2027-12-31","participantLimit":20}
                                """.formatted(researcher.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PLANNING"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(response).get("id").asLong();
    }

    private void prepareProtocol() throws Exception {
        addCriterion(CriterionType.INCLUSION, "Ter 18 anos ou mais").andExpect(status().isCreated());
        addCriterion(CriterionType.EXCLUSION, "Estar em gestação").andExpect(status().isCreated());
        addVisit(VALID_VISIT, etag()).andExpect(status().isCreated());
    }

    private ResultActions addCriterion(CriterionType type, String description) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("type", type.name(), "description", description));
        return mockMvc.perform(post("/api/studies/{id}/criteria", studyId)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private ResultActions addVisit(String body, String ifMatch) throws Exception {
        return mockMvc.perform(post("/api/studies/{id}/planned-visits", studyId)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .header(HttpHeaders.IF_MATCH, ifMatch)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private ResultActions changeStatus(String body, String actorToken) throws Exception {
        return mockMvc.perform(patch("/api/studies/{id}/status", studyId)
                .header(HttpHeaders.AUTHORIZATION, bearer(actorToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private String etag() {
        return "\"" + jdbc.queryForObject("SELECT version FROM studies WHERE id = ?", Long.class, studyId) + "\"";
    }

    private String storedStatus() {
        return jdbc.queryForObject("SELECT status FROM studies WHERE id = ?", String.class, studyId);
    }

    private int count(String table) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE study_id = ?", Integer.class, studyId);
    }

    private void assertStaysInPlanning() {
        assertEquals("PLANNING", storedStatus());
        assertEquals(0, count("study_status_history"));
    }
}
