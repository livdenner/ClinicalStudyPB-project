package clinicalstudypb.studies.application;

import java.time.Instant;

/**
 * Consulta e atualiza visitas agendadas durante transições do estudo.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
public interface StudySchedulingLifecycle {

    /**
     * Verifica se ainda há visitas sem desfecho no estudo.
     *
     * @param studyId estudo consultado
     * @return verdadeiro quando há visita agendada
     */
    boolean hasScheduledVisits(Long studyId);

    /**
     * Cancela visitas pendentes na mesma transação da mudança de estado.
     *
     * @param studyId estudo cancelado
     * @param actorUserId pesquisador que cancelou o estudo
     * @param occurredAt instante do cancelamento
     */
    void cancelPendingScheduledVisits(Long studyId, Long actorUserId, Instant occurredAt);
}
