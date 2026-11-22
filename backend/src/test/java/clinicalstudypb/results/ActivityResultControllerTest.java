package clinicalstudypb.results;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.results.api.ActivityResultController;
import clinicalstudypb.results.api.ActivityResultResponse;
import clinicalstudypb.results.api.VisitResultActivityResponse;
import clinicalstudypb.results.api.VisitResultsResponse;
import clinicalstudypb.results.application.ActivityResultService;
import clinicalstudypb.results.application.ActivityResultService.WriteResult;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import clinicalstudypb.scheduling.domain.SchedulingConflictException;
import clinicalstudypb.shared.ResourceNotFoundException;
import java.time.Instant;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Verifica validação de entrada, serialização e mapeamento HTTP do controlador RF14.
 */
@WebMvcTest(ActivityResultController.class)
@AutoConfigureMockMvc(addFilters = false)
class ActivityResultControllerTest {

    private static final String RESULTS_PATH =
            "/api/studies/{studyId}/participants/{participantId}/visits/{visitId}/results";
    private static final String ACTIVITY_PATH = RESULTS_PATH + "/{activityId}";
    private static final Instant RECORDED_AT = Instant.parse("2026-11-20T14:30:00Z");

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ActivityResultService service;

    @Test
    void getReturnsVisitActivitiesAndOmitsMissingResultField() throws Exception {
        ActivityResultResponse recorded = new ActivityResultResponse(
                8L, 10L, "120x80 mmHg", "Em repouso", 7L, RECORDED_AT);
        VisitResultsResponse response = new VisitResultsResponse(
                8L, 4L, "Visita inicial", ScheduledVisitStatus.DONE,
                List.of(
                        new VisitResultActivityResponse(10L, "Pressão", "Medir PA", 1, recorded),
                        new VisitResultActivityResponse(20L, "Peso", "Medir peso", 2, null)));
        when(service.get(2L, 3L, 8L)).thenReturn(response);

        mockMvc.perform(get(RESULTS_PATH, 2L, 3L, 8L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visitId").value(8))
                .andExpect(jsonPath("$.plannedVisitId").value(4))
                .andExpect(jsonPath("$.plannedVisitName").value("Visita inicial"))
                .andExpect(jsonPath("$.status").value("DONE"))
                .andExpect(jsonPath("$.activities[0].activityId").value(10))
                .andExpect(jsonPath("$.activities[0].result.value").value("120x80 mmHg"))
                .andExpect(jsonPath("$.activities[0].result.note").value("Em repouso"))
                .andExpect(jsonPath("$.activities[0].result.recordedByUserId").value(7))
                .andExpect(jsonPath("$.activities[0].result.recordedAt").value("2026-11-20T14:30:00Z"))
                .andExpect(jsonPath("$.activities[1].activityId").value(20))
                .andExpect(jsonPath("$.activities[1].result").doesNotExist());

        verify(service).get(2L, 3L, 8L);
    }

    @Test
    void getMapsResourceNotFoundToProblemDetail() throws Exception {
        when(service.get(2L, 3L, 99L))
                .thenThrow(new ResourceNotFoundException("Agendamento não encontrado: 99"));

        mockMvc.perform(get(RESULTS_PATH, 2L, 3L, 99L))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail").value("Agendamento não encontrado: 99"));
    }

    @Test
    void putReturnsCreatedWhenResultIsInserted() throws Exception {
        ActivityResultResponse saved = new ActivityResultResponse(
                8L, 10L, "120x80 mmHg", "Repouso", 7L, RECORDED_AT);
        when(service.put(2L, 3L, 8L, 10L, "120x80 mmHg", "Repouso"))
                .thenReturn(new WriteResult(saved, true));

        mockMvc.perform(put(ACTIVITY_PATH, 2L, 3L, 8L, 10L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"120x80 mmHg\",\"note\":\"Repouso\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.visitId").value(8))
                .andExpect(jsonPath("$.activityId").value(10))
                .andExpect(jsonPath("$.value").value("120x80 mmHg"))
                .andExpect(jsonPath("$.note").value("Repouso"))
                .andExpect(jsonPath("$.recordedByUserId").value(7));
    }

    @Test
    void putReturnsOkWhenExistingResultIsReplacedAndOmitsNullNote() throws Exception {
        ActivityResultResponse saved = new ActivityResultResponse(
                8L, 10L, "130x85 mmHg", null, 9L, RECORDED_AT);
        when(service.put(2L, 3L, 8L, 10L, "130x85 mmHg", null))
                .thenReturn(new WriteResult(saved, false));

        mockMvc.perform(put(ACTIVITY_PATH, 2L, 3L, 8L, 10L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"130x85 mmHg\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value("130x85 mmHg"))
                .andExpect(jsonPath("$.note").doesNotExist())
                .andExpect(jsonPath("$.recordedByUserId").value(9));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"value\":null}", "{\"value\":\"\"}", "{\"value\":\"   \"}"})
    void putRejectsMissingOrBlankValueBeforeCallingService(String payload) throws Exception {
        mockMvc.perform(put(ACTIVITY_PATH, 2L, 3L, 8L, 10L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @ParameterizedTest
    @MethodSource("oversizedPayloads")
    void putRejectsFieldsLongerThanContractLimitBeforeCallingService(String payload) throws Exception {
        mockMvc.perform(put(ACTIVITY_PATH, 2L, 3L, 8L, 10L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @Test
    void putAcceptsExactBoundaryLengthsForValueAndNote() throws Exception {
        String value200 = "v".repeat(200);
        String note500 = "n".repeat(500);
        ActivityResultResponse saved = new ActivityResultResponse(
                8L, 10L, value200, note500, 7L, RECORDED_AT);
        when(service.put(2L, 3L, 8L, 10L, value200, note500))
                .thenReturn(new WriteResult(saved, true));

        mockMvc.perform(put(ACTIVITY_PATH, 2L, 3L, 8L, 10L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"" + value200 + "\",\"note\":\"" + note500 + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.value").value(value200))
                .andExpect(jsonPath("$.note").value(note500));
    }

    @Test
    void putMapsVisitNotDoneStudyReadOnlyAndNotFoundExceptionsToProblemDetail() throws Exception {
        when(service.put(2L, 3L, 8L, 10L, "ok", null))
                .thenThrow(new SchedulingConflictException("VISIT_NOT_DONE", "A visita precisa estar realizada."));
        when(service.put(2L, 3L, 9L, 10L, "ok", null))
                .thenThrow(new SchedulingConflictException(
                        "STUDY_READ_ONLY", "O estudo não aceita resultados de atividades."));
        when(service.put(2L, 3L, 8L, 99L, "ok", null))
                .thenThrow(new ResourceNotFoundException("Atividade não encontrada nesta visita: 99"));

        mockMvc.perform(put(ACTIVITY_PATH, 2L, 3L, 8L, 10L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"ok\"}"))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("VISIT_NOT_DONE"));

        mockMvc.perform(put(ACTIVITY_PATH, 2L, 3L, 9L, 10L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"ok\"}"))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("STUDY_READ_ONLY"));

        mockMvc.perform(put(ACTIVITY_PATH, 2L, 3L, 8L, 99L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"ok\"}"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail").value("Atividade não encontrada nesta visita: 99"));
    }

    private static Stream<String> oversizedPayloads() {
        return Stream.of(
                "{\"value\":\"" + "v".repeat(201) + "\"}",
                "{\"value\":\"120x80 mmHg\",\"note\":\"" + "n".repeat(501) + "\"}");
    }
}
