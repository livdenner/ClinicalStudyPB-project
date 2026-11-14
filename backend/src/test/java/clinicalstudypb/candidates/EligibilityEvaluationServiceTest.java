package clinicalstudypb.candidates;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import clinicalstudypb.candidates.application.EligibilityAnswerInput;
import clinicalstudypb.candidates.application.EligibilityEvaluationResult;
import clinicalstudypb.candidates.application.EligibilityEvaluationService;
import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.CandidateConflictException;
import clinicalstudypb.candidates.domain.EligibilityAnswer;
import clinicalstudypb.candidates.domain.EligibilityEvaluation;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.candidates.domain.InvalidEligibilityEvaluationException;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.candidates.infrastructure.EligibilityAnswerRepository;
import clinicalstudypb.candidates.infrastructure.EligibilityEvaluationRepository;
import clinicalstudypb.criteria.application.StudyCriterionService;
import clinicalstudypb.criteria.domain.CriterionType;
import clinicalstudypb.criteria.domain.StudyCriterion;
import clinicalstudypb.participants.application.ParticipantLookup;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Verifica cálculo, pendência e rejeições da elegibilidade sem banco ou relógio variável.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
@ExtendWith(MockitoExtension.class)
class EligibilityEvaluationServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-08T12:30:00.123456789Z");
    private static final Instant STORED_TIME = Instant.parse("2026-11-08T12:30:00.123456Z");

    @Mock
    private CandidateRepository candidateRepository;
    @Mock
    private EligibilityAnswerRepository answerRepository;
    @Mock
    private EligibilityEvaluationRepository evaluationRepository;
    @Mock
    private StudyService studyService;
    @Mock
    private StudyCriterionService criterionService;
    @Mock
    private ParticipantLookup participantLookup;
    @Mock
    private CurrentActor currentActor;
    @Captor
    private ArgumentCaptor<Iterable<EligibilityAnswer>> answersCaptor;
    @Captor
    private ArgumentCaptor<EligibilityEvaluation> evaluationCaptor;

    private EligibilityEvaluationService service;
    private Candidate candidate;

    @BeforeEach
    void setUp() {
        service = new EligibilityEvaluationService(candidateRepository, answerRepository, evaluationRepository,
                studyService, criterionService, participantLookup, currentActor, Clock.fixed(NOW, ZoneOffset.UTC));
        candidate = new Candidate(3L, "Ana Silva", "ana silva", 42);
        ReflectionTestUtils.setField(candidate, "id", 5L);
    }

    @ParameterizedTest
    @CsvSource({"true,false,ELIGIBLE", "false,false,INELIGIBLE",
                "true,true,INELIGIBLE", "false,true,INELIGIBLE"})
    void completeEvaluationUsesInclusionAndExclusionRules(boolean inclusion, boolean exclusion,
                                                         EligibilityStatus expected) {
        prepareEvaluation(List.of(criterion(11L, CriterionType.INCLUSION), criterion(12L, CriterionType.EXCLUSION)));
        when(currentActor.userId()).thenReturn(9L);

        EligibilityEvaluationResult result = service.evaluate(3L, 5L, List.of(
                new EligibilityAnswerInput(11L, inclusion), new EligibilityAnswerInput(12L, exclusion)));

        assertEquals(expected, result.status());
        assertEquals(expected, candidate.getEligibilityStatus());
        assertEquals(3L, result.studyId());
        assertEquals(5L, result.candidateId());
        assertEquals(STORED_TIME, result.evaluatedAt());
        verify(answerRepository).deleteForCandidate(5L);
        verify(answerRepository).saveAllAndFlush(answersCaptor.capture());
        List<EligibilityAnswer> stored = StreamSupport.stream(answersCaptor.getValue().spliterator(), false).toList();
        assertEquals(List.of(11L, 12L), stored.stream().map(EligibilityAnswer::getCriterionId).toList());
        assertEquals(List.of(5L, 5L), stored.stream().map(EligibilityAnswer::getCandidateId).toList());
        assertEquals(List.of(inclusion, exclusion), stored.stream().map(EligibilityAnswer::isMatches).toList());
        verify(evaluationRepository).saveAndFlush(evaluationCaptor.capture());
        assertEquals(5L, evaluationCaptor.getValue().getCandidateId());
        assertEquals(9L, evaluationCaptor.getValue().getEvaluatedBy());
        assertEquals(STORED_TIME, evaluationCaptor.getValue().getEvaluatedAt());
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 2, 3})
    void anyMissingCriterionKeepsPendingEvenWithAnAlreadyFailingAnswer(int missingIndex) {
        prepareEvaluation(List.of(criterion(11L, CriterionType.INCLUSION), criterion(12L, CriterionType.INCLUSION),
                criterion(13L, CriterionType.EXCLUSION), criterion(14L, CriterionType.EXCLUSION)));
        when(currentActor.userId()).thenReturn(9L);
        List<EligibilityAnswerInput> partial = new ArrayList<>(List.of(
                new EligibilityAnswerInput(11L, false), new EligibilityAnswerInput(12L, false),
                new EligibilityAnswerInput(13L, true), new EligibilityAnswerInput(14L, true)));
        partial.remove(missingIndex);
        candidate.updateEligibilityStatus(EligibilityStatus.ELIGIBLE);

        assertEquals(EligibilityStatus.PENDING, service.evaluate(3L, 5L, partial).status());
        assertEquals(EligibilityStatus.PENDING, candidate.getEligibilityStatus());
    }

    @ParameterizedTest
    @CsvSource({"INCLUSION,true,ELIGIBLE", "INCLUSION,false,INELIGIBLE",
                "EXCLUSION,false,ELIGIBLE", "EXCLUSION,true,INELIGIBLE"})
    void singleCriterionIsEvaluatedAccordingToItsType(CriterionType type, boolean matches,
                                                      EligibilityStatus expected) {
        prepareEvaluation(List.of(criterion(11L, type)));
        when(currentActor.userId()).thenReturn(9L);

        assertEquals(expected, service.evaluate(3L, 5L, List.of(new EligibilityAnswerInput(11L, matches))).status());
        assertEquals(expected, candidate.getEligibilityStatus());
    }

    @ParameterizedTest
    @MethodSource("invalidAnswers")
    void invalidAnswersDoNotReplaceResponsesOrChangeResult(List<EligibilityAnswerInput> answers) {
        prepareEvaluation(List.of(criterion(11L, CriterionType.INCLUSION)));
        candidate.updateEligibilityStatus(EligibilityStatus.ELIGIBLE);

        assertThrows(InvalidEligibilityEvaluationException.class, () -> service.evaluate(3L, 5L, answers));

        assertEquals(EligibilityStatus.ELIGIBLE, candidate.getEligibilityStatus());
        verifyNoInteractions(answerRepository, evaluationRepository, currentActor);
    }

    @Test
    void noCriteriaRejectsEvaluationWithoutPersistence() {
        prepareEvaluation(List.of());

        assertThrows(CandidateConflictException.class,
                () -> service.evaluate(3L, 5L, List.of(new EligibilityAnswerInput(11L, true))));

        verifyNoInteractions(answerRepository, evaluationRepository, currentActor);
        assertEquals(EligibilityStatus.PENDING, candidate.getEligibilityStatus());
    }

    @Test
    void includedCandidateCannotBeReevaluated() {
        when(candidateRepository.findByIdAndStudyId(5L, 3L)).thenReturn(Optional.of(candidate));
        when(participantLookup.isIncluded(3L, 5L)).thenReturn(true);

        assertThrows(CandidateConflictException.class,
                () -> service.evaluate(3L, 5L, List.of(new EligibilityAnswerInput(11L, true))));

        verifyNoInteractions(criterionService, answerRepository, evaluationRepository, currentActor);
    }

    @Test
    void cancelledCandidateCannotBeEvaluated() {
        candidate.cancel("Desistiu do estudo", STORED_TIME, 9L);
        when(candidateRepository.findByIdAndStudyId(5L, 3L)).thenReturn(Optional.of(candidate));

        CandidateConflictException exception = assertThrows(CandidateConflictException.class,
                () -> service.evaluate(3L, 5L, List.of(new EligibilityAnswerInput(11L, true))));

        assertEquals("CANDIDATE_CANCELLED", exception.getCode());
        verifyNoInteractions(participantLookup, criterionService, answerRepository, evaluationRepository, currentActor);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void missingCandidateIsNotFoundForGetAndPut(boolean writing) {
        when(candidateRepository.findByIdAndStudyId(5L, 3L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> {
            if (writing) {
                service.evaluate(3L, 5L, List.of(new EligibilityAnswerInput(11L, true)));
            } else {
                service.get(3L, 5L);
            }
        });

        verifyNoInteractions(criterionService, answerRepository, evaluationRepository, participantLookup, currentActor);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void missingStudyIsRejectedBeforeReadingCandidate(boolean writing) {
        if (writing) {
            doThrow(new ResourceNotFoundException("Estudo ausente"))
                    .when(studyService).lockForCandidateOperations(3L);
        } else {
            doThrow(new ResourceNotFoundException("Estudo ausente")).when(studyService).getStudy(3L);
        }

        assertThrows(ResourceNotFoundException.class, () -> {
            if (writing) {
                service.evaluate(3L, 5L, List.of(new EligibilityAnswerInput(11L, true)));
            } else {
                service.get(3L, 5L);
            }
        });

        verifyNoInteractions(candidateRepository, criterionService, answerRepository, evaluationRepository);
    }

    @Test
    void unidentifiedAuthorCannotCausePersistence() {
        prepareEvaluation(List.of(criterion(11L, CriterionType.INCLUSION)));
        when(currentActor.userId()).thenThrow(new AccessDeniedException("Autor ausente"));

        assertThrows(AccessDeniedException.class,
                () -> service.evaluate(3L, 5L, List.of(new EligibilityAnswerInput(11L, true))));

        assertEquals(EligibilityStatus.PENDING, candidate.getEligibilityStatus());
        verifyNoInteractions(answerRepository, evaluationRepository);
    }

    @Test
    void getBeforeFirstEvaluationReturnsPendingWithoutTimestamp() {
        when(candidateRepository.findByIdAndStudyId(5L, 3L)).thenReturn(Optional.of(candidate));

        EligibilityEvaluationResult result = service.get(3L, 5L);

        assertEquals(EligibilityStatus.PENDING, result.status());
        assertEquals(List.of(), result.answers());
        assertNull(result.evaluatedAt());
        verifyNoInteractions(currentActor, participantLookup);
    }

    @Test
    void getReturnsStoredAnswersStatusAndTimestamp() {
        when(candidateRepository.findByIdAndStudyId(5L, 3L)).thenReturn(Optional.of(candidate));
        candidate.updateEligibilityStatus(EligibilityStatus.INELIGIBLE);
        List<EligibilityAnswer> answers = List.of(new EligibilityAnswer(5L, 11L, false));
        when(answerRepository.findAllByCandidateIdOrderByCriterionIdAsc(5L)).thenReturn(answers);
        when(evaluationRepository.findById(5L))
                .thenReturn(Optional.of(new EligibilityEvaluation(5L, 9L, STORED_TIME)));

        EligibilityEvaluationResult result = service.get(3L, 5L);

        assertEquals(EligibilityStatus.INELIGIBLE, result.status());
        assertEquals(answers, result.answers());
        assertEquals(STORED_TIME, result.evaluatedAt());
    }

    private void prepareEvaluation(List<StudyCriterion> criteria) {
        when(candidateRepository.findByIdAndStudyId(5L, 3L)).thenReturn(Optional.of(candidate));
        when(criterionService.list(3L)).thenReturn(criteria);
    }

    private StudyCriterion criterion(Long id, CriterionType type) {
        StudyCriterion criterion = new StudyCriterion(3L, type, "Critério " + id);
        ReflectionTestUtils.setField(criterion, "id", id);
        return criterion;
    }

    private static Stream<List<EligibilityAnswerInput>> invalidAnswers() {
        return Stream.of(null, List.of(), Arrays.asList((EligibilityAnswerInput) null),
                List.of(new EligibilityAnswerInput(null, true)), List.of(new EligibilityAnswerInput(11L, null)),
                List.of(new EligibilityAnswerInput(999L, true)),
                List.of(new EligibilityAnswerInput(11L, false), new EligibilityAnswerInput(11L, true)));
    }
}
