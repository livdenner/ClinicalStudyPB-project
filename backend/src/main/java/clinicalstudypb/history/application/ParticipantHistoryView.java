package clinicalstudypb.history.application;

import clinicalstudypb.participants.application.ParticipantResult;
import java.util.List;

/**
 * Histórico do participante no estudo: situação, inclusão, retirada e visitas (RF15).
 *
 * @param participant participante com o nome do candidato e os dados da retirada, quando houver
 * @param visits visitas em ordem cronológica de {@code scheduledAt}; vazio quando não há
 * @author Allan Guilherme
 * @since 2026-11-19
 * @version 0.0.1
 */
public record ParticipantHistoryView(ParticipantResult participant, List<ParticipantHistoryVisitView> visits) {
}
