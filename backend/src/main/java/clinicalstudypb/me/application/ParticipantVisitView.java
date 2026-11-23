package clinicalstudypb.me.application;

import clinicalstudypb.scheduling.domain.ScheduledVisit;
import clinicalstudypb.visits.api.PlannedActivityResponse;
import java.util.List;

/**
 * Visita agendada da conta autenticada com os nomes e atividades exibidos pelo app (RF18).
 *
 * @param visit agendamento da participação
 * @param studyTitle título do estudo
 * @param plannedVisitName nome da visita prevista no protocolo
 * @param activities atividades previstas da visita na ordem do protocolo
 * @author Allan Guilherme
 * @since 2026-11-17
 * @version 0.0.1
 */
public record ParticipantVisitView(
        ScheduledVisit visit,
        String studyTitle,
        String plannedVisitName,
        List<PlannedActivityResponse> activities) {

    /**
     * Garante lista imutável e não nula de atividades previstas na visão.
     */
    public ParticipantVisitView {
        activities = activities == null ? List.of() : List.copyOf(activities);
    }
}
