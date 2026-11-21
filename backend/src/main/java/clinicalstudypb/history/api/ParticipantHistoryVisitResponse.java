package clinicalstudypb.history.api;

import clinicalstudypb.history.application.ParticipantHistoryVisitView;
import clinicalstudypb.results.api.ActivityResultResponse;
import clinicalstudypb.scheduling.api.ScheduledVisitResponse;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/**
 * Visita do histórico: os campos de {@code ScheduledVisit} mais os resultados por atividade
 * (schema {@code ParticipantHistoryVisit} do contrato). Os campos do desfecho são omitidos
 * enquanto a visita está agendada; {@code results} vem sempre, vazio quando não há resultado.
 *
 * @param id identificador do agendamento
 * @param studyId estudo do agendamento
 * @param participantId participante do agendamento
 * @param participantName nome do participante
 * @param plannedVisitId visita prevista do protocolo
 * @param plannedVisitName nome da visita prevista no momento da consulta
 * @param scheduledAt instante agendado
 * @param status situação da visita
 * @param createdByUserId coordenador que agendou
 * @param createdAt instante do agendamento
 * @param outcomeByUserId autor do desfecho, quando houver
 * @param outcomeAt instante do desfecho, quando houver
 * @param outcomeNote observação ou justificativa do desfecho, quando houver
 * @param version versão da visita para concorrência otimista
 * @param results resultados registrados, na ordem do protocolo
 * @author Allan Guilherme
 * @since 2026-11-19
 * @version 0.0.1
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "ParticipantHistoryVisit", requiredProperties = {
    "id", "studyId", "participantId", "participantName", "plannedVisitId", "plannedVisitName",
    "scheduledAt", "status", "createdByUserId", "createdAt", "version", "results"
})
public record ParticipantHistoryVisitResponse(
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
        Long version,
        List<ActivityResultResponse> results) {

    /**
     * Converte a visita do histórico reaproveitando o mapeamento de {@link ScheduledVisitResponse}.
     *
     * @param view visita agendada com os resultados
     * @return representação do contrato
     */
    public static ParticipantHistoryVisitResponse from(ParticipantHistoryVisitView view) {
        ScheduledVisitResponse visit = ScheduledVisitResponse.from(view.visit());
        return new ParticipantHistoryVisitResponse(
                visit.id(),
                visit.studyId(),
                visit.participantId(),
                visit.participantName(),
                visit.plannedVisitId(),
                visit.plannedVisitName(),
                visit.scheduledAt(),
                visit.status(),
                visit.createdByUserId(),
                visit.createdAt(),
                visit.outcomeByUserId(),
                visit.outcomeAt(),
                visit.outcomeNote(),
                visit.version(),
                view.results());
    }
}
