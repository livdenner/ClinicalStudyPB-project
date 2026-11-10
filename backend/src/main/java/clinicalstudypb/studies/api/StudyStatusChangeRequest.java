package clinicalstudypb.studies.api;

import clinicalstudypb.studies.domain.StudyStatus;
import jakarta.validation.constraints.NotNull;

/**
 * Mudança de estado solicitada pelo pesquisador responsável.
 *
 * @param status estado de destino
 * @param expectedStatus estado que o cliente consultou antes de alterar
 * @param reason justificativa obrigatória para cancelar
 * @author Lucas N. de Araújo
 * @since 2026-11-03
 * @version 0.0.1
 */
public record StudyStatusChangeRequest(@NotNull StudyStatus status,
                                       @NotNull StudyStatus expectedStatus,
                                       String reason) {
}
