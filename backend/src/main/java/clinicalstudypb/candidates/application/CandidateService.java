package clinicalstudypb.candidates.application;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.CandidateActivationInvite;
import clinicalstudypb.candidates.domain.CandidateConflictException;
import clinicalstudypb.candidates.domain.CandidateStatus;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.candidates.domain.InvalidCandidateException;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.consent.domain.ConsentStatus;
import clinicalstudypb.consent.infrastructure.SimulatedConsentRepository;
import clinicalstudypb.participants.infrastructure.ParticipantRepository;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\+?[0-9 ()-]{8,20}$");
    private static final int MIN_PHONE_LENGTH = 8;
    private static final int MAX_PHONE_LENGTH = 20;
    private static final int MIN_PHONE_DIGITS = 8;
    private static final int MAX_CANCELLATION_REASON_LENGTH = 500;

    private final CandidateRepository candidateRepository;
    private final StudyService studyService;
    private final UserService userService;
    private final CandidateInvitationService invitationService;
    private final SimulatedConsentRepository consentRepository;
    private final ParticipantRepository participantRepository;
    private final CurrentActor currentActor;

    /** Recebe os repositórios e serviços necessários para o ciclo de vida da candidatura. */
    public CandidateService(CandidateRepository candidateRepository, StudyService studyService,
                            UserService userService, CandidateInvitationService invitationService,
                            SimulatedConsentRepository consentRepository, ParticipantRepository participantRepository,
                            CurrentActor currentActor) {
        this.candidateRepository = candidateRepository;
        this.studyService = studyService;
        this.userService = userService;
        this.invitationService = invitationService;
        this.consentRepository = consentRepository;
        this.participantRepository = participantRepository;
        this.currentActor = currentActor;
    }

    /** Cadastra e vincula a conta numa única transação, emitindo convite quando necessário. */
    @Transactional
    public Registration create(Long studyId, String name, Integer age, String email, String phone) {
        String normalizedPhone = normalizePhone(phone);
        requireRecruitment(studyId);
        String displayName = normalizeDisplayName(name);
        String normalizedEmail = email.strip().toLowerCase(Locale.ROOT);
        User user = userService.findLockedByEmail(normalizedEmail).orElse(null);
        if (user != null && user.getRole() != UserRole.PARTICIPANT) {
            throw new CandidateConflictException("EMAIL_BELONGS_TO_STAFF", "O e-mail pertence à equipe.");
        }
        if (user != null && candidateRepository.existsByStudyIdAndUserIdAndCancelledAtIsNull(studyId, user.getId())) {
            throw new CandidateConflictException("CANDIDATE_ALREADY_IN_STUDY",
                    "O candidato já está cadastrado no estudo.");
        }
        if (user != null && (!user.isActive() || user.isActivationPending())) {
            Optional<CandidateActivationInvite> invitation = invitationService.find(user.getId());
            if (!user.isActivationPending()
                    || (invitation.isPresent() && invitation.get().getUsedAt() != null)) {
                throw new CandidateConflictException("PARTICIPANT_ACCOUNT_DEACTIVATED", "Conta desativada.");
            }
        }
        if (user == null) {
            user = userService.createInvitedParticipant(displayName, normalizedEmail);
        }

        Candidate candidate = new Candidate(studyId, displayName, normalizeNameKey(displayName),
                age, normalizedEmail, normalizedPhone, user.getId());
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
        if (candidate.isCancelled()) {
            throw new CandidateConflictException("CANDIDATE_CANCELLED", "A candidatura foi cancelada.");
        }
        User user = lockUser(candidate.getUserId());
        if (user.isActive() && !user.isActivationPending()) {
            throw new CandidateConflictException("CANDIDATE_ALREADY_ACTIVE", "Conta já ativada.");
        }
        requirePendingActivation(user);
        return invitationService.issue(user.getId());
    }

    /** Lista candidatos não cancelados do estudo existente, na ordem de cadastro. */
    @Transactional(readOnly = true)
    public List<Candidate> list(Long studyId) {
        return list(studyId, false);
    }

    /** Lista candidatos do estudo existente, podendo incluir os cancelados. */
    @Transactional(readOnly = true)
    public List<Candidate> list(Long studyId, boolean includeCancelled) {
        studyService.getStudy(studyId);
        if (includeCancelled) {
            return candidateRepository.findAllByStudyIdOrderByIdAsc(studyId);
        }
        return candidateRepository.findAllByStudyIdAndCancelledAtIsNullOrderByIdAsc(studyId);
    }

    /**
     * Cancela a candidatura antes da inclusão, preservando avaliação e consentimento
     * e invalidando o convite pendente quando a conta não possui outra candidatura ativa.
     */
    @Transactional
    public Candidate cancel(Long studyId, Long candidateId, String reason) {
        String normalizedReason = normalizeCancellationReason(reason);
        Study study = studyService.lockForCandidateRegistration(studyId);
        Candidate candidate = candidateRepository.findForConsentUpdate(candidateId, studyId)
                .orElseThrow(() -> new ResourceNotFoundException("Candidato não encontrado: " + candidateId));
        if (study.getStatus() != StudyStatus.RECRUITMENT) {
            throw new CandidateConflictException("STUDY_NOT_RECRUITING", "O estudo não está em recrutamento.");
        }
        if (candidate.isCancelled()) {
            throw new CandidateConflictException("CANDIDATE_ALREADY_CANCELLED", "A candidatura já foi cancelada.");
        }
        if (participantRepository.existsByStudyIdAndCandidateId(studyId, candidateId)) {
            throw new CandidateConflictException("CANDIDATE_ALREADY_INCLUDED",
                    "Não é possível cancelar um candidato já incluído como participante.");
        }
        candidate.cancel(normalizedReason, Instant.now().truncatedTo(ChronoUnit.MICROS), currentActor.userId());
        Candidate saved = candidateRepository.saveAndFlush(candidate);
        User user = lockUser(candidate.getUserId());
        if (user.isActivationPending()
                && !candidateRepository.existsByUserIdAndCancelledAtIsNull(user.getId())) {
            invitationService.invalidate(user.getId());
        }
        return saved;
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
        if (candidate.isCancelled()) {
            status = CandidateStatus.CANCELLED;
        } else if (included) {
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

    private User lockUser(Long userId) {
        return userService.findLockedById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado: " + userId));
    }

    private String normalizePhone(String phone) {
        if (phone == null) {
            throw new InvalidCandidateException("Informe um telefone válido com 8 a 20 caracteres e DDD.");
        }
        String trimmed = phone.strip();
        long digits = trimmed.chars().filter(Character::isDigit).count();
        if (trimmed.length() < MIN_PHONE_LENGTH || trimmed.length() > MAX_PHONE_LENGTH
                || digits < MIN_PHONE_DIGITS || !PHONE_PATTERN.matcher(trimmed).matches()) {
            throw new InvalidCandidateException("Informe um telefone válido com 8 a 20 caracteres e DDD.");
        }
        return trimmed;
    }

    private String normalizeCancellationReason(String reason) {
        if (reason == null) {
            throw new InvalidCandidateException("Informe o motivo do cancelamento com 1 a 500 caracteres.");
        }
        String trimmed = reason.strip();
        if (trimmed.isEmpty() || trimmed.length() > MAX_CANCELLATION_REASON_LENGTH) {
            throw new InvalidCandidateException("Informe o motivo do cancelamento com 1 a 500 caracteres.");
        }
        return trimmed;
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
