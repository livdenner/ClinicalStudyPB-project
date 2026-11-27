package clinicalstudypb.participants;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import clinicalstudypb.participants.application.ParticipantQueryService;
import clinicalstudypb.participants.domain.Participant;
import clinicalstudypb.participants.domain.ParticipantStatus;
import clinicalstudypb.participants.infrastructure.ParticipantRepository;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Verifica as consultas públicas de participantes delegadas ao repositório. */
@ExtendWith(MockitoExtension.class)
class ParticipantQueryServiceTest {

    @Mock
    private ParticipantRepository participantRepository;

    private ParticipantQueryService service;

    @BeforeEach
    void setUp() {
        service = new ParticipantQueryService(participantRepository);
    }

    @Test
    void delegatesInclusionTotalActiveCountAndAccountListing() {
        Participant participation = new Participant(3L, 7L, 9L, Instant.parse("2026-11-09T12:00:00Z"));
        when(participantRepository.existsByStudyIdAndCandidateId(3L, 7L)).thenReturn(true);
        when(participantRepository.existsByStudyIdAndCandidateId(3L, 8L)).thenReturn(false);
        when(participantRepository.countByStudyId(3L)).thenReturn(4L);
        when(participantRepository.countByStudyIdAndStatus(3L, ParticipantStatus.ACTIVE)).thenReturn(2L);
        when(participantRepository.findAllByAccountOrderByIncludedAtDesc(11L)).thenReturn(List.of(participation));

        assertTrue(service.isIncluded(3L, 7L));
        assertFalse(service.isIncluded(3L, 8L));
        assertEquals(4L, service.countIncluded(3L));
        assertEquals(2L, service.countActiveIncluded(3L));
        assertEquals(List.of(participation), service.listByAccount(11L));
        assertSame(participation, service.listByAccount(11L).getFirst());
        verify(participantRepository).countByStudyId(3L);
        verify(participantRepository).countByStudyIdAndStatus(3L, ParticipantStatus.ACTIVE);
    }
}
