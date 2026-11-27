package clinicalstudypb.studies;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import clinicalstudypb.criteria.application.StudyCriterionService;
import clinicalstudypb.participants.application.ParticipantLookup;
import clinicalstudypb.studies.application.IntegratedStudyReadiness;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Verifica as pré-condições integradas para abertura do recrutamento e início da execução. */
@ExtendWith(MockitoExtension.class)
class IntegratedStudyReadinessTest {

    @Mock
    private StudyCriterionService criterionService;

    @Mock
    private ParticipantLookup participantLookup;

    private IntegratedStudyReadiness readiness;

    @BeforeEach
    void setUp() {
        readiness = new IntegratedStudyReadiness(criterionService, participantLookup);
    }

    @Test
    void checksCriteriaThroughCriterionService() {
        when(criterionService.hasInclusionAndExclusionCriteria(3L)).thenReturn(true);
        when(criterionService.hasInclusionAndExclusionCriteria(4L)).thenReturn(false);

        assertTrue(readiness.hasInclusionAndExclusionCriteria(3L));
        assertFalse(readiness.hasInclusionAndExclusionCriteria(4L));
    }

    @Test
    void executionReadinessRequiresAtLeastOneActiveParticipant() {
        when(participantLookup.countActiveIncluded(3L)).thenReturn(0L);
        when(participantLookup.countActiveIncluded(4L)).thenReturn(1L);

        assertFalse(readiness.hasIncludedParticipant(3L));
        assertTrue(readiness.hasIncludedParticipant(4L));
        verify(participantLookup, never()).countIncluded(3L);
        verify(participantLookup, never()).countIncluded(4L);
    }
}
