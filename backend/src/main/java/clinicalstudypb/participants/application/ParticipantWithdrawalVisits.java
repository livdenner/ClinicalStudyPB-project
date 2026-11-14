package clinicalstudypb.participants.application;

import java.time.Instant;

/**
 * Efeito da retirada sobre as visitas agendadas do participante (RF16).
 * Implementada pelo módulo de agendamento, que depende de participantes; a inversão evita
 * um ciclo entre os módulos, no mesmo modelo de {@code StudySchedulingLifecycle}.
 *
 * @author Allan Guilherme
 * @since 2026-11-14
 * @version 0.0.1
 */
public interface ParticipantWithdrawalVisits {

    /**
     * Cancela, na transação da retirada, as visitas {@code SCHEDULED} do participante com
     * data posterior ao instante da retirada. Visitas já vencidas e desfechos finais não mudam.
     *
     * @param studyId estudo do participante
     * @param participantId participante retirado
     * @param actorUserId coordenador que registrou a retirada
     * @param withdrawnAt instante da retirada, usado como corte e como instante do cancelamento
     * @return quantidade de visitas canceladas
     */
    int cancelFutureScheduledVisits(Long studyId, Long participantId, Long actorUserId, Instant withdrawnAt);
}
