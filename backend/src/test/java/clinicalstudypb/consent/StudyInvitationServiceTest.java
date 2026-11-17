package clinicalstudypb.consent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import clinicalstudypb.candidates.application.CandidateService;
import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.CandidateConflictException;
import clinicalstudypb.candidates.domain.CandidateStatus;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.consent.api.StudyInvitationResponse;
import clinicalstudypb.consent.api.StudyInvitationSummaryResponse;
import clinicalstudypb.consent.application.SimulatedConsentService;
import clinicalstudypb.consent.application.StudyInvitationService;
import clinicalstudypb.consent.domain.ConsentConflictException;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.consent.domain.ConsentStatus;
import clinicalstudypb.consent.domain.SimulatedConsent;
import clinicalstudypb.consent.domain.StudyInvitationFilterStatus;
import clinicalstudypb.consent.infrastructure.SimulatedConsentRepository;
import clinicalstudypb.participants.application.ParticipantLookup;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import clinicalstudypb.visits.api.PlannedActivityResponse;
import clinicalstudypb.visits.api.PlannedVisitResponse;
import clinicalstudypb.visits.application.PlannedVisitLookup;
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

/**
 * Exercita regras unitárias de decisão única, filtragem e visibilidade de convites de estudo.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-17
 * @version 0.0.1
 */
@ExtendWith(MockitoExtension.class)
class StudyInvitationServiceTest {

    @Mock private CandidateService candidateService;
    @Mock private StudyService studyService;
    @Mock private SimulatedConsentRepository consentRepository;
    @Mock private ParticipantLookup participantLookup;
    @Mock private UserService userService;
    @Mock private PlannedVisitLookup plannedVisitLookup;
    @Mock private CurrentActor currentActor;

    private SimulatedConsentService consentService;
    private StudyInvitationService invitationService;

    @BeforeEach
    void setUp() {
        consentService = new SimulatedConsentService(
                candidateService, studyService, consentRepository, participantLookup, userService, currentActor);
        invitationService = new StudyInvitationService(
                candidateService, studyService, userService, plannedVisitLookup,
                consentRepository, consentService, currentActor);
    }

