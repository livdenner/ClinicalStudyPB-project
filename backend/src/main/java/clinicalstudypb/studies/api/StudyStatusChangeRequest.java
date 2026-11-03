package clinicalstudypb.studies.api;

import clinicalstudypb.studies.domain.StudyStatus;
import jakarta.validation.constraints.NotNull;

/**
 * Estado solicitado para avançar o ciclo de vida de um estudo.
 *
 * @param status próximo estado solicitado
 * @author Lucas N. de Araújo
 * @since 2026-11-03
 * @version 0.0.1
 */
public record StudyStatusChangeRequest(@NotNull StudyStatus status) {
}
