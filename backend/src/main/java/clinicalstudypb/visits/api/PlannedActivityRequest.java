package clinicalstudypb.visits.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Atividade recebida ao criar ou editar uma visita prevista.
 *
 * @param id identificador existente; nulo para atividade nova
 * @param name nome único dentro da visita
 * @param description descrição da atividade
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
public record PlannedActivityRequest(Long id,
                                     @NotBlank @Size(max = 120) String name,
                                     @NotBlank @Size(max = 500) String description) {
}
