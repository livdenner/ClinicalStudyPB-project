package clinicalstudypb.studies;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.participants.application.ParticipantLookup;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.application.StudySchedulingLifecycle;
import clinicalstudypb.studies.application.StudyReadiness;
import clinicalstudypb.studies.domain.InvalidStudyException;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.studies.domain.StudyStatusConflictException;
import clinicalstudypb.studies.domain.StudyStatusHistory;
import clinicalstudypb.studies.infrastructure.StudyRepository;
import clinicalstudypb.studies.infrastructure.StudyStatusHistoryRepository;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import clinicalstudypb.visits.domain.ProtocolConflictException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Verifica as regras de cadastro e edição de estudos com dependências simuladas.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-22
 * @version 0.0.1
 */
@ExtendWith(MockitoExtension.class)
class StudyServiceTest {

    private static final LocalDate START_DATE = LocalDate.of(2026, 11, 1);
    private static final LocalDate END_DATE = LocalDate.of(2026, 12, 1);

    @Mock
    private StudyRepository studyRepository;

    @Mock
    private UserService userService;

    @Mock
    private StudyStatusHistoryRepository historyRepository;

    @Mock
    private CurrentActor currentActor;

    @Mock
    private JdbcTemplate jdbc;

    @Mock
    private ObjectProvider<StudyReadiness> readinessProvider;

    @Mock
    private ObjectProvider<StudySchedulingLifecycle> schedulingLifecycleProvider;

    @Mock
    private StudySchedulingLifecycle schedulingLifecycle;

    @Mock
    private StudyReadiness readiness;

    @Mock
    private ParticipantLookup participantLookup;

    private StudyService studyService;

    @BeforeEach
    void setUp() {
        studyService = new StudyService(studyRepository, userService, historyRepository,
                currentActor, jdbc, readinessProvider, participantLookup, schedulingLifecycleProvider);
        org.mockito.Mockito.lenient().when(currentActor.userId()).thenReturn(7L);
    }

