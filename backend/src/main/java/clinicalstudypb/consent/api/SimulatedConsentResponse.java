package clinicalstudypb.consent.api;

import clinicalstudypb.consent.domain.ConsentStatus;
import clinicalstudypb.consent.domain.SimulatedConsent;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

/**
 * Situação pública do consentimento simulado de um candidato.
 *
 * @param studyId identificador do estudo
 * @param candidateId identificador do candidato
 * @param status estado atual
 * @param recordedAt horário da última decisão ou ausente quando pendente
 * @author Lucas N. de Araújo
 * @since 2026-11-07
 * @version 0.0.1
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SimulatedConsentResponse(Long studyId, Long candidateId, ConsentStatus status,
                                       Instant recordedAt) {
    /**
     * Representa o estado inicial sem decisão persistida.
     *
     * @param studyId identificador do estudo
     * @param candidateId identificador do candidato
     * @return resposta pendente
     */
    public static SimulatedConsentResponse pending(Long studyId, Long candidateId) {
        return new SimulatedConsentResponse(studyId, candidateId, ConsentStatus.PENDING, null);
    }

    /**
     * Converte a decisão persistida em resposta HTTP.
     *
     * @param studyId identificador do estudo
     * @param consent decisão persistida
     * @return resposta com estado e horário
     */
    public static SimulatedConsentResponse from(Long studyId, SimulatedConsent consent) {
        return new SimulatedConsentResponse(studyId, consent.getCandidateId(),
                ConsentStatus.valueOf(consent.getStatus().name()), consent.getRecordedAt());
    }
}
