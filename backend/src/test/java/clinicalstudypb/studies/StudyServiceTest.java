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
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.InvalidStudyException;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.infrastructure.StudyRepository;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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

    private StudyService studyService;

    @BeforeEach
    void setUp() {
        studyService = new StudyService(studyRepository, userService);
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

    @Test
    void createStudyRejectsNonPositiveParticipantLimit() {
        assertThrows(InvalidStudyException.class,
                () -> studyService.createStudy("Estudo", "Objetivo", 7L, START_DATE, END_DATE, 0));

        verifyNoInteractions(studyRepository, userService);
    }

    @Test
    void updateStudyChangesManagedEntityAfterValidation() {
        Study study = study("Título antigo", 10);
        when(studyRepository.findById(3L)).thenReturn(Optional.of(study));
        when(userService.getUser(7L)).thenReturn(userWithRole(UserRole.RESEARCHER));

        Study updated = studyService.updateStudy(3L, "  Novo título  ", "  Novo objetivo  ", 7L,
                START_DATE, END_DATE, 40);

        assertSame(study, updated);
        assertEquals("Novo título", study.getTitle());
        assertEquals("Novo objetivo", study.getObjective());
        assertEquals(40, study.getParticipantLimit());
        verify(studyRepository, never()).save(any(Study.class));
    }

    @Test
    void updateStudyKeepsOriginalDataWhenValidationFails() {
        Study study = study("Título antigo", 10);
        when(studyRepository.findById(3L)).thenReturn(Optional.of(study));

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
