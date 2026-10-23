package clinicalstudypb.studies;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.api.StudyController;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.InvalidStudyException;
import clinicalstudypb.studies.domain.Study;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Verifica as respostas HTTP da API de estudos sem iniciar o banco de dados.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-22
 * @version 0.0.1
 */
@WebMvcTest(StudyController.class)
@AutoConfigureMockMvc(addFilters = false)
class StudyControllerTest {

    private static final String VALID_REQUEST = """
            {"title":"Estudo do sono","objective":"Avaliar hábitos",
             "responsibleUserId":7,"startDate":"2026-11-01",
             "endDate":"2026-12-01","participantLimit":30}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StudyService studyService;

    @Test
    void createReturnsStudyAndLocation() throws Exception {
        when(studyService.createStudy("Estudo do sono", "Avaliar hábitos", 7L,
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 12, 1), 30)).thenReturn(study());

        mockMvc.perform(post("/api/studies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_REQUEST))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/studies/3"))
                .andExpect(jsonPath("$.id").value(3))
                .andExpect(jsonPath("$.responsibleUserId").value(7))
                .andExpect(jsonPath("$.startDate").value("2026-11-01"));
    }

    @Test
    void invalidRequestIsRejectedBeforeCallingService() throws Exception {
        mockMvc.perform(post("/api/studies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"","objective":"Objetivo","responsibleUserId":7,
                                 "startDate":"2026-11-01","endDate":"2026-12-01","participantLimit":0}
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(studyService);
    }

    @Test
    void businessRuleViolationReturnsBadRequestWithExplanation() throws Exception {
        when(studyService.createStudy("Estudo do sono", "Avaliar hábitos", 7L,
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 12, 1), 30))
                .thenThrow(new InvalidStudyException("O responsável pelo estudo deve ser um pesquisador."));

        mockMvc.perform(post("/api/studies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_REQUEST))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("O responsável pelo estudo deve ser um pesquisador."));
    }

    @Test
    void listReturnsStudies() throws Exception {
        when(studyService.listStudies()).thenReturn(List.of(study()));

        mockMvc.perform(get("/api/studies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Estudo do sono"))
                .andExpect(jsonPath("$[0].participantLimit").value(30));
    }

    @Test
    void getReturnsStudyOrNotFound() throws Exception {
        when(studyService.getStudy(3L)).thenReturn(study());
        when(studyService.getStudy(99L)).thenThrow(new ResourceNotFoundException("Estudo não encontrado: 99"));

        mockMvc.perform(get("/api/studies/3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(3));

        mockMvc.perform(get("/api/studies/99"))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateReturnsChangedStudy() throws Exception {
        Study updated = new Study("Estudo atualizado", "Avaliar hábitos", 7L,
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 12, 1), 30);
        ReflectionTestUtils.setField(updated, "id", 3L);
        when(studyService.updateStudy(3L, "Estudo do sono", "Avaliar hábitos", 7L,
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 12, 1), 30)).thenReturn(updated);

        mockMvc.perform(put("/api/studies/3")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_REQUEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Estudo atualizado"));
    }

    private Study study() {
        Study study = new Study("Estudo do sono", "Avaliar hábitos", 7L,
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 12, 1), 30);
        ReflectionTestUtils.setField(study, "id", 3L);
        return study;
    }
}