    @Test
    void createStudyPersistsTrimmedDataForResearcher() {
        when(userService.getUser(7L)).thenReturn(userWithRole(UserRole.RESEARCHER));
        when(studyRepository.save(any(Study.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Study created = studyService.createStudy("  Estudo do sono  ", "  Avaliar hábitos  ", 7L,
                START_DATE, END_DATE, 30);

        ArgumentCaptor<Study> captor = ArgumentCaptor.forClass(Study.class);
        verify(studyRepository).save(captor.capture());
        assertSame(captor.getValue(), created);
        assertEquals("Estudo do sono", created.getTitle());
        assertEquals("Avaliar hábitos", created.getObjective());
        assertEquals(7L, created.getResponsibleUserId());
        assertEquals(30, created.getParticipantLimit());
        assertEquals(StudyStatus.PLANNING, created.getStatus());
    }

    @Test
    void createStudyRejectsUserWithoutResearcherRole() {
        when(userService.getUser(7L)).thenReturn(userWithRole(UserRole.COORDINATOR));

        InvalidStudyException exception = assertThrows(InvalidStudyException.class,
                () -> studyService.createStudy("Estudo", "Objetivo", 7L, START_DATE, END_DATE, 30));

        assertEquals("O responsável pelo estudo deve ser um pesquisador.", exception.getMessage());
        verify(studyRepository, never()).save(any(Study.class));
    }

    @Test
    void createStudyRejectsInactiveResearcher() {
        User researcher = userWithRole(UserRole.RESEARCHER);
        researcher.deactivate();
        when(userService.getUser(7L)).thenReturn(researcher);

        InvalidStudyException exception = assertThrows(InvalidStudyException.class,
                () -> studyService.createStudy("Estudo", "Objetivo", 7L, START_DATE, END_DATE, 30));

        assertEquals("O pesquisador responsável pelo estudo deve estar ativo.", exception.getMessage());
        verify(studyRepository, never()).save(any(Study.class));
    }

    @Test
    void createStudyRejectsUnknownResponsibleUser() {
        when(userService.getUser(99L)).thenThrow(new ResourceNotFoundException("Usuário não encontrado: 99"));

        assertThrows(ResourceNotFoundException.class,
                () -> studyService.createStudy("Estudo", "Objetivo", 99L, START_DATE, END_DATE, 30));

        verify(studyRepository, never()).save(any(Study.class));
    }

    @Test
    void createStudyRejectsEndDateBeforeStartDate() {
        assertThrows(InvalidStudyException.class,
                () -> studyService.createStudy("Estudo", "Objetivo", 7L, END_DATE, START_DATE, 30));

        verifyNoInteractions(studyRepository, userService);
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 1_000_000})
    void createStudyAcceptsParticipantLimitBoundaries(int participantLimit) {
        when(userService.getUser(7L)).thenReturn(userWithRole(UserRole.RESEARCHER));
        when(studyRepository.save(any(Study.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Study created = studyService.createStudy("Estudo", "Objetivo", 7L,
                START_DATE, END_DATE, participantLimit);

        assertEquals(participantLimit, created.getParticipantLimit());
        verify(studyRepository).save(created);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(ints = {-1, 0, 1_000_001, Integer.MAX_VALUE})
    void createStudyRejectsParticipantLimitOutsideContract(Integer participantLimit) {
        assertThrows(InvalidStudyException.class,
                () -> studyService.createStudy("Estudo", "Objetivo", 7L,
                        START_DATE, END_DATE, participantLimit));

        verifyNoInteractions(studyRepository, userService);
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 1_000_000})
    void updateStudyAcceptsParticipantLimitBoundaries(int participantLimit) {
        Study study = study("Título antigo", 10);
        when(studyRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(study));
        when(userService.getUser(7L)).thenReturn(userWithRole(UserRole.RESEARCHER));

        Study updated = studyService.updateStudy(3L, "Novo título", "Novo objetivo", 7L,
                START_DATE, END_DATE, participantLimit);

        assertSame(study, updated);
        assertEquals(participantLimit, updated.getParticipantLimit());
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(ints = {-1, 0, 1_000_001, Integer.MAX_VALUE})
    void updateStudyRejectsInvalidParticipantLimitWithoutChangingData(Integer participantLimit) {
        Study study = study("Título antigo", 10);
        when(studyRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(study));

        assertThrows(InvalidStudyException.class,
                () -> studyService.updateStudy(3L, "Novo título", "Novo objetivo", 7L,
                        START_DATE, END_DATE, participantLimit));

        assertEquals("Título antigo", study.getTitle());
        assertEquals("Objetivo", study.getObjective());
        assertEquals(10, study.getParticipantLimit());
        verifyNoInteractions(userService, jdbc);
        verify(studyRepository, never()).save(any(Study.class));
    }

    @Test
    void updateStudyChangesManagedEntityAfterValidation() {
        Study study = study("Título antigo", 10);
        study.advanceStatus(StudyStatus.RECRUITMENT);
        when(studyRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(study));
        when(userService.getUser(7L)).thenReturn(userWithRole(UserRole.RESEARCHER));

        Study updated = studyService.updateStudy(3L, "  Novo título  ", "  Novo objetivo  ", 7L,
                START_DATE, END_DATE, 40);

        assertSame(study, updated);
        assertEquals("Novo título", study.getTitle());
        assertEquals("Novo objetivo", study.getObjective());
        assertEquals(40, study.getParticipantLimit());
        assertEquals(StudyStatus.RECRUITMENT, study.getStatus());
        verify(studyRepository, never()).save(any(Study.class));
    }

    @Test
    void advanceStatusAllowsOnlyTheNextState() {
        Study study = study("Estudo", 10);
        when(studyRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(study));
        when(jdbc.queryForObject(org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.eq(Integer.class), org.mockito.ArgumentMatchers.eq(3L)))
                .thenReturn(1);
        when(readinessProvider.getIfAvailable()).thenReturn(readiness);
        when(readiness.hasInclusionAndExclusionCriteria(3L)).thenReturn(true);
        when(readiness.hasIncludedParticipant(3L)).thenReturn(true);

        assertSame(study, studyService.advanceStatus(
                3L, StudyStatus.RECRUITMENT, StudyStatus.PLANNING, null));
        assertSame(study, studyService.advanceStatus(
                3L, StudyStatus.EXECUTION, StudyStatus.RECRUITMENT, null));
        assertSame(study, studyService.advanceStatus(
                3L, StudyStatus.CLOSED, StudyStatus.EXECUTION, null));
        assertEquals(StudyStatus.CLOSED, study.getStatus());
        verify(studyRepository, never()).save(any(Study.class));
    }

    @Test
    void closedStudyRequiresEveryScheduledVisitToHaveAnOutcome() {
        Study study = study("Estudo", 10);
        study.advanceStatus(StudyStatus.RECRUITMENT);
        study.advanceStatus(StudyStatus.EXECUTION);
        when(studyRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(study));
        when(schedulingLifecycleProvider.getIfAvailable()).thenReturn(schedulingLifecycle);
        when(schedulingLifecycle.hasScheduledVisits(3L)).thenReturn(true);

        StudyStatusConflictException conflict = assertThrows(StudyStatusConflictException.class,
                () -> studyService.advanceStatus(3L, StudyStatus.CLOSED, StudyStatus.EXECUTION, null));

        assertEquals("STUDY_HAS_SCHEDULED_VISITS", conflict.getCode());
        assertEquals(StudyStatus.EXECUTION, study.getStatus());
        verifyNoInteractions(historyRepository);
        verify(schedulingLifecycle, never()).cancelPendingScheduledVisits(any(), any(), any());
    }

    @Test
    void cancellationDelegatesPendingVisitsWithinStatusTransaction() {
        Study study = study("Estudo", 10);
        study.advanceStatus(StudyStatus.RECRUITMENT);
        when(studyRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(study));
        when(schedulingLifecycleProvider.getIfAvailable()).thenReturn(schedulingLifecycle);

        studyService.advanceStatus(3L, StudyStatus.CANCELLED, StudyStatus.RECRUITMENT, "Interrompido");

        assertEquals(StudyStatus.CANCELLED, study.getStatus());
        verify(schedulingLifecycle).cancelPendingScheduledVisits(
                org.mockito.ArgumentMatchers.eq(3L), org.mockito.ArgumentMatchers.eq(7L), any());
        verify(historyRepository).save(any(StudyStatusHistory.class));
    }

    @Test
    void advanceStatusRejectsSkippedAndRepeatedTransitionsWithoutChangingState() {
        Study study = study("Estudo", 10);
        when(studyRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(study));

        assertThrows(StudyStatusConflictException.class,
                () -> studyService.advanceStatus(3L, StudyStatus.EXECUTION, StudyStatus.PLANNING, null));
        assertThrows(StudyStatusConflictException.class,
                () -> studyService.advanceStatus(3L, StudyStatus.PLANNING, StudyStatus.PLANNING, null));
        assertEquals(StudyStatus.PLANNING, study.getStatus());
    }

    @Test
    void advanceStatusRejectsUnknownStudy() {
        when(studyRepository.findByIdForUpdate(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> studyService.advanceStatus(99L, StudyStatus.RECRUITMENT, StudyStatus.PLANNING, null));
    }

    @Test
    void cancelledRecruitmentCanReturnOnlyToRecruitment() {
        Study study = study("Estudo", 10);
        study.advanceStatus(StudyStatus.RECRUITMENT);
        when(studyRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(study));

        studyService.advanceStatus(3L, StudyStatus.CANCELLED, StudyStatus.RECRUITMENT, "  Sem financiamento  ");
        when(historyRepository.findFirstByStudyIdOrderByIdDesc(3L)).thenReturn(Optional.of(
                new StudyStatusHistory(3L, 7L, java.time.Instant.now(),
                        StudyStatus.RECRUITMENT, StudyStatus.CANCELLED, "Sem financiamento")));
        assertThrows(StudyStatusConflictException.class,
                () -> studyService.advanceStatus(3L, StudyStatus.PLANNING, StudyStatus.CANCELLED, null));
        studyService.advanceStatus(3L, StudyStatus.RECRUITMENT, StudyStatus.CANCELLED, null);
        assertEquals(StudyStatus.RECRUITMENT, study.getStatus());
    }

    @Test
    void cancellationRequiresReasonAndStaleStatusIsRejected() {
        Study study = study("Estudo", 10);
        when(studyRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(study));

        assertThrows(InvalidStudyException.class,
                () -> studyService.advanceStatus(3L, StudyStatus.CANCELLED, StudyStatus.PLANNING, " "));
        assertThrows(StudyStatusConflictException.class,
                () -> studyService.advanceStatus(3L, StudyStatus.RECRUITMENT, StudyStatus.EXECUTION, null));
        assertEquals(StudyStatus.PLANNING, study.getStatus());
        verifyNoInteractions(historyRepository);
    }

    @Test
    void cancellationDuringExecutionCannotBeRestored() {
        Study study = study("Estudo", 10);
        study.advanceStatus(StudyStatus.RECRUITMENT);
        study.advanceStatus(StudyStatus.EXECUTION);
        when(studyRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(study));

        studyService.advanceStatus(3L, StudyStatus.CANCELLED, StudyStatus.EXECUTION, "Interrompido");
        when(historyRepository.findFirstByStudyIdOrderByIdDesc(3L)).thenReturn(Optional.of(
                new StudyStatusHistory(3L, 7L, java.time.Instant.now(),
                        StudyStatus.EXECUTION, StudyStatus.CANCELLED, "Interrompido")));

        assertThrows(StudyStatusConflictException.class,
                () -> studyService.advanceStatus(3L, StudyStatus.EXECUTION, StudyStatus.CANCELLED, null));
        assertEquals(StudyStatus.CANCELLED, study.getStatus());
    }

    @Test
    void recruitmentCanReturnToPlanning() {
        Study study = study("Estudo", 10);
        study.advanceStatus(StudyStatus.RECRUITMENT);
        when(studyRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(study));

        studyService.advanceStatus(3L, StudyStatus.PLANNING, StudyStatus.RECRUITMENT, null);
        assertEquals(StudyStatus.PLANNING, study.getStatus());
    }

    @Test
    void recruitmentIsBlockedUntilCriteriaModuleProvidesReadiness() {
        Study study = study("Estudo", 10);
        when(studyRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(study));
        when(jdbc.queryForObject(org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.eq(Integer.class), org.mockito.ArgumentMatchers.eq(3L)))
                .thenReturn(1);

        assertThrows(ProtocolConflictException.class,
                () -> studyService.advanceStatus(3L, StudyStatus.RECRUITMENT, StudyStatus.PLANNING, null));
        assertEquals(StudyStatus.PLANNING, study.getStatus());
        verifyNoInteractions(historyRepository);
    }

    @Test
    void executionIsBlockedUntilParticipantModuleProvidesReadiness() {
        Study study = study("Estudo", 10);
        study.advanceStatus(StudyStatus.RECRUITMENT);
        when(studyRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(study));

        assertThrows(ProtocolConflictException.class,
                () -> studyService.advanceStatus(3L, StudyStatus.EXECUTION, StudyStatus.RECRUITMENT, null));
        assertEquals(StudyStatus.RECRUITMENT, study.getStatus());
        verifyNoInteractions(historyRepository);
    }

    @Test
    void otherResearcherCannotUpdateOrChangeStatus() {
        Study study = study("Estudo", 10);
        when(studyRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(study));
        when(currentActor.userId()).thenReturn(8L);

        assertThrows(AccessDeniedException.class,
                () -> studyService.updateStudy(3L, "Outro", "Objetivo", 7L,
                        START_DATE, END_DATE, 10));
        assertThrows(AccessDeniedException.class,
                () -> studyService.advanceStatus(3L, StudyStatus.RECRUITMENT, StudyStatus.PLANNING, null));
        assertEquals("Estudo", study.getTitle());
        verifyNoInteractions(historyRepository);
    }

    @Test
    void updateStudyKeepsOriginalDataWhenValidationFails() {
        Study study = study("Título antigo", 10);
        when(studyRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(study));

        assertThrows(InvalidStudyException.class,
                () -> studyService.updateStudy(3L, "Novo título", "Novo objetivo", 7L,
                        END_DATE, START_DATE, 40));

        assertEquals("Título antigo", study.getTitle());
        assertEquals(10, study.getParticipantLimit());
        verifyNoInteractions(userService);
    }

    @Test
    void listAndGetStudiesReturnRepositoryResults() {
        Study study = study("Estudo", 10);
        when(studyRepository.findAll()).thenReturn(List.of(study));
        when(studyRepository.findById(3L)).thenReturn(Optional.of(study));

        assertEquals(List.of(study), studyService.listStudies());
        assertSame(study, studyService.getStudy(3L));
    }

    @Test
    void getStudyRejectsUnknownId() {
        when(studyRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> studyService.getStudy(99L));
    }

    private Study study(String title, int participantLimit) {
        return new Study(title, "Objetivo", 7L, START_DATE, END_DATE, participantLimit);
    }

    private User userWithRole(UserRole role) {
        return new User("Responsável", "responsavel@example.com", "{bcrypt}hash", role);
    }
}
