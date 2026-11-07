package clinicalstudypb.visits.api;

import java.time.LocalDate;
import java.util.List;

/**
 * Visita prevista persistida para o protocolo de um estudo.
 *
 * @param id identificador estável
 * @param studyId identificador do estudo
 * @param name nome da visita
 * @param plannedDate data prevista
 * @param position ordem no estudo
 * @param activities atividades ordenadas
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
public record PlannedVisitResponse(Long id, Long studyId, String name, LocalDate plannedDate,
                                   Integer position, List<PlannedActivityResponse> activities) {
}
