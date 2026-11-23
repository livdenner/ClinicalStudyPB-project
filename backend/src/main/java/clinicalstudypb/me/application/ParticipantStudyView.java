package clinicalstudypb.me.application;

import clinicalstudypb.participants.domain.Participant;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.visits.api.PlannedVisitResponse;
import java.util.List;

/**
 * Participação da conta autenticada com os dados públicos do estudo (RF17).
 *
 * @param participant participação ativa ou retirada
 * @param study estudo da participação
 * @param responsibleName nome do pesquisador responsável pelo estudo
 * @param plannedVisits visitas previstas na ordem do protocolo com suas atividades
 * @author Allan Guilherme
 * @since 2026-11-17
 * @version 0.0.1
 */
public record ParticipantStudyView(
        Participant participant,
        Study study,
        String responsibleName,
        List<PlannedVisitResponse> plannedVisits) {

    /**
     * Garante lista imutável e não nula de visitas previstas.
     */
    public ParticipantStudyView {
        plannedVisits = plannedVisits == null ? List.of() : List.copyOf(plannedVisits);
    }
}
