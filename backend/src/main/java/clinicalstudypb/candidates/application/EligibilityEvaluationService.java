package clinicalstudypb.candidates.application;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.CandidateConflictException;
import clinicalstudypb.candidates.domain.EligibilityAnswer;
import clinicalstudypb.candidates.domain.EligibilityEvaluation;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.candidates.domain.InvalidEligibilityEvaluationException;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.candidates.infrastructure.EligibilityAnswerRepository;
import clinicalstudypb.candidates.infrastructure.EligibilityEvaluationRepository;
import clinicalstudypb.criteria.application.StudyCriterionService;
import clinicalstudypb.criteria.domain.CriterionType;
import clinicalstudypb.criteria.domain.StudyCriterion;
import clinicalstudypb.participants.application.ParticipantLookup;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Valida e substitui respostas de elegibilidade sob o bloqueio compartilhado do estudo.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
@Service
public class EligibilityEvaluationService {

    private final CandidateRepository candidateRepository;
    private final EligibilityAnswerRepository answerRepository;
    private final EligibilityEvaluationRepository evaluationRepository;
    private final StudyService studyService;
    private final StudyCriterionService criterionService;
    private final ParticipantLookup participantLookup;
    private final CurrentActor currentActor;
    private final Clock clock;

    /**
     * Recebe persistência própria, serviços públicos dos módulos relacionados e relógio.
     *
     * @param candidateRepository persistência dos candidatos
     * @param answerRepository persistência das respostas
     * @param evaluationRepository persistência de autoria e instante
     * @param studyService consulta e bloqueio público de estudos
     * @param criterionService consulta pública de critérios
     * @param participantLookup consulta pública de inclusão
     * @param currentActor identidade autenticada
     * @param clock relógio UTC substituível nos testes
     */
    public EligibilityEvaluationService(CandidateRepository candidateRepository,
                                        EligibilityAnswerRepository answerRepository,
                                        EligibilityEvaluationRepository evaluationRepository,
                                        StudyService studyService, StudyCriterionService criterionService,
                                        ParticipantLookup participantLookup, CurrentActor currentActor,
                                        @Qualifier("eligibilityClock") Clock clock) {
        this.candidateRepository = candidateRepository;
        this.answerRepository = answerRepository;
        this.evaluationRepository = evaluationRepository;
        this.studyService = studyService;
        this.criterionService = criterionService;
        this.participantLookup = participantLookup;
        this.currentActor = currentActor;
        this.clock = clock;
    }

    /**
     * Consulta resultado, respostas e horário na mesma visão transacional do banco.
     *
     * @param studyId estudo da rota
     * @param candidateId candidato da rota
     * @return avaliação atual, pendente antes da primeira resposta
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public EligibilityEvaluationResult get(Long studyId, Long candidateId) {
        studyService.getStudy(studyId);
        Candidate candidate = findCandidate(studyId, candidateId);
        return result(candidate, evaluationRepository.findById(candidateId).orElse(null));
    }

    /**
     * Substitui todas as respostas e recalcula o resultado sem gravação parcial.
     * Respostas omitidas deixam de ser consideradas e podem tornar o resultado pendente.
     *
     * @param studyId estudo da rota
     * @param candidateId candidato da rota
     * @param answers conjunto completo de respostas atuais
     * @return resultado recalculado e instante da avaliação
     */
    @Transactional
    public EligibilityEvaluationResult evaluate(Long studyId, Long candidateId, List<EligibilityAnswerInput> answers) {
        studyService.lockForCandidateOperations(studyId);
        Candidate candidate = findCandidate(studyId, candidateId);
        if (candidate.isCancelled()) {
            throw new CandidateConflictException("CANDIDATE_CANCELLED",
                    "Não é possível avaliar um candidato com candidatura cancelada.");
        }
        if (participantLookup.isIncluded(studyId, candidateId)) {
            throw new CandidateConflictException(
                    "Não é possível reavaliar um candidato já incluído como participante.");
        }
        List<StudyCriterion> criteria = criterionService.list(studyId);
        if (criteria.isEmpty()) {
            throw new CandidateConflictException("O estudo não possui critérios para avaliação de elegibilidade.");
        }
        Map<Long, Boolean> responses = validateAnswers(criteria, answers);
        EligibilityStatus status = calculateStatus(criteria, responses);
        EligibilityEvaluation evaluation = new EligibilityEvaluation(candidateId, currentActor.userId(),
                clock.instant().truncatedTo(ChronoUnit.MICROS));

        answerRepository.deleteForCandidate(candidateId);
        answerRepository.saveAllAndFlush(answers.stream()
                .map(answer -> new EligibilityAnswer(candidateId, answer.criterionId(), answer.matches())).toList());
        candidate.updateEligibilityStatus(status);
        evaluationRepository.saveAndFlush(evaluation);
        return result(candidate, evaluation);
    }

    private Candidate findCandidate(Long studyId, Long candidateId) {
        return candidateRepository.findByIdAndStudyId(candidateId, studyId)
                .orElseThrow(() -> new ResourceNotFoundException("Candidato não encontrado: " + candidateId));
    }

    private Map<Long, Boolean> validateAnswers(List<StudyCriterion> criteria, List<EligibilityAnswerInput> answers) {
        if (answers == null || answers.isEmpty()) {
            throw new InvalidEligibilityEvaluationException("Informe ao menos uma resposta de elegibilidade.");
        }
        Map<Long, StudyCriterion> criteriaById = new HashMap<>();
        criteria.forEach(criterion -> criteriaById.put(criterion.getId(), criterion));
        Map<Long, Boolean> responses = new HashMap<>();
        for (EligibilityAnswerInput answer : answers) {
            if (answer == null || answer.criterionId() == null || answer.matches() == null
                    || !criteriaById.containsKey(answer.criterionId())) {
                throw new InvalidEligibilityEvaluationException(
                        "Informe respostas válidas para critérios deste estudo.");
            }
            if (responses.putIfAbsent(answer.criterionId(), answer.matches()) != null) {
                throw new InvalidEligibilityEvaluationException("Cada critério deve aparecer apenas uma vez.");
            }
        }
        return responses;
    }

    private EligibilityStatus calculateStatus(List<StudyCriterion> criteria, Map<Long, Boolean> responses) {
        if (responses.size() != criteria.size()) {
            return EligibilityStatus.PENDING;
        }
        boolean eligible = criteria.stream().allMatch(criterion -> responses.get(criterion.getId())
                == (criterion.getType() == CriterionType.INCLUSION));
        return eligible ? EligibilityStatus.ELIGIBLE : EligibilityStatus.INELIGIBLE;
    }

    private EligibilityEvaluationResult result(Candidate candidate, EligibilityEvaluation evaluation) {
        return new EligibilityEvaluationResult(candidate.getStudyId(), candidate.getId(),
                candidate.getEligibilityStatus(),
                answerRepository.findAllByCandidateIdOrderByCriterionIdAsc(candidate.getId()),
                evaluation == null ? null : evaluation.getEvaluatedAt());
    }
}
