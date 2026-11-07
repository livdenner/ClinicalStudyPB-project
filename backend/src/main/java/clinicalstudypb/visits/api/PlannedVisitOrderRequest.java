package clinicalstudypb.visits.api;

import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * Lista completa dos IDs de visitas na nova ordem.
 *
 * @param ids identificadores sem repetição
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
public record PlannedVisitOrderRequest(@NotNull List<@NotNull Long> ids) {
}
