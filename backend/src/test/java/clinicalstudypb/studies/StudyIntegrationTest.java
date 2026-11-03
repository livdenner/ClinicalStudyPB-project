package clinicalstudypb.studies;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Verifica a API de estudos de ponta a ponta: requisição autenticada por JWT real, regras do
 * serviço e persistência no PostgreSQL com as migrações Flyway.
 *
 * @author Júlia Pamplona
 * @since 2026-10-30
 * @version 0.0.1
 */
class StudyIntegrationTest extends IntegrationTestSupport {

    private static final String STUDIES_URL = "/api/studies";
    private static final String RESEARCHER_EMAIL = "pesquisador@clinicalstudypb.test";
    private static final LocalDate START_DATE = LocalDate.of(2027, 2, 1);
    private static final LocalDate END_DATE = LocalDate.of(2027, 7, 31);

    private User researcher;
    private String token;

    @BeforeEach
    void setUp() throws Exception {
        researcher = saveUser("Pesquisadora Teste", RESEARCHER_EMAIL, UserRole.RESEARCHER);
        token = tokenFor(RESEARCHER_EMAIL);
    }

    @Test
    void createStudyPersistsTrimmedDataAndReturnsLocation_CA04_1() throws Exception {
        StudyBody body = new StudyBody("  Adesão ao tratamento da hipertensão  ",
                "  Avaliar a adesão em 6 meses.  ", researcher.getId(), START_DATE, END_DATE, 50);

        Long id = idOf(create(body)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Adesão ao tratamento da hipertensão"))
                .andExpect(jsonPath("$.objective").value("Avaliar a adesão em 6 meses."))
                .andExpect(jsonPath("$.responsibleUserId").value(researcher.getId()))
                .andExpect(jsonPath("$.startDate").value("2027-02-01"))
                .andExpect(jsonPath("$.endDate").value("2027-07-31"))
                .andExpect(jsonPath("$.participantLimit").value(50)));

        Study saved = studyRepository.findById(id).orElseThrow();
        assertEquals("Adesão ao tratamento da hipertensão", saved.getTitle());
        assertEquals("Avaliar a adesão em 6 meses.", saved.getObjective());
        assertEquals(START_DATE, saved.getStartDate());
        assertEquals(END_DATE, saved.getEndDate());
        mockMvc.perform(get(STUDIES_URL + "/{id}", id).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.title").value("Adesão ao tratamento da hipertensão"));
    }

    @Test
    void createResponseLocationPointsToTheNewStudy() throws Exception {
        String location = create(validBody("Estudo com Location"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader(HttpHeaders.LOCATION);

        mockMvc.perform(get(location).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Estudo com Location"));
    }

    @Test
    void studyStartingAndEndingOnTheSameDayIsAccepted() throws Exception {
        create(new StudyBody("Estudo de um dia", "Objetivo", researcher.getId(), START_DATE, START_DATE, 10))
                .andExpect(status().isCreated());
    }

    @Test
    void listReturnsEveryPersistedStudy() throws Exception {
        create(validBody("Estudo A")).andExpect(status().isCreated());
        create(validBody("Estudo B")).andExpect(status().isCreated());

        mockMvc.perform(get(STUDIES_URL).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[*].title", containsInAnyOrder("Estudo A", "Estudo B")));
    }

    @Test
    void listIsEmptyWhenThereAreNoStudies() throws Exception {
        mockMvc.perform(get(STUDIES_URL).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void unknownStudyIsNotFound() throws Exception {
        mockMvc.perform(get(STUDIES_URL + "/{id}", 999_999).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Estudo não encontrado: 999999"));
    }

    @Test
    void updateStudyPersistsTheNewData() throws Exception {
        Long id = idOf(create(validBody("Estudo original")).andExpect(status().isCreated()));
        StudyBody changes = new StudyBody("Estudo revisado", "Objetivo revisado", researcher.getId(),
                START_DATE.plusMonths(1), END_DATE.plusMonths(1), 80);

        update(id, changes)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.title").value("Estudo revisado"))
                .andExpect(jsonPath("$.participantLimit").value(80));

        Study saved = studyRepository.findById(id).orElseThrow();
        assertEquals("Estudo revisado", saved.getTitle());
        assertEquals("Objetivo revisado", saved.getObjective());
        assertEquals(START_DATE.plusMonths(1), saved.getStartDate());
        assertEquals(END_DATE.plusMonths(1), saved.getEndDate());
        assertEquals(80, saved.getParticipantLimit());
        assertEquals(1, studyRepository.count());
    }

    @Test
    void updateOfUnknownStudyIsNotFound() throws Exception {
        update(999_999L, validBody("Estudo inexistente"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Estudo não encontrado: 999999"));
    }

    @Test
    void rejectedUpdateKeepsTheStoredStudyUnchanged() throws Exception {
        Long id = idOf(create(validBody("Estudo preservado")).andExpect(status().isCreated()));
        StudyBody invertedDates = new StudyBody("Título que não deve ser salvo", "Objetivo",
                researcher.getId(), END_DATE, START_DATE, 50);

        update(id, invertedDates).andExpect(status().isBadRequest());

        Study saved = studyRepository.findById(id).orElseThrow();
        assertEquals("Estudo preservado", saved.getTitle());
        assertEquals(START_DATE, saved.getStartDate());
        assertEquals(END_DATE, saved.getEndDate());
    }

    @Test
    void endDateBeforeStartDateIsRejected() throws Exception {
        create(new StudyBody("Estudo", "Objetivo", researcher.getId(), END_DATE, START_DATE, 50))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("A data de término não pode ser anterior à de início."));

        assertEquals(0, studyRepository.count());
    }

    @Test
    void nonPositiveParticipantLimitIsRejected_CA04_3() throws Exception {
        create(new StudyBody("Estudo", "Objetivo", researcher.getId(), START_DATE, END_DATE, 0))
                .andExpect(status().isBadRequest());

        assertEquals(0, studyRepository.count());
    }

    @Test
    void missingRequiredFieldsAreRejectedBeforeReachingTheDatabase() throws Exception {
        mockMvc.perform(post(STUDIES_URL)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"\",\"objective\":\" \"}"))
                .andExpect(status().isBadRequest());

        assertEquals(0, studyRepository.count());
    }

    @Test
    void responsibleUserMustBeAResearcher() throws Exception {
        User coordinator = saveUser("Coordenador", "coordenador@clinicalstudypb.test", UserRole.COORDINATOR);

        create(new StudyBody("Estudo", "Objetivo", coordinator.getId(), START_DATE, END_DATE, 50))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("O responsável pelo estudo deve ser um pesquisador."));

        assertEquals(0, studyRepository.count());
    }

    @Test
    void responsibleResearcherMustBeActive() throws Exception {
        User inactive = saveUser("Pesquisador Inativo", "inativo@clinicalstudypb.test", UserRole.RESEARCHER);
        inactive.deactivate();
        userRepository.save(inactive);

        create(new StudyBody("Estudo", "Objetivo", inactive.getId(), START_DATE, END_DATE, 50))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("O pesquisador responsável pelo estudo deve estar ativo."));

        assertEquals(0, studyRepository.count());
    }

    @Test
    void unknownResponsibleUserIsNotFound() throws Exception {
        create(new StudyBody("Estudo", "Objetivo", 999_999L, START_DATE, END_DATE, 50))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Usuário não encontrado: 999999"));

        assertEquals(0, studyRepository.count());
    }

    private StudyBody validBody(String title) {
        return new StudyBody(title, "Objetivo do estudo", researcher.getId(), START_DATE, END_DATE, 50);
    }

    private ResultActions create(StudyBody body) throws Exception {
        return mockMvc.perform(post(STUDIES_URL)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    private ResultActions update(Long id, StudyBody body) throws Exception {
        return mockMvc.perform(put(STUDIES_URL + "/{id}", id)
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

    private record StudyBody(String title, String objective, Long responsibleUserId,
                             LocalDate startDate, LocalDate endDate, Integer participantLimit) {
    }
}
