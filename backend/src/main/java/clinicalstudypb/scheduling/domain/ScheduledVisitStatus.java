package clinicalstudypb.scheduling.domain;

/**
 * Estados possíveis de uma visita agendada para um participante.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
public enum ScheduledVisitStatus {
    /** Agendamento previsto pendente de desfecho. */
    SCHEDULED,
    /** Visita clínica realizada. */
    DONE,
    /** Participante ausente na visita agendada. */
    ABSENT,
    /** Agendamento cancelado antes do desfecho. */
    CANCELLED
}
