package clinicalstudypb.scheduling.application;

import clinicalstudypb.scheduling.domain.ScheduledVisit;

/**
 * Combina o agendamento persistido com os nomes públicos do participante e da visita prevista.
 *
 * @param visit entidade de agendamento persistida
 * @param participantName nome do participante no estudo
 * @param plannedVisitName nome da visita prevista no protocolo
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
public record ScheduledVisitResult(
        ScheduledVisit visit,
        String participantName,
        String plannedVisitName) {
}
