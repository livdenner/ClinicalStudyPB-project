package clinicalstudypb.participants.application;

import clinicalstudypb.candidates.application.CandidateService;
import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.CandidateConflictException;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.consent.application.SimulatedConsentService;
import clinicalstudypb.participants.domain.InclusionConflictException;
import clinicalstudypb.participants.domain.Participant;
import clinicalstudypb.participants.infrastructure.ParticipantRepository;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Inclui candidatos atomicamente sob o mesmo bloqueio das transições do estudo.
 * Consulta os módulos relacionados exclusivamente por seus serviços públicos.
 *
 * @author Lívia
 * @since 2026-11-09
 * @version 0.0.1
 */
@Service
public class ParticipantService {

    private final ParticipantRepository participantRepository;
    private final StudyService studyService;
    private final CandidateService candidateService;
    private final SimulatedConsentService consentService;
    private final CurrentActor currentActor;
    private final Clock clock;

    /**
     * Recebe a persistência própria e os serviços públicos das dependências.
     *
     * @param participantRepository persistência interna de participantes
     * @param studyService consulta e bloqueio públicos de estudos
     * @param candidateService consulta e bloqueio públicos de candidatos
     * @param consentService validação e bloqueio público do consentimento concedido
     * @param currentActor autor autenticado da inclusão
     * @param clock relógio UTC substituível em testes
     */
    public ParticipantService(ParticipantRepository participantRepository, StudyService studyService,
                              CandidateService candidateService, SimulatedConsentService consentService,
                              CurrentActor currentActor, @Qualifier("participantClock") Clock clock) {
        this.participantRepository = participantRepository;
        this.studyService = studyService;
        this.candidateService = candidateService;
        this.consentService = consentService;
        this.currentActor = currentActor;
        this.clock = clock;
    }

    /**
     * Confere todas as condições e bloqueia o consentimento na transação da inclusão.
     * Qualquer falha, inclusive ao persistir o vínculo, desfaz também esse bloqueio.
     *
     * @param studyId estudo da rota
     * @param candidateId candidato da rota
     * @return participante criado com o nome do candidato
     */
    @Transactional
    public ParticipantResult include(Long studyId, Long candidateId) {
        Study study = studyService.lockForCandidateOperations(studyId);
        Candidate candidate = candidateService.lockForConsentUpdate(studyId, candidateId);
        if (study.getStatus() != StudyStatus.RECRUITMENT) {
            throw new InclusionConflictException("A inclusão só é permitida durante o recrutamento.");
        }
        if (candidate.isCancelled()) {
            throw new CandidateConflictException("CANDIDATE_CANCELLED",
                    "Não é possível incluir um candidato com candidatura cancelada.");
        }
        if (participantRepository.existsByStudyIdAndCandidateId(studyId, candidateId)) {
            throw new InclusionConflictException("O candidato já foi incluído neste estudo.");
        }
        if (candidate.getEligibilityStatus() != EligibilityStatus.ELIGIBLE) {
            throw new InclusionConflictException("A inclusão exige candidato elegível.");
        }
        if (participantRepository.countByStudyId(studyId) >= study.getParticipantLimit()) {
            throw new InclusionConflictException("O estudo atingiu o limite de participantes.");
        }
        Long actorId = currentActor.userId();
        consentService.lockAfterInclusion(studyId, candidateId);
        Participant participant = new Participant(studyId, candidateId, actorId,
                clock.instant().truncatedTo(ChronoUnit.MICROS));
        return new ParticipantResult(participantRepository.saveAndFlush(participant), candidate.getName());
    }

    /**
     * Lista vínculos e nomes na mesma visão do banco, sem consultar um candidato por linha.
     *
     * @param studyId estudo da rota
     * @return participantes em ordem estável; vazio para estudo sem inclusões
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public List<ParticipantResult> list(Long studyId) {
        studyService.getStudy(studyId);
        List<Participant> participants = participantRepository.findAllByStudyIdOrderByIdAsc(studyId);
        if (participants.isEmpty()) {
            return List.of();
        }
        Map<Long, String> candidateNames = candidateService.list(studyId).stream()
                .collect(Collectors.toMap(Candidate::getId, Candidate::getName));
        return participants.stream()
                .map(participant -> new ParticipantResult(participant,
                        candidateNames.get(participant.getCandidateId())))
                .toList();
    }

    /**
     * Consulta um participante existente dentro do estudo informado.
     *
     * @param studyId estudo da rota
     * @param participantId vínculo consultado
     * @return participante somente quando pertence ao estudo informado
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ParticipantResult get(Long studyId, Long participantId) {
        studyService.getStudy(studyId);
        Participant participant = participantRepository.findByIdAndStudyId(participantId, studyId)
                .orElseThrow(() -> new ResourceNotFoundException("Participante não encontrado: " + participantId));
        Candidate candidate = candidateService.get(studyId, participant.getCandidateId());
        return new ParticipantResult(participant, candidate.getName());
    }
}
