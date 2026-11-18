package clinicalstudypb.me.api;

import clinicalstudypb.me.application.ParticipantStudyView;
import clinicalstudypb.participants.domain.Participant;
import clinicalstudypb.participants.domain.ParticipantStatus;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Estudo em que a conta autenticada participa, como o app exibe (RF17).
 *
 * @param participantId participação da conta neste estudo
 * @param studyId identificador do estudo
 * @param studyTitle título do estudo
 * @param studyObjective objetivo do estudo
 * @param studyStatus situação atual do estudo
 * @param startDate início do período do estudo
 * @param endDate fim do período do estudo
 * @param responsibleName nome do pesquisador responsável
 * @param participationStatus situação da participação (ACTIVE ou WITHDRAWN)
 * @param includedAt instante da inclusão
 * @param withdrawnAt instante da retirada; omitido quando a participação está ativa
 * @author Allan Guilherme
 * @since 2026-11-17
 * @version 0.0.1
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "ParticipantStudy", requiredProperties = {
    "participantId", "studyId", "studyTitle", "studyObjective", "studyStatus", "startDate", "endDate",
    "responsibleName", "participationStatus", "includedAt"
})
public record ParticipantStudyResponse(
        Long participantId,
        Long studyId,
        String studyTitle,
        String studyObjective,
        StudyStatus studyStatus,
        LocalDate startDate,
        LocalDate endDate,
        String responsibleName,
        ParticipantStatus participationStatus,
        Instant includedAt,
        Instant withdrawnAt) {

    /**
     * Converte a participação no payload do contrato, sem motivo nem autoria da retirada.
     *
     * @param view participação com o estudo e o responsável
     * @return resposta da rota GET /api/me/studies
     */
    public static ParticipantStudyResponse from(ParticipantStudyView view) {
        Participant participant = view.participant();
        Study study = view.study();
        return new ParticipantStudyResponse(
                participant.getId(),
                study.getId(),
                study.getTitle(),
                study.getObjective(),
                study.getStatus(),
                study.getStartDate(),
                study.getEndDate(),
                view.responsibleName(),
                participant.getStatus(),
                participant.getIncludedAt(),
                participant.getWithdrawnAt());
    }
}
