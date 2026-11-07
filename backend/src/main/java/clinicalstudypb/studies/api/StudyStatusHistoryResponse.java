package clinicalstudypb.studies.api;

import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.studies.domain.StudyStatusHistory;
import java.time.Instant;

/**
 * Entrada pública do histórico de estados de um estudo.
 *
 * @param id identificador da mudança
 * @param actorUserId usuário que alterou
 * @param changedAt instante da alteração
 * @param fromStatus estado anterior
 * @param toStatus novo estado
 * @param reason justificativa do cancelamento
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
public record StudyStatusHistoryResponse(Long id, Long actorUserId, Instant changedAt,
                                         StudyStatus fromStatus, StudyStatus toStatus, String reason) {

    /**
     * Converte o registro persistido para a API.
     *
     * @param history registro persistido
     * @return resposta HTTP
     */
    public static StudyStatusHistoryResponse from(StudyStatusHistory history) {
        return new StudyStatusHistoryResponse(history.getId(), history.getActorUserId(),
                history.getChangedAt(), history.getFromStatus(), history.getToStatus(), history.getReason());
    }
}
