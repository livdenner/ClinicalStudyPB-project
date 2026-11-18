package clinicalstudypb.consent.application;

import clinicalstudypb.candidates.application.CandidateService;
import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.CandidateStatus;
import clinicalstudypb.consent.api.StudyInvitationResponse;
import clinicalstudypb.consent.api.StudyInvitationSummaryResponse;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.consent.domain.SimulatedConsent;
import clinicalstudypb.consent.domain.StudyInvitationFilterStatus;
import clinicalstudypb.consent.infrastructure.SimulatedConsentRepository;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.visits.api.PlannedVisitResponse;
import clinicalstudypb.visits.application.PlannedVisitLookup;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Regras de consulta aos convites de estudo do candidato autenticado e delegação da decisão.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-17
 * @version 0.0.1
 */
@Service
public class StudyInvitationService {

    /** Texto fixo do termo simulado apresentado ao candidato antes do aceite ou recusa. */
    static final String SIMULATED_TERM_TEXT =
            "Termo de consentimento simulado para demonstração acadêmica do ClinicalStudyPB. "
            + "Este documento é fictício, não possui valor legal e nenhum dado pessoal ou clínico real é coletado.";

    private static final EnumSet<CandidateStatus> VISIBLE_INVITATION_STATUSES = EnumSet.of(
            CandidateStatus.CONSENT_PENDING,
            CandidateStatus.GRANTED,
            CandidateStatus.DECLINED);

    private final CandidateService candidateService;
    private final StudyService studyService;
    private final UserService userService;
    private final PlannedVisitLookup plannedVisitLookup;
    private final SimulatedConsentRepository consentRepository;
    private final SimulatedConsentService consentService;
    private final CurrentActor currentActor;

    /**
     * Recebe as dependências de candidatura, estudos, protocolo e consentimento.
     *
     * @param candidateService consulta de candidaturas da conta autenticada
     * @param studyService consulta de estudos clínicos
     * @param userService consulta do pesquisador responsável
     * @param plannedVisitLookup consulta pública das visitas previstas do protocolo
     * @param consentRepository leitura do instante de consentimento persistido
     * @param consentService registro transacional da decisão única
     * @param currentActor resolvedor da conta participante autenticada
     */
    public StudyInvitationService(CandidateService candidateService,
                                  StudyService studyService,
                                  UserService userService,
                                  PlannedVisitLookup plannedVisitLookup,
                                  SimulatedConsentRepository consentRepository,
                                  SimulatedConsentService consentService,
                                  CurrentActor currentActor) {
        this.candidateService = candidateService;
        this.studyService = studyService;
        this.userService = userService;
        this.plannedVisitLookup = plannedVisitLookup;
        this.consentRepository = consentRepository;
        this.consentService = consentService;
        this.currentActor = currentActor;
    }

    /**
     * Lista os convites visíveis da conta participante, da candidatura mais recente para a mais antiga.
     *
     * @param statusFilter filtro opcional por situação do convite
     * @return lista de convites elegíveis para exibição no aplicativo
     */
    @Transactional(readOnly = true)
    public List<StudyInvitationSummaryResponse> list(StudyInvitationFilterStatus statusFilter) {
        Long actorUserId = currentActor.userId();
        CandidateStatus targetStatus = statusFilter == null ? null : statusFilter.toCandidateStatus();
        return candidateService.listByUser(actorUserId).stream()
                .map(candidate -> candidateService.snapshot(candidate, null))
                .filter(snapshot -> VISIBLE_INVITATION_STATUSES.contains(snapshot.status()))
                .filter(snapshot -> targetStatus == null || snapshot.status() == targetStatus)
                .map(this::toSummaryResponse)
                .toList();
    }

    /**
     * Consulta o detalhe de um convite específico pertencente à conta participante autenticada.
     *
     * @param candidateId identificador da candidatura
     * @return detalhes completos do estudo, protocolo, termo simulado e decisão
     */
    @Transactional(readOnly = true)
    public StudyInvitationResponse get(Long candidateId) {
        Candidate candidate = candidateService.getByIdAndUser(candidateId, currentActor.userId());
        CandidateService.Snapshot snapshot = candidateService.snapshot(candidate, null);
        if (!VISIBLE_INVITATION_STATUSES.contains(snapshot.status())) {
            throw new ResourceNotFoundException("Convite não encontrado: " + candidateId);
        }
        Study study = studyService.getStudy(candidate.getStudyId());
        Instant decidedAt = resolveDecidedAt(candidate.getId(), snapshot.status());
        return toInvitationResponse(candidate, study, snapshot.status(), decidedAt);
    }

    /**
     * Registra o aceite ou recusa do candidato autenticado e devolve o convite atualizado.
     *
     * @param candidateId identificador da candidatura
     * @param decision decisão escolhida ({@code GRANTED} ou {@code DECLINED})
     * @return detalhe atualizado do convite com situação e instante gravados
     */
    @Transactional
    public StudyInvitationResponse decide(Long candidateId, ConsentDecision decision) {
        SimulatedConsentService.DecisionResult result = consentService.decide(candidateId, decision);
        CandidateStatus status = decision == ConsentDecision.GRANTED
                ? CandidateStatus.GRANTED
                : CandidateStatus.DECLINED;
        return toInvitationResponse(
                result.candidate(),
                result.study(),
                status,
                result.consent().getRecordedAt());
    }

    private StudyInvitationSummaryResponse toSummaryResponse(CandidateService.Snapshot snapshot) {
        Candidate candidate = snapshot.candidate();
        Study study = studyService.getStudy(candidate.getStudyId());
        Instant decidedAt = resolveDecidedAt(candidate.getId(), snapshot.status());
        return new StudyInvitationSummaryResponse(
                candidate.getId(),
                study.getId(),
                study.getTitle(),
                snapshot.status(),
                decidedAt);
    }

    private StudyInvitationResponse toInvitationResponse(Candidate candidate,
                                                       Study study,
                                                       CandidateStatus status,
                                                       Instant decidedAt) {
        String responsibleName = userService.getUser(study.getResponsibleUserId()).getName();
        List<PlannedVisitResponse> plannedVisits = plannedVisitLookup.findByStudy(study.getId());
        return new StudyInvitationResponse(
                candidate.getId(),
                study.getId(),
                study.getTitle(),
                study.getObjective(),
                study.getStartDate(),
                study.getEndDate(),
                responsibleName,
                plannedVisits,
                SIMULATED_TERM_TEXT,
                status,
                decidedAt);
    }

    private Instant resolveDecidedAt(Long candidateId, CandidateStatus status) {
        if (status == CandidateStatus.CONSENT_PENDING) {
            return null;
        }
        return consentRepository.findById(candidateId)
                .map(SimulatedConsent::getRecordedAt)
                .orElse(null);
    }
}
