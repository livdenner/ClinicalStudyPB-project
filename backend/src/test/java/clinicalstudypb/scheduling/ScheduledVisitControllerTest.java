package clinicalstudypb.scheduling;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.scheduling.api.ScheduledVisitController;
import clinicalstudypb.scheduling.application.ScheduledVisitResult;
import clinicalstudypb.scheduling.application.ScheduledVisitService;
import clinicalstudypb.scheduling.domain.InvalidScheduledVisitException;
import clinicalstudypb.scheduling.domain.ScheduledVisit;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import clinicalstudypb.scheduling.domain.SchedulingConflictException;
import clinicalstudypb.shared.ResourceNotFoundException;
import java.time.Instant;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Verifica validação de entrada, cabeçalhos e mapeamento HTTP do controlador de agendamentos.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-15
 * @version 0.0.1
 */
@WebMvcTest(ScheduledVisitController.class)
@AutoConfigureMockMvc(addFilters = false)
class ScheduledVisitControllerTest {

    private static final String PARTICIPANT_VISITS_PATH = "/api/studies/{studyId}/participants/{participantId}/visits";
    private static final String VALID_BODY =
            "{\"plannedVisitId\":4,\"scheduledAt\":\"2027-06-01T09:00:00-03:00\"}";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ScheduledVisitService scheduledVisitService;

    @Test
    void scheduleReturnsCreatedWithLocationETagAndConvertedUtcInstant() throws Exception {
        ScheduledVisitResult result = sampleResult(15L, 2L, 3L, 4L);
        Instant expectedInstant = Instant.parse("2027-06-01T12:00:00Z");
        when(scheduledVisitService.schedule(2L, 3L, 4L, expectedInstant)).thenReturn(result);

        mockMvc.perform(post(PARTICIPANT_VISITS_PATH, 2L, 3L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, "/api/studies/2/participants/3/visits/15"))
                .andExpect(header().string(HttpHeaders.ETAG, "\"0\""))
                .andExpect(jsonPath("$.id").value(15))
                .andExpect(jsonPath("$.scheduledAt").value("2027-06-01T12:00:00Z"))
                .andExpect(jsonPath("$.outcomeAt").doesNotExist());
    }

    @ParameterizedTest
    @MethodSource("invalidCreatePayloads")
    void scheduleRejectsBeanValidationViolationsBeforeCallingService(String payload) throws Exception {
        mockMvc.perform(post(PARTICIPANT_VISITS_PATH, 2L, 3L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(scheduledVisitService);
    }

    @Test
    void listByStudyRejectsInvalidStatusEnumBeforeCallingService() throws Exception {
        mockMvc.perform(get("/api/studies/{studyId}/visits", 2L).param("status", "INVALID"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(scheduledVisitService);
    }

    @Test
    void listByStudyForwardsFiltersAndSerializesItems() throws Exception {
        when(scheduledVisitService.listByStudy(2L, ScheduledVisitStatus.SCHEDULED, 3L))
                .thenReturn(List.of(sampleResult(15L, 2L, 3L, 4L)));

        mockMvc.perform(get("/api/studies/{studyId}/visits", 2L)
                        .param("status", "SCHEDULED")
                        .param("participantId", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(15))
                .andExpect(jsonPath("$[0].participantName").value("Pessoa teste"))
                .andExpect(jsonPath("$[0].plannedVisitName").value("Visita inicial"));

        verify(scheduledVisitService).listByStudy(2L, ScheduledVisitStatus.SCHEDULED, 3L);
    }

    @Test
    void scheduleMapsInvalidVisitExceptionToBadRequestProblemDetail() throws Exception {
        when(scheduledVisitService.schedule(2L, 3L, 4L, Instant.parse("2027-06-01T12:00:00Z")))
                .thenThrow(new InvalidScheduledVisitException("VISIT_DATE_NOT_FUTURE", "Data inválida."));

        mockMvc.perform(post(PARTICIPANT_VISITS_PATH, 2L, 3L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("VISIT_DATE_NOT_FUTURE"))
                .andExpect(jsonPath("$.detail").value("Data inválida."));
    }

    @Test
    void scheduleMapsConflictExceptionToConflictProblemDetail() throws Exception {
        when(scheduledVisitService.schedule(2L, 3L, 4L, Instant.parse("2027-06-01T12:00:00Z")))
                .thenThrow(new SchedulingConflictException("VISIT_ALREADY_SCHEDULED", "Visita duplicada."));

        mockMvc.perform(post(PARTICIPANT_VISITS_PATH, 2L, 3L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("VISIT_ALREADY_SCHEDULED"))
                .andExpect(jsonPath("$.detail").value("Visita duplicada."));
    }

    @Test
    void getMapsResourceNotFoundToNotFoundProblemDetail() throws Exception {
        when(scheduledVisitService.get(2L, 3L, 99L))
                .thenThrow(new ResourceNotFoundException("Agendamento não encontrado."));

        mockMvc.perform(get(PARTICIPANT_VISITS_PATH + "/{visitId}", 2L, 3L, 99L))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail").value("Agendamento não encontrado."));
    }

    private static Stream<String> invalidCreatePayloads() {
        return Stream.of(
                "{\"plannedVisitId\":null,\"scheduledAt\":\"2027-06-01T09:00:00-03:00\"}",
                "{\"plannedVisitId\":0,\"scheduledAt\":\"2027-06-01T09:00:00-03:00\"}",
                "{\"plannedVisitId\":-1,\"scheduledAt\":\"2027-06-01T09:00:00-03:00\"}",
                "{\"plannedVisitId\":4,\"scheduledAt\":null}");
    }

    private ScheduledVisitResult sampleResult(Long id, Long studyId, Long participantId, Long plannedVisitId) {
        ScheduledVisit visit = new ScheduledVisit(studyId, participantId, plannedVisitId,
                Instant.parse("2027-06-01T12:00:00Z"), 7L, Instant.parse("2026-11-15T12:00:00Z"));
        ReflectionTestUtils.setField(visit, "id", id);
        ReflectionTestUtils.setField(visit, "version", 0L);
        return new ScheduledVisitResult(visit, "Pessoa teste", "Visita inicial");
    }
}