    @Test
    void decidePersistsAuthorAndReturnsProtocolAndSimulatedTerm() {
        User participant = user(10L, UserRole.PARTICIPANT, true);
        User researcher = user(20L, UserRole.RESEARCHER, true);
        Candidate candidate = candidate(5L, 3L, 10L, EligibilityStatus.ELIGIBLE);
        Study study = study(3L, 20L, StudyStatus.RECRUITMENT);
        List<PlannedVisitResponse> visits = List.of(new PlannedVisitResponse(
                1L, 3L, "Triagem", LocalDate.of(2027, 2, 1), 1,
                List.of(new PlannedActivityResponse(2L, "Entrevista", "Anamnese", 1))));

        when(currentActor.userId()).thenReturn(10L);
        when(candidateService.getByIdAndUser(5L, 10L)).thenReturn(candidate);
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study);
        when(candidateService.lockForConsentUpdate(3L, 5L)).thenReturn(candidate);
        when(participantLookup.isIncluded(3L, 5L)).thenReturn(false);
        when(consentRepository.existsById(5L)).thenReturn(false);
        when(userService.getUser(10L)).thenReturn(participant);
        when(consentRepository.saveAndFlush(any(SimulatedConsent.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(userService.getUser(20L)).thenReturn(researcher);
        when(plannedVisitLookup.findByStudy(3L)).thenReturn(visits);

        StudyInvitationResponse response = invitationService.decide(5L, ConsentDecision.GRANTED);

        assertEquals(CandidateStatus.GRANTED, response.status());
        assertEquals("Pesquisadora", response.responsibleName());
        assertEquals(visits, response.plannedVisits());
        assertTrue(response.termText().contains("fictício"));
    }

    @Test
    void cancelledCandidacyTakesPriorityOverConsentNotAvailable() {
        Candidate candidate = candidate(5L, 3L, 10L, EligibilityStatus.PENDING);
        candidate.cancel("Desistência", Instant.now(), 99L);
        when(currentActor.userId()).thenReturn(10L);
        when(candidateService.getByIdAndUser(5L, 10L)).thenReturn(candidate);
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(3L, 20L, StudyStatus.EXECUTION));
        when(candidateService.lockForConsentUpdate(3L, 5L)).thenReturn(candidate);

        CandidateConflictException thrown = assertThrows(CandidateConflictException.class,
                () -> consentService.decide(5L, ConsentDecision.GRANTED));

        assertEquals("CANDIDATE_CANCELLED", thrown.getCode());
        verify(consentRepository, never()).saveAndFlush(any());
    }

    @Test
    void decideRejectsIncludedAlreadyDecidedPendingEligibilityAndClosedStudyInContractOrder() {
        Candidate candidate = candidate(5L, 3L, 10L, EligibilityStatus.PENDING);
        when(currentActor.userId()).thenReturn(10L);
        when(candidateService.getByIdAndUser(5L, 10L)).thenReturn(candidate);
        when(studyService.lockForCandidateRegistration(3L)).thenReturn(study(3L, 20L, StudyStatus.EXECUTION));
        when(candidateService.lockForConsentUpdate(3L, 5L)).thenReturn(candidate);

        when(participantLookup.isIncluded(3L, 5L)).thenReturn(true);
        assertEquals(ConsentConflictException.CONSENT_NOT_AVAILABLE, assertThrows(
                ConsentConflictException.class,
                () -> consentService.decide(5L, ConsentDecision.GRANTED)).getCode());

        when(participantLookup.isIncluded(3L, 5L)).thenReturn(false);
        when(consentRepository.existsById(5L)).thenReturn(true);
        assertEquals(ConsentConflictException.CONSENT_ALREADY_DECIDED, assertThrows(
                ConsentConflictException.class,
                () -> consentService.decide(5L, ConsentDecision.GRANTED)).getCode());

        when(consentRepository.existsById(5L)).thenReturn(false);
        when(userService.getUser(10L)).thenReturn(user(10L, UserRole.PARTICIPANT, true));
        assertEquals(ConsentConflictException.CONSENT_NOT_AVAILABLE, assertThrows(
                ConsentConflictException.class,
                () -> consentService.decide(5L, ConsentDecision.GRANTED)).getCode());

        candidate.updateEligibilityStatus(EligibilityStatus.ELIGIBLE);
        assertEquals(ConsentConflictException.STUDY_NOT_RECRUITING, assertThrows(
                ConsentConflictException.class,
                () -> consentService.decide(5L, ConsentDecision.GRANTED)).getCode());
    }

    @Test
    void listAndGetOnlyExposeVisibleInvitationStatuses() {
        Candidate visiblePending = candidate(11L, 3L, 10L, EligibilityStatus.ELIGIBLE);
        Candidate hiddenIncluded = candidate(12L, 3L, 10L, EligibilityStatus.ELIGIBLE);
        Candidate hiddenInvited = candidate(13L, 3L, 10L, EligibilityStatus.ELIGIBLE);
        Candidate visibleDeclined = candidate(14L, 3L, 10L, EligibilityStatus.ELIGIBLE);
        Study study = study(3L, 20L, StudyStatus.RECRUITMENT);
        Instant decidedAt = Instant.parse("2026-11-17T12:00:00Z");

        when(currentActor.userId()).thenReturn(10L);
        when(candidateService.listByUser(10L)).thenReturn(
                List.of(visibleDeclined, hiddenInvited, hiddenIncluded, visiblePending));
        when(candidateService.snapshot(visibleDeclined, null)).thenReturn(new CandidateService.Snapshot(
                visibleDeclined, CandidateStatus.DECLINED, ConsentStatus.DECLINED, null, null));
        when(candidateService.snapshot(hiddenInvited, null)).thenReturn(new CandidateService.Snapshot(
                hiddenInvited, CandidateStatus.INVITED, ConsentStatus.PENDING, null, null));
        when(candidateService.snapshot(hiddenIncluded, null)).thenReturn(new CandidateService.Snapshot(
                hiddenIncluded, CandidateStatus.INCLUDED, ConsentStatus.GRANTED, null, null));
        when(candidateService.snapshot(visiblePending, null)).thenReturn(new CandidateService.Snapshot(
                visiblePending, CandidateStatus.CONSENT_PENDING, ConsentStatus.PENDING, null, null));
        when(studyService.getStudy(3L)).thenReturn(study);
        when(consentRepository.findById(14L)).thenReturn(
                Optional.of(new SimulatedConsent(14L, ConsentDecision.DECLINED, decidedAt, 10L)));

        List<StudyInvitationSummaryResponse> all = invitationService.list(null);
        assertEquals(2, all.size());
        assertEquals(14L, all.get(0).candidateId());
        assertEquals(decidedAt, all.get(0).decidedAt());
        assertEquals(11L, all.get(1).candidateId());
        assertNull(all.get(1).decidedAt());

        List<StudyInvitationSummaryResponse> filtered = invitationService.list(
                StudyInvitationFilterStatus.CONSENT_PENDING);
        assertEquals(1, filtered.size());
        assertEquals(11L, filtered.get(0).candidateId());

        when(candidateService.getByIdAndUser(12L, 10L)).thenReturn(hiddenIncluded);
        assertThrows(ResourceNotFoundException.class, () -> invitationService.get(12L));
    }

    private Candidate candidate(Long id, Long studyId, Long userId, EligibilityStatus eligibility) {
        Candidate c = new Candidate(studyId, "Participante", "participante", 30,
                "p@test.local", "83999990000", userId);
        ReflectionTestUtils.setField(c, "id", id);
        if (eligibility != EligibilityStatus.PENDING) {
            c.updateEligibilityStatus(eligibility);
        }
        return c;
    }

    private User user(Long id, UserRole role, boolean active) {
        String name = role == UserRole.RESEARCHER ? "Pesquisadora" : "Participante";
        User u = active ? new User(name, id + "@test.local", "{bcrypt}hash", role)
                : User.invitedParticipant(name, id + "@test.local", "{bcrypt}hash");
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    private Study study(Long id, Long responsibleUserId, StudyStatus status) {
        Study s = new Study("Estudo", "Objetivo", responsibleUserId,
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 20);
        ReflectionTestUtils.setField(s, "id", id);
        if (status != StudyStatus.PLANNING) {
            s.advanceStatus(StudyStatus.RECRUITMENT);
            if (status == StudyStatus.EXECUTION) {
                s.advanceStatus(StudyStatus.EXECUTION);
            }
        }
        return s;
    }
}
