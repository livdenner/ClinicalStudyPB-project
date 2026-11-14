package clinicalstudypb.participants.api;

import clinicalstudypb.participants.application.ParticipantResult;
import clinicalstudypb.participants.domain.Participant;
import clinicalstudypb.participants.domain.ParticipantStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * Representação HTTP do participante prevista pelo contrato (RF11 e RF16).
 *
 * @param id identificador do participante
 * @param studyId estudo da inclusão
 * @param candidateId candidato incluído
 * @param candidateName nome do candidato
 * @param includedAt instante da inclusão atribuído pelo servidor
 * @param status situação no acompanhamento (ACTIVE ou WITHDRAWN)
 * @param withdrawal dados da retirada; omitido quando o participante está ativo
 * @author Lívia
 * @since 2026-11-09
 * @version 0.0.2
 */
@Schema(name = "Participant",
        requiredProperties = {"id", "studyId", "candidateId", "candidateName", "includedAt", "status"})
public record ParticipantResponse(Long id, Long studyId, Long candidateId, String candidateName, Instant includedAt,
                                  ParticipantStatus status,
                                  @JsonInclude(JsonInclude.Include.NON_NULL)
                                  ParticipantWithdrawalResponse withdrawal) {

    /**
     * Converte o resultado de negócio no payload previsto no contrato.
     *
     * @param result vínculo e nome consultados
     * @return resposta sem campos internos de auditoria
     */
    public static ParticipantResponse from(ParticipantResult result) {
        Participant participant = result.participant();
        return new ParticipantResponse(participant.getId(), participant.getStudyId(), participant.getCandidateId(),
                result.candidateName(), participant.getIncludedAt(), participant.getStatus(),
                ParticipantWithdrawalResponse.from(participant));
    }
}
