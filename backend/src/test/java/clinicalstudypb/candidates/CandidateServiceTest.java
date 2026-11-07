package clinicalstudypb.candidates;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import clinicalstudypb.candidates.application.CandidateService;
import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.CandidateConflictException;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CandidateServiceTest {

    @Mock
    private CandidateRepository candidateRepository;

    @Mock
    private StudyService studyService;

    private CandidateService candidateService;

    @BeforeEach
    void setUp() {
        candidateService = new CandidateService(candidateRepository, studyService);
    }

    @Test
    void createStoresTrimmedCandidateWithPendingEligibility() {
        when(studyService.getStudy(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(candidateRepository.saveAndFlush(any(Candidate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Candidate created = candidateService.create(3L, "  Ana   Silva  ", 42);

        assertEquals(3L, created.getStudyId());
        assertEquals("Ana Silva", created.getName());
        assertEquals(42, created.getAge());
        assertEquals(EligibilityStatus.PENDING, created.getEligibilityStatus());
        verify(candidateRepository).existsByStudyIdAndNameKeyAndAge(3L, "ana silva", 42);
        verify(candidateRepository).saveAndFlush(any(Candidate.class));
    }

    @Test
    void createRejectsDuplicateInSameStudyWithoutSaving() {
        when(studyService.getStudy(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(candidateRepository.existsByStudyIdAndNameKeyAndAge(3L, "ana silva", 42)).thenReturn(true);

        assertThrows(CandidateConflictException.class,
                () -> candidateService.create(3L, "Ana Silva", 42));

        verify(candidateRepository, never()).saveAndFlush(any(Candidate.class));
    }

    @Test
    void createAllowsSameCandidateInDifferentStudy() {
        when(studyService.getStudy(9L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(candidateRepository.saveAndFlush(any(Candidate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Candidate created = candidateService.create(9L, "Ana Silva", 42);

        assertEquals(9L, created.getStudyId());
        verify(candidateRepository).existsByStudyIdAndNameKeyAndAge(9L, "ana silva", 42);
        verify(candidateRepository).saveAndFlush(any(Candidate.class));
    }

    @Test
    void createRejectsStudyOutsideRecruitment() {
        when(studyService.getStudy(3L)).thenReturn(study(StudyStatus.PLANNING));

        assertThrows(CandidateConflictException.class,
                () -> candidateService.create(3L, "Ana Silva", 42));

        verifyNoInteractions(candidateRepository);
    }

    @Test
    void createPropagatesMissingStudyWithoutUsingCandidateRepository() {
        when(studyService.getStudy(99L)).thenThrow(new ResourceNotFoundException("Estudo não encontrado: 99"));

        assertThrows(ResourceNotFoundException.class,
                () -> candidateService.create(99L, "Ana Silva", 42));

        verifyNoInteractions(candidateRepository);
    }

    @Test
    void listChecksStudyAndReturnsCandidatesInRepositoryOrder() {
        Candidate candidate = new Candidate(3L, "Ana Silva", "ana silva", 42);
        List<Candidate> candidates = List.of(candidate);
        when(studyService.getStudy(3L)).thenReturn(study(StudyStatus.PLANNING));
        when(candidateRepository.findAllByStudyIdOrderByIdAsc(3L)).thenReturn(candidates);

        assertSame(candidates, candidateService.list(3L));
        verify(candidateRepository).findAllByStudyIdOrderByIdAsc(3L);
    }

    @Test
    void getReturnsCandidateBelongingToStudy() {
        Candidate candidate = new Candidate(3L, "Ana Silva", "ana silva", 42);
        when(studyService.getStudy(3L)).thenReturn(study(StudyStatus.PLANNING));
        when(candidateRepository.findByIdAndStudyId(7L, 3L)).thenReturn(Optional.of(candidate));

        assertSame(candidate, candidateService.get(3L, 7L));
    }

    @Test
    void getRejectsCandidateThatDoesNotBelongToStudy() {
        when(studyService.getStudy(3L)).thenReturn(study(StudyStatus.PLANNING));
        when(candidateRepository.findByIdAndStudyId(7L, 3L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> candidateService.get(3L, 7L));
    }

    private Study study(StudyStatus status) {
        Study study = new Study("Estudo", "Objetivo", 1L,
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20);
        if (status != StudyStatus.PLANNING) {
            study.advanceStatus(StudyStatus.RECRUITMENT);
            if (status == StudyStatus.EXECUTION || status == StudyStatus.CLOSED) {
                study.advanceStatus(StudyStatus.EXECUTION);
            }
            if (status == StudyStatus.CLOSED) {
                study.advanceStatus(StudyStatus.CLOSED);
            }
            if (status == StudyStatus.CANCELLED) {
                study.advanceStatus(StudyStatus.CANCELLED);
            }
        }
        return study;
    }
}
