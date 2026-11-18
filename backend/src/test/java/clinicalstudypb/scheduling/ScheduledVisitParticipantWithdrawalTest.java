package clinicalstudypb.scheduling;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import clinicalstudypb.scheduling.application.ScheduledVisitParticipantWithdrawal;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import clinicalstudypb.scheduling.infrastructure.ScheduledVisitRepository;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Verifica, sem banco, o cancelamento das visitas futuras na retirada do participante (RF16, T22.2):
 * só visitas {@code SCHEDULED} posteriores ao instante da retirada, com a justificativa publicada
 * no contrato, o autor da retirada e a exigência da transação da retirada.
 *
 * @author Allan Guilherme
 * @since 2026-11-16
 * @version 0.0.1
 */
@ExtendWith(MockitoExtension.class)
class ScheduledVisitParticipantWithdrawalTest {

    private static final Instant WITHDRAWN_AT = Instant.parse("2027-03-01T12:00:00Z");
    private static final String CONTRACT_NOTE = "Retirada do participante";

    @Mock
    private ScheduledVisitRepository repository;

    private ScheduledVisitParticipantWithdrawal cancellation;

    @BeforeEach
    void setUp() {
        cancellation = new ScheduledVisitParticipantWithdrawal(repository);
    }

    @Test
    void cancelsOnlyScheduledVisitsAfterWithdrawalWithContractNoteAndWithdrawalAuthor() {
        when(repository.cancelFutureByParticipant(3L, 12L, 9L, WITHDRAWN_AT, CONTRACT_NOTE,
                ScheduledVisitStatus.SCHEDULED, ScheduledVisitStatus.CANCELLED)).thenReturn(2);

        int cancelled = cancellation.cancelFutureScheduledVisits(3L, 12L, 9L, WITHDRAWN_AT);

        assertEquals(2, cancelled);
        verify(repository).cancelFutureByParticipant(3L, 12L, 9L, WITHDRAWN_AT, CONTRACT_NOTE,
                ScheduledVisitStatus.SCHEDULED, ScheduledVisitStatus.CANCELLED);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void withdrawalWithoutFutureScheduledVisitsCancelsNothing() {
        when(repository.cancelFutureByParticipant(3L, 12L, 9L, WITHDRAWN_AT, CONTRACT_NOTE,
                ScheduledVisitStatus.SCHEDULED, ScheduledVisitStatus.CANCELLED)).thenReturn(0);

        assertEquals(0, cancellation.cancelFutureScheduledVisits(3L, 12L, 9L, WITHDRAWN_AT));
    }

    @Test
    void failureWhileCancellingVisitsIsPropagatedToTheWithdrawal() {
        IllegalStateException failure = new IllegalStateException("Falha no cancelamento");
        when(repository.cancelFutureByParticipant(3L, 12L, 9L, WITHDRAWN_AT, CONTRACT_NOTE,
                ScheduledVisitStatus.SCHEDULED, ScheduledVisitStatus.CANCELLED)).thenThrow(failure);

        IllegalStateException thrown = assertThrows(IllegalStateException.class,
                () -> cancellation.cancelFutureScheduledVisits(3L, 12L, 9L, WITHDRAWN_AT));

        assertSame(failure, thrown);
    }

    @Test
    void visitCancellationRequiresTheWithdrawalTransaction() throws NoSuchMethodException {
        Transactional transactional = ScheduledVisitParticipantWithdrawal.class
                .getMethod("cancelFutureScheduledVisits", Long.class, Long.class, Long.class, Instant.class)
                .getAnnotation(Transactional.class);

        assertNotNull(transactional);
        assertEquals(Propagation.MANDATORY, transactional.propagation());
    }
}
