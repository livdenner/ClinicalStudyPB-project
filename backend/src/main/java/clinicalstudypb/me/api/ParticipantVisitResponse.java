package clinicalstudypb.me.api;

import clinicalstudypb.me.application.ParticipantVisitView;
import clinicalstudypb.scheduling.domain.ScheduledVisit;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * Visita agendada da conta autenticada, como o app exibe (RF18).
 *
 * @param id identificador do agendamento
 * @param studyId estudo da visita
 * @param studyTitle título do estudo
 * @param participantId participação da conta no estudo
 * @param plannedVisitId visita prevista do protocolo
 * @param plannedVisitName nome da visita prevista
 * @param scheduledAt data e hora agendadas
 * @param status situação da visita
 * @param outcomeAt instante do desfecho; omitido enquanto a visita está agendada
 * @param cancellationReason justificativa do cancelamento; presente só em visitas canceladas
 * @author Allan Guilherme
 * @since 2026-11-17
 * @version 0.0.1
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "ParticipantVisit", requiredProperties = {
    "id", "studyId", "studyTitle", "participantId", "plannedVisitId", "plannedVisitName", "scheduledAt", "status"
})
public record ParticipantVisitResponse(
        Long id,
        Long studyId,
        String studyTitle,
        Long participantId,
        Long plannedVisitId,
        String plannedVisitName,
        Instant scheduledAt,
        ScheduledVisitStatus status,
        Instant outcomeAt,
        String cancellationReason) {

    /**
     * Converte a visita no payload do contrato. Observações de visitas realizadas ou de ausência
     * são registros internos da equipe e não são expostas ao participante.
     *
     * @param view visita com o título do estudo e o nome da visita prevista
     * @return resposta usada em GET /api/me/visits
     */
    public static ParticipantVisitResponse from(ParticipantVisitView view) {
        ScheduledVisit visit = view.visit();
        String cancellationReason = visit.getStatus() == ScheduledVisitStatus.CANCELLED
                ? visit.getOutcomeNote()
                : null;
        return new ParticipantVisitResponse(
                visit.getId(),
                visit.getStudyId(),
                view.studyTitle(),
                visit.getParticipantId(),
                visit.getPlannedVisitId(),
                view.plannedVisitName(),
                visit.getScheduledAt(),
                visit.getStatus(),
                visit.getOutcomeAt(),
                cancellationReason);
    }
}
