package clinicalstudypb.scheduling.api;

import clinicalstudypb.scheduling.domain.VisitOutcome;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * Entrada para registrar o desfecho de uma visita agendada.
 *
 * @param outcome desfecho final escolhido
 * @param note observação opcional, obrigatória para cancelamento
 * @author Lucas N. de Araújo
 * @since 2026-11-16
 * @version 0.0.1
 */
public record VisitOutcomeRequest(
        @NotNull VisitOutcome outcome,
        @Schema(maxLength = 500) String note) {
}
