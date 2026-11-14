package clinicalstudypb.participants.application;

import java.util.Map;

/**
 * Consultas públicas do módulo de participantes usadas pelo agendamento.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
public interface ParticipantSchedulingLookup {

    /**
     * Bloqueia e carrega um participante pertencente ao estudo.
     *
     * @param studyId identificador do estudo
     * @param participantId identificador do participante
     * @return visão mínima do participante bloqueado
     */
    ParticipantSchedulingView lockForScheduling(Long studyId, Long participantId);

    /**
     * Carrega um participante pertencente ao estudo para leitura.
     *
     * @param studyId identificador do estudo
     * @param participantId identificador do participante
     * @return visão mínima do participante
     */
    ParticipantSchedulingView getForScheduling(Long studyId, Long participantId);

    /**
     * Mapeia identificadores de participantes do estudo para o respectivo nome.
     *
     * @param studyId identificador do estudo
     * @return mapa {@code participantId -> nome}
     */
    Map<Long, String> findNamesByStudy(Long studyId);
}
