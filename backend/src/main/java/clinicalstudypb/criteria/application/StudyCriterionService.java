package clinicalstudypb.criteria.application;

import clinicalstudypb.candidates.application.EligibilityResponseLookup;
import clinicalstudypb.criteria.domain.CriterionType;
import clinicalstudypb.criteria.domain.StudyCriterion;
import clinicalstudypb.criteria.infrastructure.StudyCriterionRepository;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyReadiness;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.visits.domain.ProtocolConflictException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coordena cadastro, leitura e validação de prontidão dos critérios do estudo.
 *
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
@Service
public class StudyCriterionService implements StudyReadiness {

    private final StudyCriterionRepository criterionRepository;
    private final StudyService studyService;
    private final EligibilityResponseLookup eligibilityResponseLookup;

    /**
     * Recebe o repositório do módulo e o serviço público de estudos.
     *
     * @param criterionRepository persistência dos critérios
     * @param studyService regras e consultas públicas de estudos
     * @param eligibilityResponseLookup consulta pública de respostas de elegibilidade
     */
    public StudyCriterionService(StudyCriterionRepository criterionRepository, StudyService studyService,
                                 EligibilityResponseLookup eligibilityResponseLookup) {
        this.criterionRepository = criterionRepository;
        this.studyService = studyService;
        this.eligibilityResponseLookup = eligibilityResponseLookup;
    }

    /**
     * Cadastra um critério no protocolo ainda editável pelo pesquisador responsável.
     *
     * @param studyId identificador do estudo
     * @param type tipo de critério
     * @param description descrição obrigatória
     * @return critério persistido
     */
    @Transactional
    public StudyCriterion create(Long studyId, CriterionType type, String description) {
        Study study = studyService.lockForProtocolEdit(studyId);
        if (eligibilityResponseLookup.hasResponses(studyId)) {
            throw new ProtocolConflictException(
                    "Não é possível adicionar critérios após a primeira resposta de elegibilidade.");
        }
        studyService.touchProtocol(study, study.getVersion());
        StudyCriterion criterion = new StudyCriterion(studyId, type, description.strip());
        return criterionRepository.saveAndFlush(criterion);
    }

    /**
     * Lista critérios de um estudo existente.
     *
     * @param studyId identificador do estudo
     * @return critérios ordenados por identificador
     */
    @Transactional(readOnly = true)
    public List<StudyCriterion> list(Long studyId) {
        studyService.getStudy(studyId);
        return criterionRepository.findAllByStudyIdOrderByIdAsc(studyId);
    }

    /**
     * Consulta um critério dentro do estudo informado.
     *
     * @param studyId identificador do estudo
     * @param criterionId identificador do critério
     * @return critério encontrado
     */
    @Transactional(readOnly = true)
    public StudyCriterion get(Long studyId, Long criterionId) {
        studyService.getStudy(studyId);
        return criterionRepository.findByIdAndStudyId(criterionId, studyId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Critério não encontrado: " + criterionId));
    }

    /**
     * Indica se o estudo tem pelo menos um critério de inclusão e um de exclusão.
     *
     * @param studyId identificador do estudo
     * @return verdadeiro quando os dois tipos existem
     */
    @Override
    @Transactional(readOnly = true)
    public boolean hasInclusionAndExclusionCriteria(Long studyId) {
        return criterionRepository.existsByStudyIdAndType(studyId, CriterionType.INCLUSION)
                && criterionRepository.existsByStudyIdAndType(studyId, CriterionType.EXCLUSION);
    }

    /**
     * O módulo de critérios não controla a inclusão de participantes.
     *
     * @param studyId identificador do estudo
     * @return falso até que o módulo de participantes forneça essa informação
     */
    @Override
    public boolean hasIncludedParticipant(Long studyId) {
        return false;
    }
}
