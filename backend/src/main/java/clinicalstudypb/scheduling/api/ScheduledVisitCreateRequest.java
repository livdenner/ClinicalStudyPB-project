package clinicalstudypb.scheduling.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.OffsetDateTime;

/**
 * Dados recebidos para agendar uma visita prevista para um participante.
 *
 * @param plannedVisitId identificador da visita prevista no protocolo do estudo
 * @param scheduledAt data e hora propostas com deslocamento explícito
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
@Schema(name = "ScheduledVisitCreateRequest")
public record ScheduledVisitCreateRequest(
        @NotNull @Positive Long plannedVisitId,
        @NotNull OffsetDateTime scheduledAt) {
}
