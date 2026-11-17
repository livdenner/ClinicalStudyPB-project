package clinicalstudypb.consent;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.candidates.domain.CandidateStatus;
import clinicalstudypb.consent.api.SimulatedConsentController;
import clinicalstudypb.consent.api.StudyInvitationController;
import clinicalstudypb.consent.api.StudyInvitationResponse;
import clinicalstudypb.consent.application.SimulatedConsentService;
import clinicalstudypb.consent.application.StudyInvitationService;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.consent.domain.SimulatedConsent;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Verifica validação HTTP, códigos de erro contratuais e serialização dos controladores de consentimento.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-17
 * @version 0.0.1
 */
@WebMvcTest({StudyInvitationController.class, SimulatedConsentController.class})
@AutoConfigureMockMvc(addFilters = false)
class StudyInvitationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StudyInvitationService invitationService;

    @MockitoBean
    private SimulatedConsentService consentService;

    @Test
    void deprecatedPutConsentReturnsForbiddenProblemDetailEvenWithoutBody() throws Exception {
        mockMvc.perform(put("/api/studies/{studyId}/candidates/{candidateId}/consent", 1L, 2L))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("CONSENT_DECIDED_BY_CANDIDATE"));

        verifyNoInteractions(consentService);
    }

    @Test
    void coordinatorConsentReadSerializesRecordedByUserId() throws Exception {
        Instant recordedAt = Instant.parse("2026-11-17T12:00:00Z");
        when(consentService.get(1L, 2L)).thenReturn(
                Optional.of(new SimulatedConsent(2L, ConsentDecision.GRANTED, recordedAt, 42L)));

        mockMvc.perform(get("/api/studies/{studyId}/candidates/{candidateId}/consent", 1L, 2L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GRANTED"))
                .andExpect(jsonPath("$.recordedByUserId").value(42));
    }

    @Test
    void listAndDecisionValidateStatusParametersAndForwardValidDecision() throws Exception {
        mockMvc.perform(get("/api/me/invitations").param("status", "INCLUDED"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/me/invitations/{candidateId}/decision", 5L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PENDING\"}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(invitationService);

        Instant decidedAt = Instant.parse("2026-11-17T12:05:00Z");
        when(invitationService.decide(5L, ConsentDecision.DECLINED)).thenReturn(new StudyInvitationResponse(
                5L, 1L, "Estudo", "Objetivo", LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31),
                "Pesquisadora", List.of(), "Termo fictício", CandidateStatus.DECLINED, decidedAt));

        mockMvc.perform(post("/api/me/invitations/{candidateId}/decision", 5L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DECLINED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DECLINED"))
                .andExpect(jsonPath("$.decidedAt").value(decidedAt.toString()));
    }
}
