package clinicalstudypb.participants;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import clinicalstudypb.candidates.application.CandidateService;
import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.CandidateConflictException;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.consent.application.SimulatedConsentService;
import clinicalstudypb.consent.domain.ConsentConflictException;
import clinicalstudypb.participants.application.ParticipantResult;
import clinicalstudypb.participants.application.ParticipantService;
import clinicalstudypb.participants.application.ParticipantWithdrawalVisits;
import clinicalstudypb.participants.domain.InclusionConflictException;
import clinicalstudypb.participants.domain.InvalidWithdrawalException;
import clinicalstudypb.participants.domain.Participant;
import clinicalstudypb.participants.domain.ParticipantStatus;
import clinicalstudypb.participants.domain.WithdrawalConflictException;
import clinicalstudypb.participants.infrastructure.ParticipantRepository;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Verifica as condições de inclusão e as consultas sem banco, threads ou relógio variável.
 *
 * @author Lívia
 * @since 2026-11-09
 * @version 0.0.1
 */
@ExtendWith(MockitoExtension.class)
class ParticipantServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-09T12:30:00.123456789Z");
    private static final Instant STORED_TIME = Instant.parse("2026-11-09T12:30:00.123456Z");

    @Mock
    private ParticipantRepository repository;
    @Mock
    private StudyService studyService;
    @Mock
    private CandidateService candidateService;
    @Mock
    private SimulatedConsentService consentService;
    @Mock
    private ParticipantWithdrawalVisits withdrawalVisits;
    @Mock
    private CurrentActor currentActor;

    private ParticipantService service;
    private Candidate candidate;

    @BeforeEach
    void setUp() {
        service = new ParticipantService(repository, studyService, candidateService, consentService,
                withdrawalVisits, currentActor, Clock.fixed(NOW, ZoneOffset.UTC));
        candidate = new Candidate(3L, "Ana Silva", "ana silva", 42);
        ReflectionTestUtils.setField(candidate, "id", 7L);
        candidate.updateEligibilityStatus(EligibilityStatus.ELIGIBLE);
    }

    @Test
    void includesLastAvailablePlaceAndRecordsAuthenticatedAuthorAndFixedTime() {
        prepareInclusion(StudyStatus.RECRUITMENT);
        when(repository.countByStudyId(3L)).thenReturn(1L);
        when(currentActor.userId()).thenReturn(9L);
        when(repository.saveAndFlush(any(Participant.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ParticipantResult result = service.include(3L, 7L);

        ArgumentCaptor<Participant> saved = ArgumentCaptor.forClass(Participant.class);
        verify(repository).saveAndFlush(saved.capture());
        assertSame(saved.getValue(), result.participant());
        assertEquals(3L, saved.getValue().getStudyId());
        assertEquals(7L, saved.getValue().getCandidateId());
        assertEquals(9L, saved.getValue().getIncludedBy());
        assertEquals(STORED_TIME, saved.getValue().getIncludedAt());
        assertEquals("Ana Silva", result.candidateName());
        verify(consentService).lockAfterInclusion(3L, 7L);
    }

    @ParameterizedTest
    @EnumSource(value = StudyStatus.class, names = {"PLANNING", "EXECUTION", "CLOSED", "CANCELLED"})
    void rejectsStudyOutsideRecruitmentBeforeAnyWrite(StudyStatus state) {
        prepareInclusion(state);
        assertThrows(InclusionConflictException.class, () -> service.include(3L, 7L));
        assertNoWrite();
    }

    @ParameterizedTest
    @EnumSource(value = EligibilityStatus.class, names = {"PENDING", "INELIGIBLE"})
    void rejectsCandidateWithoutCompletePositiveEligibility(EligibilityStatus status) {
        prepareInclusion(StudyStatus.RECRUITMENT);
        candidate.updateEligibilityStatus(status);
        assertThrows(InclusionConflictException.class, () -> service.include(3L, 7L));
        assertNoWrite();
    }

    @Test
    void rejectsDuplicateBeforeLockingConsentOrSaving() {
        prepareInclusion(StudyStatus.RECRUITMENT);
        when(repository.existsByStudyIdAndCandidateId(3L, 7L)).thenReturn(true);
        assertThrows(InclusionConflictException.class, () -> service.include(3L, 7L));
        verify(repository, never()).countByStudyId(3L);
        assertNoWrite();
    }

    @Test
    void rejectsCancelledCandidateBeforeOtherInclusionChecks() {
        candidate.cancel("Candidatura cancelada", STORED_TIME, 9L);
        prepareInclusion(StudyStatus.RECRUITMENT);
        CandidateConflictException exception = assertThrows(
                CandidateConflictException.class,
                () -> service.include(3L, 7L));
        assertEquals("CANDIDATE_CANCELLED", exception.getCode());
        verify(repository, never()).existsByStudyIdAndCandidateId(3L, 7L);
        assertNoWrite();
    }

    @ParameterizedTest
    @ValueSource(longs = {2L, 3L})
    void refusesFullOrAlreadyExceededCapacity(long included) {
        prepareInclusion(StudyStatus.RECRUITMENT);
        when(repository.countByStudyId(3L)).thenReturn(included);
        assertThrows(InclusionConflictException.class, () -> service.include(3L, 7L));
        assertNoWrite();
    }

    @Test
    void missingOrDeclinedConsentPreventsSavingParticipant() {
        prepareInclusion(StudyStatus.RECRUITMENT);
        when(currentActor.userId()).thenReturn(9L);
        doThrow(new ConsentConflictException("Consentimento não concedido."))
                .when(consentService).lockAfterInclusion(3L, 7L);
        assertThrows(ConsentConflictException.class, () -> service.include(3L, 7L));
        verify(repository, never()).saveAndFlush(any(Participant.class));
    }

    @Test
    void unknownStudyStopsBeforeCandidateLookup() {
        when(studyService.lockForCandidateOperations(3L)).thenThrow(new ResourceNotFoundException("Estudo"));
        assertThrows(ResourceNotFoundException.class, () -> service.include(3L, 7L));
        verifyNoInteractions(repository, candidateService, consentService, currentActor);
    }

    @Test
    void candidateOutsideStudyStopsWithoutPersistence() {
        when(studyService.lockForCandidateOperations(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(candidateService.lockForConsentUpdate(3L, 7L)).thenThrow(new ResourceNotFoundException("Candidato"));
        assertThrows(ResourceNotFoundException.class, () -> service.include(3L, 7L));
        verifyNoInteractions(repository, consentService, currentActor);
    }

    @Test
    void missingAuthenticatedActorPreventsLockingConsentAndPersistence() {
        prepareInclusion(StudyStatus.RECRUITMENT);
        when(currentActor.userId()).thenThrow(new AccessDeniedException("Autor ausente"));
        assertThrows(AccessDeniedException.class, () -> service.include(3L, 7L));
        verifyNoInteractions(consentService);
        verify(repository, never()).saveAndFlush(any(Participant.class));
    }

    @Test
    void emptyStudyReturnsEmptyListWithoutLoadingCandidates() {
        when(repository.findAllByStudyIdOrderByIdAsc(3L)).thenReturn(List.of());
        assertEquals(List.of(), service.list(3L));
        verify(studyService).getStudy(3L);
        verifyNoInteractions(candidateService);
    }

    @Test
    void listPreservesParticipantOrderAndLoadsCandidateNamesInOneCall() {
        Candidate other = new Candidate(3L, "Bruna", "bruna", 31);
        ReflectionTestUtils.setField(other, "id", 8L);
        Participant first = new Participant(3L, 8L, 9L, STORED_TIME);
        Participant second = new Participant(3L, 7L, 9L, STORED_TIME);
        when(repository.findAllByStudyIdOrderByIdAsc(3L)).thenReturn(List.of(first, second));
        when(candidateService.list(3L)).thenReturn(List.of(candidate, other));
        assertEquals(List.of(new ParticipantResult(first, "Bruna"), new ParticipantResult(second, "Ana Silva")),
                service.list(3L));
        verify(candidateService).list(3L);
    }

    @Test
    void individualLookupRespectsStudyAndReturnsCandidateName() {
        Participant participant = new Participant(3L, 7L, 9L, STORED_TIME);
        when(repository.findByIdAndStudyId(12L, 3L)).thenReturn(Optional.of(participant));
        when(candidateService.get(3L, 7L)).thenReturn(candidate);
        assertEquals(new ParticipantResult(participant, "Ana Silva"), service.get(3L, 12L));
    }

    @Test
    void unknownParticipantOrOtherStudyReturnsNotFoundWithoutCandidateLookup() {
        when(repository.findByIdAndStudyId(12L, 3L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> service.get(3L, 12L));
        verifyNoInteractions(candidateService);
    }

    @Test
    void withdrawalLocksStudyThenParticipantCancelsFutureVisitsAndRecordsAudit() {
        Participant participant = activeParticipant();
        Study study = study(StudyStatus.EXECUTION);
        when(studyService.lockForParticipantWithdrawal(3L)).thenReturn(study);
        when(repository.findByIdAndStudyIdForUpdate(12L, 3L)).thenReturn(Optional.of(participant));
        when(currentActor.userId()).thenReturn(9L);
        when(withdrawalVisits.cancelFutureScheduledVisits(3L, 12L, 9L, STORED_TIME)).thenReturn(2);
        when(repository.saveAndFlush(participant)).thenReturn(participant);
        when(candidateService.get(3L, 7L)).thenReturn(candidate);

        ParticipantResult result = service.withdraw(3L, 12L, "  Mudou de cidade  ");

        InOrder order = inOrder(studyService, repository, withdrawalVisits);
        order.verify(studyService).lockForParticipantWithdrawal(3L);
        order.verify(repository).findByIdAndStudyIdForUpdate(12L, 3L);
        order.verify(withdrawalVisits).cancelFutureScheduledVisits(3L, 12L, 9L, STORED_TIME);
        order.verify(repository).saveAndFlush(participant);
        assertSame(participant, result.participant());
        assertEquals("Ana Silva", result.candidateName());
        assertEquals(ParticipantStatus.WITHDRAWN, participant.getStatus());
        assertEquals("Mudou de cidade", participant.getWithdrawalReason());
        assertEquals(STORED_TIME, participant.getWithdrawnAt());
        assertEquals(9L, participant.getWithdrawnByUserId());
        assertEquals(2, participant.getWithdrawalCancelledVisitCount());
    }

    @Test
    void withdrawalIsAllowedDuringRecruitmentAndKeepsZeroCancelledVisits() {
        Participant participant = activeParticipant();
        when(studyService.lockForParticipantWithdrawal(3L)).thenReturn(study(StudyStatus.RECRUITMENT));
        when(repository.findByIdAndStudyIdForUpdate(12L, 3L)).thenReturn(Optional.of(participant));
        when(currentActor.userId()).thenReturn(9L);
        when(withdrawalVisits.cancelFutureScheduledVisits(3L, 12L, 9L, STORED_TIME)).thenReturn(0);
        when(repository.saveAndFlush(participant)).thenReturn(participant);
        when(candidateService.get(3L, 7L)).thenReturn(candidate);

        service.withdraw(3L, 12L, "Desistiu");

        assertTrue(participant.isWithdrawn());
        assertEquals(0, participant.getWithdrawalCancelledVisitCount());
    }

    @Test
    void withdrawalAcceptsReasonWithExactlyFiveHundredCharactersAfterTrim() {
        Participant participant = activeParticipant();
        when(studyService.lockForParticipantWithdrawal(3L)).thenReturn(study(StudyStatus.EXECUTION));
        when(repository.findByIdAndStudyIdForUpdate(12L, 3L)).thenReturn(Optional.of(participant));
        when(currentActor.userId()).thenReturn(9L);
        when(repository.saveAndFlush(participant)).thenReturn(participant);
        when(candidateService.get(3L, 7L)).thenReturn(candidate);
        String reason = "a".repeat(500);

        service.withdraw(3L, 12L, "   " + reason + "   ");

        assertEquals(reason, participant.getWithdrawalReason());
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "   ", "\t\n"})
    void withdrawalRejectsMissingOrBlankReasonBeforeAnyLock(String reason) {
        assertThrows(InvalidWithdrawalException.class, () -> service.withdraw(3L, 12L, reason));
        verifyNoInteractions(studyService, repository, withdrawalVisits, currentActor, candidateService);
    }

    @Test
    void withdrawalRejectsReasonLongerThanFiveHundredCharactersBeforeAnyLock() {
        assertThrows(InvalidWithdrawalException.class, () -> service.withdraw(3L, 12L, "a".repeat(501)));
        verifyNoInteractions(studyService, repository, withdrawalVisits, currentActor, candidateService);
    }

    @ParameterizedTest
    @EnumSource(value = StudyStatus.class, names = {"CLOSED", "CANCELLED"})
    void withdrawalInReadOnlyStudyIsRejectedWithoutCancellingOrSaving(StudyStatus state) {
        Participant participant = activeParticipant();
        when(studyService.lockForParticipantWithdrawal(3L)).thenReturn(study(state));
        when(repository.findByIdAndStudyIdForUpdate(12L, 3L)).thenReturn(Optional.of(participant));

        WithdrawalConflictException exception = assertThrows(WithdrawalConflictException.class,
                () -> service.withdraw(3L, 12L, "Motivo"));

        assertEquals("STUDY_READ_ONLY", exception.getCode());
        assertFalse(participant.isWithdrawn());
        assertNoWithdrawalWrite();
    }

    @Test
    void secondWithdrawalIsRejectedWithoutCancellingAgainOrChangingAudit() {
        Participant participant = activeParticipant();
        participant.withdraw("Primeira retirada", STORED_TIME, 9L, 1);
        when(studyService.lockForParticipantWithdrawal(3L)).thenReturn(study(StudyStatus.EXECUTION));
        when(repository.findByIdAndStudyIdForUpdate(12L, 3L)).thenReturn(Optional.of(participant));

        WithdrawalConflictException exception = assertThrows(WithdrawalConflictException.class,
                () -> service.withdraw(3L, 12L, "Segunda retirada"));

        assertEquals("PARTICIPANT_ALREADY_WITHDRAWN", exception.getCode());
        assertEquals("Primeira retirada", participant.getWithdrawalReason());
        assertEquals(1, participant.getWithdrawalCancelledVisitCount());
        assertNoWithdrawalWrite();
    }

    @Test
    void readOnlyStudyTakesPrecedenceOverAlreadyWithdrawnParticipant() {
        Participant participant = activeParticipant();
        participant.withdraw("Primeira retirada", STORED_TIME, 9L, 0);
        when(studyService.lockForParticipantWithdrawal(3L)).thenReturn(study(StudyStatus.CANCELLED));
        when(repository.findByIdAndStudyIdForUpdate(12L, 3L)).thenReturn(Optional.of(participant));

        WithdrawalConflictException exception = assertThrows(WithdrawalConflictException.class,
                () -> service.withdraw(3L, 12L, "Motivo"));

        assertEquals("STUDY_READ_ONLY", exception.getCode());
    }

    @Test
    void withdrawalOfParticipantOutsideStudyReturnsNotFoundWithoutWriting() {
        when(studyService.lockForParticipantWithdrawal(3L)).thenReturn(study(StudyStatus.EXECUTION));
        when(repository.findByIdAndStudyIdForUpdate(12L, 3L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.withdraw(3L, 12L, "Motivo"));
        assertNoWithdrawalWrite();
    }

    @Test
    void withdrawalInUnknownStudyStopsBeforeLockingParticipant() {
        when(studyService.lockForParticipantWithdrawal(3L)).thenThrow(new ResourceNotFoundException("Estudo"));

        assertThrows(ResourceNotFoundException.class, () -> service.withdraw(3L, 12L, "Motivo"));
        verifyNoInteractions(repository, withdrawalVisits, currentActor, candidateService);
    }

    @Test
    void failureWhileCancellingVisitsLeavesParticipantActiveAndUnsaved() {
        Participant participant = activeParticipant();
        when(studyService.lockForParticipantWithdrawal(3L)).thenReturn(study(StudyStatus.EXECUTION));
        when(repository.findByIdAndStudyIdForUpdate(12L, 3L)).thenReturn(Optional.of(participant));
        when(currentActor.userId()).thenReturn(9L);
        when(withdrawalVisits.cancelFutureScheduledVisits(3L, 12L, 9L, STORED_TIME))
                .thenThrow(new IllegalStateException("Falha no cancelamento"));

        assertThrows(IllegalStateException.class, () -> service.withdraw(3L, 12L, "Motivo"));

        assertFalse(participant.isWithdrawn());
        verify(repository, never()).saveAndFlush(any(Participant.class));
    }

    @Test
    void participantRejectsSecondWithdrawalAndInvalidDataAtDomainLevel() {
        Participant participant = activeParticipant();
        assertThrows(IllegalArgumentException.class, () -> participant.withdraw(" ", STORED_TIME, 9L, 0));
        assertThrows(IllegalArgumentException.class, () -> participant.withdraw("Motivo", STORED_TIME, 9L, -1));
        assertThrows(NullPointerException.class, () -> participant.withdraw(null, STORED_TIME, 9L, 0));
        assertThrows(NullPointerException.class, () -> participant.withdraw("Motivo", null, 9L, 0));
        assertThrows(NullPointerException.class, () -> participant.withdraw("Motivo", STORED_TIME, null, 0));
        assertFalse(participant.isWithdrawn());
        assertEquals(ParticipantStatus.ACTIVE, participant.getStatus());
        assertNull(participant.getWithdrawalReason());
        assertNull(participant.getWithdrawnAt());
        assertNull(participant.getWithdrawnByUserId());
        assertNull(participant.getWithdrawalCancelledVisitCount());

        participant.withdraw("Motivo", STORED_TIME, 9L, 0);
        assertThrows(IllegalStateException.class, () -> participant.withdraw("Outro", STORED_TIME, 9L, 0));
        assertEquals("Motivo", participant.getWithdrawalReason());
    }

    private Participant activeParticipant() {
        Participant participant = new Participant(3L, 7L, 9L, STORED_TIME);
        ReflectionTestUtils.setField(participant, "id", 12L);
        return participant;
    }

    private void assertNoWithdrawalWrite() {
        verifyNoInteractions(withdrawalVisits, currentActor);
        verify(repository, never()).saveAndFlush(any(Participant.class));
    }

    private void prepareInclusion(StudyStatus state) {
        when(studyService.lockForCandidateOperations(3L)).thenReturn(study(state));
        when(candidateService.lockForConsentUpdate(3L, 7L)).thenReturn(candidate);
    }

    private Study study(StudyStatus state) {
        Study study = new Study("Estudo", "Objetivo", 11L,
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 2);
        if (state != StudyStatus.PLANNING) {
            study.advanceStatus(StudyStatus.RECRUITMENT);
        }
        if (state == StudyStatus.EXECUTION || state == StudyStatus.CLOSED) {
            study.advanceStatus(StudyStatus.EXECUTION);
        }
        if (state == StudyStatus.CLOSED || state == StudyStatus.CANCELLED) {
            study.advanceStatus(state);
        }
        return study;
    }

    private void assertNoWrite() {
        verify(repository, never()).saveAndFlush(any(Participant.class));
        verifyNoInteractions(consentService, currentActor);
    }
}
