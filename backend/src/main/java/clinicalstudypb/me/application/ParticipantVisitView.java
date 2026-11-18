package clinicalstudypb.me.application;

import clinicalstudypb.scheduling.domain.ScheduledVisit;

/**
 * Visita agendada da conta autenticada com os nomes exibidos pelo app (RF18).
 *
 * @param visit agendamento da participação
 * @param studyTitle título do estudo
 * @param plannedVisitName nome da visita prevista no protocolo
 * @author Allan Guilherme
 * @since 2026-11-17
 * @version 0.0.1
 */
public record ParticipantVisitView(ScheduledVisit visit, String studyTitle, String plannedVisitName) {
}
