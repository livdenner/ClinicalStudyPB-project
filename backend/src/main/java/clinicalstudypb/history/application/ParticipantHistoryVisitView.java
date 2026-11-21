package clinicalstudypb.history.application;

import clinicalstudypb.results.api.ActivityResultResponse;
import clinicalstudypb.scheduling.application.ScheduledVisitResult;
import java.util.List;

/**
 * Visita agendada do participante com o desfecho e os resultados registrados (RF12 a RF14).
 *
 * @param visit agendamento com os nomes do participante e da visita prevista
 * @param results resultados por atividade na ordem do protocolo; vazio quando não há
 * @author Allan Guilherme
 * @since 2026-11-19
 * @version 0.0.1
 */
public record ParticipantHistoryVisitView(ScheduledVisitResult visit, List<ActivityResultResponse> results) {
}
