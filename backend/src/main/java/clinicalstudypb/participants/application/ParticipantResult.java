package clinicalstudypb.participants.application;

import clinicalstudypb.participants.domain.Participant;

/**
 * Combina o vínculo persistido com o nome obtido pelo serviço público de candidatos.
 *
 * @param participant vínculo de inclusão
 * @param candidateName nome do candidato
 * @author Lívia
 * @since 2026-11-09
 * @version 0.0.1
 */
public record ParticipantResult(Participant participant, String candidateName) {
}
