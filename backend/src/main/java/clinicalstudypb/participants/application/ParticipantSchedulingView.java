package clinicalstudypb.participants.application;

/**
 * Visão pública mínima de um participante para operações de agendamento.
 *
 * @param id identificador do vínculo participante-estudo
 * @param studyId identificador do estudo
 * @param candidateName nome do candidato associado
 * @param withdrawn indica se o participante já foi retirado do estudo
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
public record ParticipantSchedulingView(
        Long id,
        Long studyId,
        String candidateName,
        boolean withdrawn) {
}
