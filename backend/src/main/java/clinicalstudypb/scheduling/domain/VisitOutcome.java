package clinicalstudypb.scheduling.domain;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Desfechos que podem ser registrados para uma visita ainda agendada.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-16
 * @version 0.0.1
 */
@Schema(name = "VisitOutcome")
public enum VisitOutcome {
    /** Visita realizada. */
    DONE,
    /** Participante ausente. */
    ABSENT,
    /** Visita cancelada com justificativa. */
    CANCELLED;

    /**
     * Converte o desfecho aceito no corpo para o estado persistido.
     *
     * @return estado final da visita
     */
    public ScheduledVisitStatus toStatus() {
        return ScheduledVisitStatus.valueOf(name());
    }
}
