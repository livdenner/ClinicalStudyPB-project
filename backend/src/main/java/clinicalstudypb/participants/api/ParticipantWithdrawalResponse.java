package clinicalstudypb.participants.api;

import clinicalstudypb.participants.domain.Participant;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * Dados da retirada exibidos no participante quando {@code status=WITHDRAWN}.
 *
 * @param reason motivo informado pelo coordenador
 * @param withdrawnAt instante da retirada registrado pelo servidor
 * @param withdrawnByUserId coordenador que registrou a retirada
 * @param cancelledVisitCount visitas futuras canceladas pela retirada
 * @author Allan Guilherme
 * @since 2026-11-14
 * @version 0.0.1
 */
@Schema(name = "ParticipantWithdrawal", description = "Presente só quando status=WITHDRAWN",
        requiredProperties = {"reason", "withdrawnAt", "withdrawnByUserId", "cancelledVisitCount"})
public record ParticipantWithdrawalResponse(String reason, Instant withdrawnAt, Long withdrawnByUserId,
                                            Integer cancelledVisitCount) {

    /**
     * Monta os dados da retirada, ou {@code null} para participante ativo.
     *
     * @param participant participante consultado
     * @return dados da retirada ou {@code null}
     */
    public static ParticipantWithdrawalResponse from(Participant participant) {
        if (!participant.isWithdrawn()) {
            return null;
        }
        return new ParticipantWithdrawalResponse(participant.getWithdrawalReason(), participant.getWithdrawnAt(),
                participant.getWithdrawnByUserId(), participant.getWithdrawalCancelledVisitCount());
    }
}
