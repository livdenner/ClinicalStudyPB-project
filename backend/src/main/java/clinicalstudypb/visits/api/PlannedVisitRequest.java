package clinicalstudypb.visits.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/**
 * Protocolo de uma visita prevista e suas atividades.
 *
 * @param name nome da visita
 * @param plannedDate data dentro do período do estudo
 * @param position posição desejada; nula para anexar ao fim
 * @param activities lista completa de atividades, na ordem desejada
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
public record PlannedVisitRequest(@NotBlank @Size(max = 120) String name,
                                  @NotNull LocalDate plannedDate,
                                  Integer position,
                                  @NotEmpty List<@Valid PlannedActivityRequest> activities) {
}
