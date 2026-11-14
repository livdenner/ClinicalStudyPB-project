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
import clinicalstudypb.candidates.domain.CandidateStatus;
import clinicalstudypb.candidates.domain.InvalidCandidateException;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.consent.domain.SimulatedConsent;
import clinicalstudypb.consent.infrastructure.SimulatedConsentRepository;
import clinicalstudypb.participants.infrastructure.ParticipantRepository;
import clinicalstudypb.shared.CurrentActor;
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
    @Mock private CurrentActor currentActor;

    private CandidateService service;

    @BeforeEach
    void setUp() {
        service = new CandidateService(candidateRepository, studyService, userService,
                invitationService, consentRepository, participantRepository, currentActor);
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
        when(candidateRepository.existsByStudyIdAndUserIdAndCancelledAtIsNull(3L, 7L)).thenReturn(true);

        CandidateConflictException exception = assertThrows(CandidateConflictException.class,
                () -> service.create(3L, "Ana", 42, EMAIL, PHONE));
        assertEquals("CANDIDATE_ALREADY_IN_STUDY", exception.getCode());
        verify(invitationService, never()).issue(any());
    }

    @Test
    void disabledAccountIsRejected() {
        User disabled = user(UserRole.PARTICIPANT, false);
        disabled.deactivate();
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(userService.findLockedByEmail(EMAIL)).thenReturn(Optional.of(disabled));

        CandidateConflictException exception = assertThrows(CandidateConflictException.class,
                () -> service.create(3L, "Ana", 42, EMAIL, PHONE));
        assertEquals("PARTICIPANT_ACCOUNT_DEACTIVATED", exception.getCode());
        verify(invitationService, never()).issue(any());
    }

    @Test
    void invitedParticipantAfterCancelledInviteIsReissuedCode() {
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(userService.findLockedByEmail(EMAIL)).thenReturn(Optional.of(user(UserRole.PARTICIPANT, false)));
        when(invitationService.find(7L)).thenReturn(Optional.empty());
        when(candidateRepository.saveAndFlush(any(Candidate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(invitationService.issue(7L)).thenReturn(
                new CandidateInvitationService.IssuedCode("reemissao", Instant.now().plusSeconds(3600)));

        CandidateService.Registration result = service.create(3L, "Ana", 42, EMAIL, PHONE);

        assertEquals("reemissao", result.issued().value());
    }

    @Test
    void invalidNormalizedPhonesAreRejectedAndValidPhoneIsTrimmed() {
        for (String badPhone : List.of("+        ", "--------", "   +1234", "1234567")) {
            assertThrows(InvalidCandidateException.class,
                    () -> service.create(3L, "Ana", 42, EMAIL, badPhone));
        }
        verify(candidateRepository, never()).saveAndFlush(any());

        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(userService.findLockedByEmail(EMAIL)).thenReturn(Optional.of(user(UserRole.PARTICIPANT, true)));
        when(candidateRepository.saveAndFlush(any(Candidate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        CandidateService.Registration result = service.create(3L, "Ana", 42, EMAIL, "  (83) 99999-0000  ");
        assertEquals("(83) 99999-0000", result.candidate().getPhone());
    }

    @Test
    void outsideRecruitmentIsRejected() {
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.PLANNING));
        assertThrows(CandidateConflictException.class, () -> service.create(3L, "Ana", 42, EMAIL, PHONE));
    }

    @Test
    void listAndGetPreserveRepositoryOrderAndStudyScope() {
        Candidate active = new Candidate(3L, "Ana", "ana", 42, EMAIL, PHONE, 7L);
        Candidate cancelled = new Candidate(3L, "Bia", "bia", 35, "bia@test.local", PHONE, 8L);
        cancelled.cancel("Desistência", Instant.now(), 99L);
        when(studyService.getStudy(3L)).thenReturn(study(StudyStatus.PLANNING));
        when(candidateRepository.findAllByStudyIdAndCancelledAtIsNullOrderByIdAsc(3L)).thenReturn(List.of(active));
        when(candidateRepository.findAllByStudyIdOrderByIdAsc(3L)).thenReturn(List.of(active, cancelled));
        when(candidateRepository.findByIdAndStudyId(9L, 3L)).thenReturn(Optional.of(active));

        assertEquals(List.of(active), service.list(3L));
        assertEquals(List.of(active, cancelled), service.list(3L, true));
        assertSame(active, service.get(3L, 9L));
    }

    @Test
    void cancelTrimsReasonAndInvalidatesInviteWhenNoOtherActiveCandidacy() {
        Candidate candidate = candidate(9L, 3L, 7L);
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(candidateRepository.findForConsentUpdate(9L, 3L)).thenReturn(Optional.of(candidate));
        when(participantRepository.existsByStudyIdAndCandidateId(3L, 9L)).thenReturn(false);
        when(currentActor.userId()).thenReturn(99L);
        when(candidateRepository.saveAndFlush(candidate)).thenReturn(candidate);
        when(userService.findLockedById(7L)).thenReturn(Optional.of(user(UserRole.PARTICIPANT, false)));
        when(candidateRepository.existsByUserIdAndCancelledAtIsNull(7L)).thenReturn(false);

        Candidate cancelled = service.cancel(3L, 9L, "  " + "x".repeat(500) + "  ");

        assertEquals("x".repeat(500), cancelled.getCancellationReason());
        assertEquals(99L, cancelled.getCancelledByUserId());
        assertNotNull(cancelled.getCancelledAt());
        verify(invitationService).invalidate(7L);
    }

    @Test
    void cancelKeepsInviteWhenInactiveUserHasAnotherActiveCandidacyOrIsAlreadyActive() {
        Candidate first = candidate(9L, 3L, 7L);
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(candidateRepository.findForConsentUpdate(9L, 3L)).thenReturn(Optional.of(first));
        when(candidateRepository.saveAndFlush(first)).thenReturn(first);
        when(currentActor.userId()).thenReturn(99L);
        when(userService.findLockedById(7L)).thenReturn(Optional.of(user(UserRole.PARTICIPANT, false)));
        when(candidateRepository.existsByUserIdAndCancelledAtIsNull(7L)).thenReturn(true);

        service.cancel(3L, 9L, "Outro estudo ativo");
        verify(invitationService, never()).invalidate(7L);

        Candidate activeCandidate = candidate(10L, 4L, 8L);
        User activeUser = user(UserRole.PARTICIPANT, true);
        ReflectionTestUtils.setField(activeUser, "id", 8L);
        when(studyService.lockForCandidateRegistration(4L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(candidateRepository.findForConsentUpdate(10L, 4L)).thenReturn(Optional.of(activeCandidate));
        when(candidateRepository.saveAndFlush(activeCandidate)).thenReturn(activeCandidate);
        when(userService.findLockedById(8L)).thenReturn(Optional.of(activeUser));

        service.cancel(4L, 10L, "Conta ativa");
        verify(invitationService, never()).invalidate(8L);
    }

    @Test
    void cancelValidatesReasonAndRejectsConflicts() {
        assertThrows(InvalidCandidateException.class, () -> service.cancel(3L, 9L, null));
        assertThrows(InvalidCandidateException.class, () -> service.cancel(3L, 9L, "   "));
        assertThrows(InvalidCandidateException.class, () -> service.cancel(3L, 9L, "x".repeat(501)));

        Candidate candidate = candidate(9L, 3L, 7L);
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.PLANNING));
        when(candidateRepository.findForConsentUpdate(9L, 3L)).thenReturn(Optional.of(candidate));
        assertEquals("STUDY_NOT_RECRUITING", assertThrows(CandidateConflictException.class,
                () -> service.cancel(3L, 9L, "Fora do recrutamento")).getCode());

        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(participantRepository.existsByStudyIdAndCandidateId(3L, 9L)).thenReturn(true);
        assertEquals("CANDIDATE_ALREADY_INCLUDED", assertThrows(CandidateConflictException.class,
                () -> service.cancel(3L, 9L, "Já incluído")).getCode());

        candidate.cancel("Primeiro cancelamento", Instant.now(), 99L);
        assertEquals("CANDIDATE_ALREADY_CANCELLED", assertThrows(CandidateConflictException.class,
                () -> service.cancel(3L, 9L, "Segundo cancelamento")).getCode());
    }

    @Test
    void reissueRejectsCancelledCandidateAndSnapshotKeepsConsentStatus() {
        Candidate candidate = candidate(9L, 3L, 7L);
        candidate.cancel("Cadastro errado", Instant.now(), 99L);
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(candidateRepository.findForConsentUpdate(9L, 3L)).thenReturn(Optional.of(candidate));

        CandidateConflictException exception = assertThrows(CandidateConflictException.class,
                () -> service.reissue(3L, 9L));
        assertEquals("CANDIDATE_CANCELLED", exception.getCode());

        when(userService.getUser(7L)).thenReturn(user(UserRole.PARTICIPANT, true));
        when(invitationService.find(7L)).thenReturn(Optional.empty());
        when(consentRepository.findById(9L))
                .thenReturn(Optional.of(new SimulatedConsent(9L, ConsentDecision.GRANTED, Instant.now())));
        when(participantRepository.existsByStudyIdAndCandidateId(3L, 9L)).thenReturn(false);

        CandidateService.Snapshot snapshot = service.snapshot(candidate, null);
        assertEquals(CandidateStatus.CANCELLED, snapshot.status());
        assertEquals(clinicalstudypb.consent.domain.ConsentStatus.GRANTED, snapshot.consent());
    }

    private Candidate candidate(Long id, Long studyId, Long userId) {
        Candidate candidate = new Candidate(studyId, "Ana", "ana", 42, EMAIL, PHONE, userId);
        ReflectionTestUtils.setField(candidate, "id", id);
        return candidate;
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
