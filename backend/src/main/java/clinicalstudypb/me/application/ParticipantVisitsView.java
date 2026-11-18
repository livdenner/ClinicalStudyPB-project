package clinicalstudypb.me.application;

import java.util.List;

/**
 * Visitas da conta autenticada separadas em próximas e histórico de desfechos (RF18).
 *
 * @param upcoming visitas {@code SCHEDULED}, da mais antiga para a mais nova
 * @param history visitas {@code DONE}, {@code ABSENT} e {@code CANCELLED}, da mais recente para a mais antiga
 * @author Allan Guilherme
 * @since 2026-11-17
 * @version 0.0.1
 */
public record ParticipantVisitsView(List<ParticipantVisitView> upcoming, List<ParticipantVisitView> history) {
}
