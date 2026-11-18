package clinicalstudypb.me.application;

import clinicalstudypb.participants.domain.Participant;
import clinicalstudypb.studies.domain.Study;

/**
 * Participação da conta autenticada com os dados públicos do estudo (RF17).
 *
 * @param participant participação ativa ou retirada
 * @param study estudo da participação
 * @param responsibleName nome do pesquisador responsável pelo estudo
 * @author Allan Guilherme
 * @since 2026-11-17
 * @version 0.0.1
 */
public record ParticipantStudyView(Participant participant, Study study, String responsibleName) {
}
