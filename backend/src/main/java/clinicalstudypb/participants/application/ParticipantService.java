package clinicalstudypb.participants.application;

import clinicalstudypb.candidates.application.CandidateService;
import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.CandidateConflictException;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.consent.application.SimulatedConsentService;
import clinicalstudypb.participants.domain.InclusionConflictException;
import clinicalstudypb.participants.domain.InvalidWithdrawalException;
import clinicalstudypb.participants.domain.Participant;
import clinicalstudypb.participants.domain.WithdrawalConflictException;
import clinicalstudypb.participants.infrastructure.ParticipantRepository;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import java.time.Clock;
import java.time.Instant;
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
public class ParticipantService implements ParticipantSchedulingLookup {

    private static final int MAX_WITHDRAWAL_REASON_LENGTH = 500;

    private final ParticipantRepository participantRepository;
    private final StudyService studyService;
    private final CandidateService candidateService;
    private final SimulatedConsentService consentService;
    private final ParticipantWithdrawalVisits withdrawalVisits;
    private final CurrentActor currentActor;
    private final Clock clock;

    /**
     * Recebe a persistência própria e os serviços públicos das dependências.
     *
     * @param participantRepository persistência interna de participantes
     * @param studyService consulta e bloqueio públicos de estudos
     * @param candidateService consulta e bloqueio públicos de candidatos
     * @param consentService validação e bloqueio público do consentimento concedido
     * @param withdrawalVisits cancelamento das visitas futuras na retirada
     * @param currentActor autor autenticado da inclusão e da retirada
     * @param clock relógio UTC substituível em testes
     */
    public ParticipantService(ParticipantRepository participantRepository, StudyService studyService,
                              CandidateService candidateService, SimulatedConsentService consentService,
                              ParticipantWithdrawalVisits withdrawalVisits, CurrentActor currentActor,
                              @Qualifier("participantClock") Clock clock) {
        this.participantRepository = participantRepository;
        this.studyService = studyService;
        this.candidateService = candidateService;
        this.consentService = consentService;
        this.withdrawalVisits = withdrawalVisits;
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

    /**
     * Registra a retirada do participante (RF16) em uma única transação. Bloqueia o estudo e
     * depois o participante, na mesma ordem do agendamento; cancela as visitas {@code SCHEDULED}
     * com data posterior ao instante da retirada; e grava motivo, instante, autor e a
     * quantidade de visitas canceladas. Qualquer falha desfaz a retirada e os cancelamentos.
     * O participante continua ocupando a vaga e o candidato não pode ser reincluído
     * (decisão da PO de 12/11/2026).
     *
     * @param studyId estudo da rota
     * @param participantId participante da rota
     * @param reason motivo informado; espaços nas extremidades são removidos
     * @return participante retirado com o nome do candidato
     * @throws InvalidWithdrawalException quando o motivo está ausente, vazio ou passa de 500 caracteres
     * @throws ResourceNotFoundException quando o estudo não existe ou o participante não pertence a ele
     * @throws WithdrawalConflictException com {@code STUDY_READ_ONLY} ou {@code PARTICIPANT_ALREADY_WITHDRAWN}
     */
    @Transactional
    public ParticipantResult withdraw(Long studyId, Long participantId, String reason) {
        String normalizedReason = normalizeWithdrawalReason(reason);
        Study study = studyService.lockForParticipantWithdrawal(studyId);
        Participant participant = participantRepository.findByIdAndStudyIdForUpdate(participantId, studyId)
                .orElseThrow(() -> new ResourceNotFoundException("Participante não encontrado: " + participantId));
        if (study.getStatus() == StudyStatus.CLOSED || study.getStatus() == StudyStatus.CANCELLED) {
            throw new WithdrawalConflictException(WithdrawalConflictException.STUDY_READ_ONLY,
                    "O estudo está encerrado ou cancelado e não aceita retiradas.");
        }
        if (participant.isWithdrawn()) {
            throw new WithdrawalConflictException(WithdrawalConflictException.PARTICIPANT_ALREADY_WITHDRAWN,
                    "O participante já foi retirado do estudo.");
        }
        Long actorId = currentActor.userId();
        Instant withdrawnAt = clock.instant().truncatedTo(ChronoUnit.MICROS);
        int cancelledVisits = withdrawalVisits.cancelFutureScheduledVisits(
                studyId, participantId, actorId, withdrawnAt);
        participant.withdraw(normalizedReason, withdrawnAt, actorId, cancelledVisits);
        Participant saved = participantRepository.saveAndFlush(participant);
        Candidate candidate = candidateService.get(studyId, saved.getCandidateId());
        return new ParticipantResult(saved, candidate.getName());
    }

    @Override
    @Transactional
    public ParticipantSchedulingView lockForScheduling(Long studyId, Long participantId) {
        Participant participant = participantRepository.findByIdAndStudyIdForUpdate(participantId, studyId)
                .orElseThrow(() -> new ResourceNotFoundException("Participante não encontrado: " + participantId));
        Candidate candidate = candidateService.get(studyId, participant.getCandidateId());
        return toSchedulingView(participant, candidate.getName());
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ParticipantSchedulingView getForScheduling(Long studyId, Long participantId) {
        ParticipantResult result = get(studyId, participantId);
        return toSchedulingView(result.participant(), result.candidateName());
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public java.util.Map<Long, String> findNamesByStudy(Long studyId) {
        return list(studyId).stream()
                .collect(java.util.stream.Collectors.toMap(
                        result -> result.participant().getId(),
                        ParticipantResult::candidateName));
    }

    private static String normalizeWithdrawalReason(String reason) {
        String normalized = reason == null ? "" : reason.strip();
        if (normalized.isEmpty() || normalized.length() > MAX_WITHDRAWAL_REASON_LENGTH) {
            throw new InvalidWithdrawalException("Informe o motivo da retirada com 1 a 500 caracteres.");
        }
        return normalized;
    }

    private ParticipantSchedulingView toSchedulingView(Participant participant, String candidateName) {
        return new ParticipantSchedulingView(
                participant.getId(),
                participant.getStudyId(),
                candidateName,
                participant.isWithdrawn());
    }
}
