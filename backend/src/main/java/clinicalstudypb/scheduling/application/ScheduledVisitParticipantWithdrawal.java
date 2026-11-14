package clinicalstudypb.scheduling.application;

import clinicalstudypb.participants.application.ParticipantWithdrawalVisits;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import clinicalstudypb.scheduling.infrastructure.ScheduledVisitRepository;
import java.time.Instant;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cancela as visitas futuras do participante retirado dentro da transação da retirada (RF16).
 *
 * @author Allan Guilherme
 * @since 2026-11-14
 * @version 0.0.1
 */
@Component
public class ScheduledVisitParticipantWithdrawal implements ParticipantWithdrawalVisits {

    /** Justificativa gravada em {@code outcomeNote}, publicada no contrato. */
    static final String WITHDRAWAL_NOTE = "Retirada do participante";

    private final ScheduledVisitRepository repository;

    /**
     * Recebe o repositório de agendamentos.
     *
     * @param repository repositório de agendamentos
     */
    public ScheduledVisitParticipantWithdrawal(ScheduledVisitRepository repository) {
        this.repository = repository;
    }

    /**
     * Exige a transação da retirada: sem ela, o cancelamento poderia ser gravado sozinho.
     */
    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public int cancelFutureScheduledVisits(Long studyId, Long participantId, Long actorUserId,
                                           Instant withdrawnAt) {
        return repository.cancelFutureByParticipant(studyId, participantId, actorUserId, withdrawnAt,
                WITHDRAWAL_NOTE, ScheduledVisitStatus.SCHEDULED, ScheduledVisitStatus.CANCELLED);
    }
}
