package clinicalstudypb.visits.api;

/**
 * Atividade persistida em uma visita prevista.
 *
 * @param id identificador estável
 * @param name nome
 * @param description descrição
 * @param position ordem na visita
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
public record PlannedActivityResponse(Long id, String name, String description, Integer position) {
}
