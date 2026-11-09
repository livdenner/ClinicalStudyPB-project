package clinicalstudypb.criteria;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import clinicalstudypb.candidates.application.EligibilityResponseLookup;
import clinicalstudypb.criteria.application.StudyCriterionService;
import clinicalstudypb.criteria.domain.CriterionType;
import clinicalstudypb.criteria.domain.StudyCriterion;
import clinicalstudypb.criteria.infrastructure.StudyCriterionRepository;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.visits.domain.ProtocolConflictException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Verifica cadastro, consultas e prontidão de critérios com dependências isoladas.
 *
 * @author Lívia
 */
@ExtendWith(MockitoExtension.class)
class StudyCriterionServiceTest {

    @Mock
    private StudyCriterionRepository criterionRepository;

    @Mock
    private StudyService studyService;

    @Mock
    private EligibilityResponseLookup eligibilityResponseLookup;

    private StudyCriterionService criterionService;

    @BeforeEach
    void setUp() {
        criterionService = new StudyCriterionService(criterionRepository, studyService, eligibilityResponseLookup);
    }

    @Test
    void createsInclusionCriterionAndTrimsDescription() {
        Study study = study();
        when(studyService.lockForProtocolEdit(3L)).thenReturn(study);
        when(eligibilityResponseLookup.hasResponses(3L)).thenReturn(false);
        when(criterionRepository.saveAndFlush(any(StudyCriterion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        StudyCriterion created = criterionService.create(3L, CriterionType.INCLUSION, "  Idade mínima  ");

        assertEquals(CriterionType.INCLUSION, created.getType());
        assertEquals("Idade mínima", created.getDescription());
        verify(studyService).touchProtocol(study, study.getVersion());
        verify(criterionRepository).saveAndFlush(any(StudyCriterion.class));
    }

    @Test
    void createsExclusionCriterion() {
        when(studyService.lockForProtocolEdit(3L)).thenReturn(study());
        when(eligibilityResponseLookup.hasResponses(3L)).thenReturn(false);
        when(criterionRepository.saveAndFlush(any(StudyCriterion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        StudyCriterion created = criterionService.create(3L, CriterionType.EXCLUSION, "Condição clínica X");

        assertEquals(CriterionType.EXCLUSION, created.getType());
        assertEquals("Condição clínica X", created.getDescription());
    }

    @Test
    void missingStudyPreventsCriterionPersistence() {
        when(studyService.lockForProtocolEdit(99L))
                .thenThrow(new ResourceNotFoundException("Estudo não encontrado: 99"));

        assertThrows(ResourceNotFoundException.class,
                () -> criterionService.create(99L, CriterionType.INCLUSION, "Idade mínima"));

        verify(criterionRepository, never()).saveAndFlush(any(StudyCriterion.class));
    }

    @Test
    void nonEditableStudyPreventsCriterionPersistence() {
        when(studyService.lockForProtocolEdit(3L))
                .thenThrow(new ProtocolConflictException("O protocolo não pode ser alterado."));

        assertThrows(ProtocolConflictException.class,
                () -> criterionService.create(3L, CriterionType.EXCLUSION, "Condição clínica X"));

        verify(criterionRepository, never()).saveAndFlush(any(StudyCriterion.class));
    }

    @Test
    void firstEligibilityResponsePreventsCriterionPersistence() {
        Study study = study();
        when(studyService.lockForProtocolEdit(3L)).thenReturn(study);
        when(eligibilityResponseLookup.hasResponses(3L)).thenReturn(true);

        assertThrows(ProtocolConflictException.class,
                () -> criterionService.create(3L, CriterionType.INCLUSION, "Idade mínima"));

        verify(eligibilityResponseLookup).hasResponses(3L);
        verify(studyService, never()).touchProtocol(study, study.getVersion());
        verify(criterionRepository, never()).saveAndFlush(any(StudyCriterion.class));
    }

    @Test
    void listsCriteriaOnlyAfterConfirmingStudyExists() {
        Study study = study();
        List<StudyCriterion> criteria = List.of(
                new StudyCriterion(3L, CriterionType.INCLUSION, "Idade mínima"));
        when(studyService.getStudy(3L)).thenReturn(study);
        when(criterionRepository.findAllByStudyIdOrderByIdAsc(3L)).thenReturn(criteria);

        assertSame(criteria, criterionService.list(3L));
        verify(criterionRepository).findAllByStudyIdOrderByIdAsc(3L);
    }

    @Test
    void missingStudyPreventsListingCriteria() {
        when(studyService.getStudy(99L))
                .thenThrow(new ResourceNotFoundException("Estudo não encontrado: 99"));

        assertThrows(ResourceNotFoundException.class, () -> criterionService.list(99L));

        verifyNoInteractions(criterionRepository);
    }

    @Test
    void getsCriterionWithinItsStudy() {
        StudyCriterion criterion = new StudyCriterion(3L, CriterionType.EXCLUSION, "Condição clínica X");
        when(studyService.getStudy(3L)).thenReturn(study());
        when(criterionRepository.findByIdAndStudyId(7L, 3L)).thenReturn(Optional.of(criterion));

        assertSame(criterion, criterionService.get(3L, 7L));
    }

    @Test
    void missingCriterionReturnsNotFound() {
        when(studyService.getStudy(3L)).thenReturn(study());
        when(criterionRepository.findByIdAndStudyId(7L, 3L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> criterionService.get(3L, 7L));
    }

    @ParameterizedTest
    @CsvSource({"true,true,true", "true,false,false", "false,true,false", "false,false,false"})
    void readinessRequiresBothInclusionAndExclusion(boolean inclusionExists, boolean exclusionExists,
                                                   boolean expected) {
        // Representa os tipos presentes sem depender da ordem de consulta ou do curto-circuito do serviço.
        when(criterionRepository.existsByStudyIdAndType(eq(3L), any(CriterionType.class)))
                .thenAnswer(invocation -> invocation.getArgument(1, CriterionType.class) == CriterionType.INCLUSION
                        ? inclusionExists : exclusionExists);

        assertEquals(expected, criterionService.hasInclusionAndExclusionCriteria(3L));
    }

    @Test
    void criterionModuleDoesNotClaimAnIncludedParticipant() {
        assertFalse(criterionService.hasIncludedParticipant(3L));
    }

    private Study study() {
        return new Study("Estudo", "Objetivo", 10L,
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20);
    }
}
