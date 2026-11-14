package clinicalstudypb.participants.domain;

/**
 * Situação de acompanhamento de um participante incluído no estudo.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
public enum ParticipantStatus {
    /** Participante ativo no acompanhamento do estudo. */
    ACTIVE,
    /** Participante retirado do estudo. */
    WITHDRAWN
}
