package clinicalstudypb.participants.api;

import clinicalstudypb.participants.application.ParticipantResult;
import clinicalstudypb.participants.domain.Participant;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * Representação HTTP do participante prevista pelo contrato RF11.
 *
 * @param id identificador do participante
 * @param studyId estudo da inclusão
 * @param candidateId candidato incluído
 * @param candidateName nome do candidato
 * @param includedAt instante da inclusão atribuído pelo servidor
 * @author Lívia
 * @since 2026-11-09
 * @version 0.0.1
 */
@Schema(name = "Participant", requiredProperties = {"id", "studyId", "candidateId", "candidateName", "includedAt"})
public record ParticipantResponse(Long id, Long studyId, Long candidateId, String candidateName, Instant includedAt) {

    /**
     * Converte o resultado de negócio no payload previsto no contrato.
     *
     * @param result vínculo e nome consultados
     * @return resposta sem campos internos de auditoria
     */
    public static ParticipantResponse from(ParticipantResult result) {
        Participant participant = result.participant();
        return new ParticipantResponse(participant.getId(), participant.getStudyId(), participant.getCandidateId(),
                result.candidateName(), participant.getIncludedAt());
    }
}
