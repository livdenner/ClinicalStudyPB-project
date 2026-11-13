package clinicalstudypb.candidates.application;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.CandidateActivationInvite;
import clinicalstudypb.candidates.domain.CandidateConflictException;
import clinicalstudypb.candidates.domain.CandidateStatus;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.consent.domain.ConsentStatus;
import clinicalstudypb.consent.infrastructure.SimulatedConsentRepository;
import clinicalstudypb.participants.infrastructure.ParticipantRepository;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Coordena o cadastro de candidatos e o vínculo com contas de participantes. */
@Service
public class CandidateService {

    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private final CandidateRepository candidateRepository;
    private final StudyService studyService;
    private final UserService userService;
    private final CandidateInvitationService invitationService;
    private final SimulatedConsentRepository consentRepository;
    private final ParticipantRepository participantRepository;

    public CandidateService(CandidateRepository candidateRepository, StudyService studyService,
                            UserService userService, CandidateInvitationService invitationService,
                            SimulatedConsentRepository consentRepository, ParticipantRepository participantRepository) {
        this.candidateRepository = candidateRepository;
        this.studyService = studyService;
        this.userService = userService;
        this.invitationService = invitationService;
        this.consentRepository = consentRepository;
        this.participantRepository = participantRepository;
    }

    /** Cadastra e vincula a conta numa única transação, emitindo convite quando necessário. */
    @Transactional
    public Registration create(Long studyId, String name, Integer age, String email, String phone) {
        requireRecruitment(studyId);
        String displayName = normalizeDisplayName(name);
        String normalizedEmail = email.strip().toLowerCase(Locale.ROOT);
        User user = userService.findLockedByEmail(normalizedEmail).orElse(null);
        if (user != null && user.getRole() != UserRole.PARTICIPANT) {
            throw new CandidateConflictException("EMAIL_BELONGS_TO_STAFF", "O e-mail pertence à equipe.");
        }
        if (user != null && candidateRepository.existsByStudyIdAndUserId(studyId, user.getId())) {
            throw new CandidateConflictException("CANDIDATE_ALREADY_IN_STUDY",
                    "O candidato já está cadastrado no estudo.");
        }
        if (user != null && (!user.isActive() || user.isActivationPending())) {
            requirePendingActivation(user);
        }
        if (user == null) {
            user = userService.createInvitedParticipant(displayName, normalizedEmail);
        }

        Candidate candidate = new Candidate(studyId, displayName, normalizeNameKey(displayName),
                age, normalizedEmail, phone.strip(), user.getId());
        candidate = candidateRepository.saveAndFlush(candidate);
        CandidateInvitationService.IssuedCode code = user.isActivationPending()
                ? invitationService.issue(user.getId()) : null;
        return new Registration(candidate, code);
    }

    /** Gera novo código para uma conta convidada, sem recriar candidato ou usuário. */
    @Transactional
    public CandidateInvitationService.IssuedCode reissue(Long studyId, Long candidateId) {
        requireRecruitment(studyId);
        Candidate candidate = candidateRepository.findForConsentUpdate(candidateId, studyId)
                .orElseThrow(() -> new ResourceNotFoundException("Candidato não encontrado: " + candidateId));
        User user = userService.findLockedById(candidate.getUserId()).orElseThrow(
                () -> new ResourceNotFoundException("Usuário não encontrado: " + candidate.getUserId()));
        if (user.isActive() && !user.isActivationPending()) {
            throw new CandidateConflictException("CANDIDATE_ALREADY_ACTIVE", "Conta já ativada.");
        }
        requirePendingActivation(user);
        return invitationService.issue(user.getId());
    }

    /** Lista candidatos do estudo existente, na ordem de cadastro. */
    @Transactional(readOnly = true)
    public List<Candidate> list(Long studyId) {
        studyService.getStudy(studyId);
        return candidateRepository.findAllByStudyIdOrderByIdAsc(studyId);
    }

    /** Consulta um candidato somente no estudo indicado. */
    @Transactional(readOnly = true)
    public Candidate get(Long studyId, Long candidateId) {
        studyService.getStudy(studyId);
        return candidateRepository.findByIdAndStudyId(candidateId, studyId)
                .orElseThrow(() -> new ResourceNotFoundException("Candidato não encontrado: " + candidateId));
    }

    /** Bloqueia candidato durante atualização do consentimento ou inclusão. */
    @Transactional
    public Candidate lockForConsentUpdate(Long studyId, Long candidateId) {
        studyService.getStudy(studyId);
        return candidateRepository.findForConsentUpdate(candidateId, studyId)
                .orElseThrow(() -> new ResourceNotFoundException("Candidato não encontrado: " + candidateId));
    }

    /** Monta o estado público atual; somente o código recém-emitido pode ser incluído. */
    @Transactional(readOnly = true)
    public Snapshot snapshot(Candidate candidate, CandidateInvitationService.IssuedCode issued) {
        User user = userService.getUser(candidate.getUserId());
        Optional<CandidateActivationInvite> invite = invitationService.find(user.getId());
        ConsentStatus consent = consentRepository.findById(candidate.getId())
                .map(saved -> ConsentStatus.valueOf(saved.getStatus().name())).orElse(ConsentStatus.PENDING);
        boolean included = participantRepository.existsByStudyIdAndCandidateId(
                candidate.getStudyId(), candidate.getId());
        CandidateStatus status;
        if (included) {
            status = CandidateStatus.INCLUDED;
        } else if (user.isActivationPending()) {
            status = CandidateStatus.INVITED;
        } else if (consent == ConsentStatus.GRANTED) {
            status = CandidateStatus.GRANTED;
        } else if (consent == ConsentStatus.DECLINED) {
            status = CandidateStatus.DECLINED;
        } else if (candidate.getEligibilityStatus() == EligibilityStatus.ELIGIBLE) {
            status = CandidateStatus.CONSENT_PENDING;
        } else {
            status = CandidateStatus.ACTIVE;
        }
        return new Snapshot(candidate, status, consent, invite.orElse(null), issued);
    }

    private void requirePendingActivation(User user) {
        Optional<CandidateActivationInvite> invitation = invitationService.find(user.getId());
        if (!user.isActivationPending() || invitation.isEmpty() || invitation.get().getUsedAt() != null) {
            throw new CandidateConflictException("PARTICIPANT_ACCOUNT_DEACTIVATED", "Conta desativada.");
        }
    }

    private void requireRecruitment(Long studyId) {
        Study study = studyService.lockForCandidateRegistration(studyId);
        if (study.getStatus() != StudyStatus.RECRUITMENT) {
            throw new CandidateConflictException("STUDY_NOT_RECRUITING", "O estudo não está em recrutamento.");
        }
    }

    private String normalizeDisplayName(String name) {
        return WHITESPACE.matcher(name.strip()).replaceAll(" ");
    }

    private String normalizeNameKey(String name) {
        return name.toLowerCase(Locale.ROOT);
    }

    /** Resultado interno do cadastro, incluindo código somente quando gerado. */
    public record Registration(Candidate candidate, CandidateInvitationService.IssuedCode issued) {
        @Override
        public String toString() {
            return "Registration[candidate=" + candidate.getId() + ", issued=redacted]";
        }
    }

    /** Dados usados para montar a resposta sem expor hash ou senha. */
    public record Snapshot(Candidate candidate, CandidateStatus status, ConsentStatus consent,
                           CandidateActivationInvite invitation, CandidateInvitationService.IssuedCode issued) {
    }
}
