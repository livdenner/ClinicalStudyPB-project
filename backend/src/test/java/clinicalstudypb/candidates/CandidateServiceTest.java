package clinicalstudypb.candidates;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import clinicalstudypb.candidates.application.CandidateInvitationService;
import clinicalstudypb.candidates.application.CandidateService;
import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.CandidateActivationInvite;
import clinicalstudypb.candidates.domain.CandidateConflictException;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.consent.infrastructure.SimulatedConsentRepository;
import clinicalstudypb.participants.infrastructure.ParticipantRepository;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class CandidateServiceTest {

    private static final String EMAIL = "ana@test.local";
    private static final String PHONE = "83999990000";

    @Mock private CandidateRepository candidateRepository;
    @Mock private StudyService studyService;
    @Mock private UserService userService;
    @Mock private CandidateInvitationService invitationService;
    @Mock private SimulatedConsentRepository consentRepository;
    @Mock private ParticipantRepository participantRepository;

    private CandidateService service;

    @BeforeEach
    void setUp() {
        service = new CandidateService(candidateRepository, studyService, userService,
                invitationService, consentRepository, participantRepository);
    }

    @Test
    void newEmailCreatesInactiveParticipantAndInvitation() {
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(userService.findLockedByEmail(EMAIL)).thenReturn(Optional.empty());
        User invited = user(UserRole.PARTICIPANT, false);
        when(userService.createInvitedParticipant("Ana Silva", EMAIL)).thenReturn(invited);
        when(candidateRepository.saveAndFlush(any(Candidate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(invitationService.issue(7L)).thenReturn(
                new CandidateInvitationService.IssuedCode("codigo-secreto", Instant.now().plusSeconds(3600)));

        CandidateService.Registration result = service.create(3L, "  Ana   Silva  ", 42,
                " ANA@test.local ", PHONE);

        assertEquals("Ana Silva", result.candidate().getName());
        assertEquals(EMAIL, result.candidate().getEmail());
        assertEquals(7L, result.candidate().getUserId());
        assertNotNull(result.issued());
        verify(userService).createInvitedParticipant("Ana Silva", EMAIL);
        verify(invitationService).issue(7L);
    }

    @Test
    void activeParticipantIsReusedWithoutInvitation() {
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(userService.findLockedByEmail(EMAIL)).thenReturn(Optional.of(user(UserRole.PARTICIPANT, true)));
        when(candidateRepository.saveAndFlush(any(Candidate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CandidateService.Registration result = service.create(3L, "Ana", 42, EMAIL, PHONE);

        assertEquals(7L, result.candidate().getUserId());
        assertNull(result.issued());
        verify(invitationService, never()).issue(any());
    }

    @Test
    void invitedParticipantGetsNewCode() {
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(userService.findLockedByEmail(EMAIL)).thenReturn(Optional.of(user(UserRole.PARTICIPANT, false)));
        when(invitationService.find(7L)).thenReturn(Optional.of(invitation()));
        when(candidateRepository.saveAndFlush(any(Candidate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(invitationService.issue(7L)).thenReturn(
                new CandidateInvitationService.IssuedCode("novo-codigo", Instant.now().plusSeconds(3600)));

        assertEquals("novo-codigo", service.create(3L, "Ana", 42, EMAIL, PHONE).issued().value());
    }

    @Test
    void staffEmailIsRejectedWithoutCandidate() {
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(userService.findLockedByEmail(EMAIL)).thenReturn(Optional.of(user(UserRole.RESEARCHER, true)));

        assertThrows(CandidateConflictException.class, () -> service.create(3L, "Ana", 42, EMAIL, PHONE));
        verify(candidateRepository, never()).saveAndFlush(any());
    }

    @Test
    void duplicateAccountInStudyIsRejectedBeforeReplacingCode() {
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(userService.findLockedByEmail(EMAIL)).thenReturn(Optional.of(user(UserRole.PARTICIPANT, false)));
        when(candidateRepository.existsByStudyIdAndUserId(3L, 7L)).thenReturn(true);

        assertThrows(CandidateConflictException.class, () -> service.create(3L, "Ana", 42, EMAIL, PHONE));
        verify(invitationService, never()).issue(any());
    }

    @Test
    void disabledAccountWithoutInviteIsRejected() {
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(userService.findLockedByEmail(EMAIL)).thenReturn(Optional.of(user(UserRole.PARTICIPANT, false)));
        when(invitationService.find(7L)).thenReturn(Optional.empty());

        assertThrows(CandidateConflictException.class, () -> service.create(3L, "Ana", 42, EMAIL, PHONE));
    }

    @Test
    void deactivatedParticipantAccountIsRejectedWithoutCreatingCandidate() {
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        User deactivated = user(UserRole.PARTICIPANT, true);
        deactivated.deactivate();
        when(userService.findLockedByEmail(EMAIL)).thenReturn(Optional.of(deactivated));

        CandidateConflictException error = assertThrows(CandidateConflictException.class,
                () -> service.create(3L, "Ana", 42, EMAIL, PHONE));

        assertEquals("PARTICIPANT_ACCOUNT_DEACTIVATED", error.getCode());
        verify(candidateRepository, never()).saveAndFlush(any());
    }

    @Test
    void outsideRecruitmentIsRejected() {
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.PLANNING));
        assertThrows(CandidateConflictException.class, () -> service.create(3L, "Ana", 42, EMAIL, PHONE));
    }

    @Test
    void listAndGetPreserveRepositoryOrderAndStudyScope() {
        Candidate candidate = new Candidate(3L, "Ana", "ana", 42, EMAIL, PHONE, 7L);
        when(studyService.getStudy(3L)).thenReturn(study(StudyStatus.PLANNING));
        when(candidateRepository.findAllByStudyIdOrderByIdAsc(3L)).thenReturn(List.of(candidate));
        when(candidateRepository.findByIdAndStudyId(9L, 3L)).thenReturn(Optional.of(candidate));

        assertEquals(List.of(candidate), service.list(3L));
        assertSame(candidate, service.get(3L, 9L));
    }

    private CandidateActivationInvite invitation() {
        return new CandidateActivationInvite(7L, "hash", Instant.now(), Instant.now().plusSeconds(3600));
    }

    private User user(UserRole role, boolean active) {
        User result = active ? new User("Ana", EMAIL, "{bcrypt}hash", role)
                : User.invitedParticipant("Ana", EMAIL, "{bcrypt}hash");
        ReflectionTestUtils.setField(result, "id", 7L);
        return result;
    }

    private Study study(StudyStatus status) {
        Study result = new Study("Estudo", "Objetivo", 1L,
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20);
        if (status == StudyStatus.RECRUITMENT) {
            result.advanceStatus(StudyStatus.RECRUITMENT);
        }
        return result;
    }
}
