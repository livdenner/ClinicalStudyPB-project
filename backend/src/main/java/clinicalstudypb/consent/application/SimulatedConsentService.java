package clinicalstudypb.consent.application;

import clinicalstudypb.candidates.application.CandidateService;
import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.CandidateConflictException;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.consent.domain.ConsentConflictException;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.consent.domain.SimulatedConsent;
import clinicalstudypb.consent.infrastructure.SimulatedConsentRepository;
import clinicalstudypb.participants.application.ParticipantLookup;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.User;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Consulta e registra decisões simuladas de consentimento para candidatos.
 *
 * @author Lucas N. de Araújo
 * @author Lívia
 * @since 2026-11-07
 * @version 0.0.2
 */
@Service
public class SimulatedConsentService {
    private final CandidateService candidateService;
    private final StudyService studyService;
    private final SimulatedConsentRepository consentRepository;
    private final ParticipantLookup participantLookup;
    private final UserService userService;
    private final CurrentActor currentActor;

    /**
     * Recebe os serviços públicos e o repositório do módulo.
     *
     * @param candidateService consulta e bloqueio de candidatos
     * @param studyService consulta e bloqueio de estudos
     * @param consentRepository persistência da decisão
     * @param participantLookup verificação pública de inclusão
     * @param userService consulta da situação da conta participante
     * @param currentActor usuário autenticado na requisição
     */
    public SimulatedConsentService(CandidateService candidateService,
                                   StudyService studyService,
                                   SimulatedConsentRepository consentRepository,
                                   ParticipantLookup participantLookup,
                                   UserService userService,
                                   CurrentActor currentActor) {
        this.candidateService = candidateService;
        this.studyService = studyService;
        this.consentRepository = consentRepository;
        this.participantLookup = participantLookup;
        this.userService = userService;
        this.currentActor = currentActor;
    }

    /**
     * Consulta a decisão após conferir que o candidato pertence ao estudo.
     *
     * @param studyId identificador do estudo
     * @param candidateId identificador do candidato
     * @return decisão registrada ou vazio quando ainda está pendente
     */
    @Transactional(readOnly = true)
    public Optional<SimulatedConsent> get(Long studyId, Long candidateId) {
        candidateService.get(studyId, candidateId);
        return consentRepository.findById(candidateId);
    }

    /**
     * Registra uma única vez a decisão do próprio candidato autenticado.
     *
     * @param candidateId identificador da candidatura pertencente ao usuário autenticado
     * @param decision decisão simulada escolhida pelo candidato
     * @return candidatura, estudo e consentimento persistido
     */
    @Transactional
    public DecisionResult decide(Long candidateId, ConsentDecision decision) {
        Long actorUserId = Objects.requireNonNull(
                currentActor.userId(), "A conta participante autenticada é obrigatória.");
        Candidate owner = candidateService.getByIdAndUser(candidateId, actorUserId);
        Study study = studyService.lockForCandidateRegistration(owner.getStudyId());
        Candidate candidate = candidateService.lockForConsentUpdate(study.getId(), candidateId);
        if (candidate.isCancelled()) {
            throw new CandidateConflictException("CANDIDATE_CANCELLED",
                    "Não é possível registrar consentimento de uma candidatura cancelada.");
        }
        if (participantLookup.isIncluded(study.getId(), candidateId)) {
            throw new ConsentConflictException(ConsentConflictException.CONSENT_NOT_AVAILABLE,
                    "O candidato já foi incluído e não pode registrar consentimento.");
        }
        if (consentRepository.existsById(candidateId)) {
            throw new ConsentConflictException(ConsentConflictException.CONSENT_ALREADY_DECIDED,
                    "A decisão de consentimento já foi registrada.");
        }
        User account = userService.getUser(actorUserId);
        if (candidate.getEligibilityStatus() != EligibilityStatus.ELIGIBLE
                || !account.isActive() || account.isActivationPending()) {
            throw new ConsentConflictException(ConsentConflictException.CONSENT_NOT_AVAILABLE,
                    "O consentimento exige elegibilidade concluída como ELIGIBLE e conta ativa.");
        }
        if (study.getStatus() != StudyStatus.RECRUITMENT) {
            throw new ConsentConflictException(ConsentConflictException.STUDY_NOT_RECRUITING,
                    "O consentimento só pode ser decidido durante o recrutamento.");
        }
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        SimulatedConsent saved = consentRepository.saveAndFlush(
                new SimulatedConsent(candidateId, decision, now, actorUserId));
        return new DecisionResult(candidate, study, saved);
    }

    /**
     * Bloqueia alterações posteriores à inclusão. O serviço de participantes chama
     * este método na mesma transação que grava o vínculo, antes de confirmar a inclusão.
     *
     * @param studyId identificador do estudo
     * @param candidateId identificador do candidato
     */
    @Transactional
    public void lockAfterInclusion(Long studyId, Long candidateId) {
        studyService.lockForCandidateRegistration(studyId);
        candidateService.lockForConsentUpdate(studyId, candidateId);
        SimulatedConsent consent = consentRepository.findById(candidateId)
                .orElseThrow(() -> new ConsentConflictException("A inclusão exige consentimento concedido."));
        consent.lockAfterInclusion();
        consentRepository.saveAndFlush(consent);
    }

    /**
     * Resultado transacional da decisão registrada pelo candidato autenticado.
     *
     * @param candidate candidatura atualizada
     * @param study estudo em recrutamento
     * @param consent consentimento persistido com autoria e instante
     */
    public record DecisionResult(Candidate candidate, Study study, SimulatedConsent consent) {
    }
}
