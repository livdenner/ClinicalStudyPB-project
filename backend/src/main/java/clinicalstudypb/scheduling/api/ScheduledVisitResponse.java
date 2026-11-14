package clinicalstudypb.scheduling.api;

import clinicalstudypb.scheduling.application.ScheduledVisitResult;
import clinicalstudypb.scheduling.domain.ScheduledVisit;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * Representação HTTP de um agendamento de visita prevista para participante.
 *
 * @param id identificador do agendamento
 * @param studyId identificador do estudo
 * @param participantId identificador do participante
 * @param participantName nome do participante
 * @param plannedVisitId identificador da visita prevista
 * @param plannedVisitName nome da visita prevista
 * @param scheduledAt instante agendado em UTC
 * @param status estado atual do agendamento
 * @param createdByUserId identificador do usuário que criou o agendamento
 * @param createdAt instante de criação atribuído pelo servidor
 * @param outcomeByUserId identificador do autor do desfecho, quando houver
 * @param outcomeAt instante do desfecho, quando houver
 * @param outcomeNote observação do desfecho, quando houver
 * @param version versão para ETag e concorrência otimista
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "ScheduledVisit", requiredProperties = {
    "id", "studyId", "participantId", "participantName", "plannedVisitId", "plannedVisitName",
    "scheduledAt", "status", "createdByUserId", "createdAt", "version"
})
public record ScheduledVisitResponse(
        Long id,
        Long studyId,
        Long participantId,
        String participantName,
        Long plannedVisitId,
        String plannedVisitName,
        Instant scheduledAt,
        ScheduledVisitStatus status,
        Long createdByUserId,
        Instant createdAt,
        Long outcomeByUserId,
        Instant outcomeAt,
        String outcomeNote,
        Long version) {

    /**
     * Converte o resultado de aplicação para o payload HTTP da API.
     *
     * @param result agendamento combinado com nomes públicos
     * @return representação serializável da visita agendada
     */
    public static ScheduledVisitResponse from(ScheduledVisitResult result) {
        ScheduledVisit visit = result.visit();
        return new ScheduledVisitResponse(
                visit.getId(),
                visit.getStudyId(),
                visit.getParticipantId(),
                result.participantName(),
                visit.getPlannedVisitId(),
                result.plannedVisitName(),
                visit.getScheduledAt(),
                visit.getStatus(),
                visit.getCreatedByUserId(),
                visit.getCreatedAt(),
                visit.getOutcomeByUserId(),
                visit.getOutcomeAt(),
                visit.getOutcomeNote(),
                visit.getVersion());
    }
}
