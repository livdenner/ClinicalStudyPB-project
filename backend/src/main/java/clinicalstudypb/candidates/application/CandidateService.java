package clinicalstudypb.candidates.application;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.CandidateConflictException;
import clinicalstudypb.candidates.infrastructure.CandidateRepository;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coordena cadastro e consulta de candidatos, consultando estudos pelo serviço público.
 *
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
@Service
public class CandidateService {

    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private final CandidateRepository candidateRepository;
    private final StudyService studyService;

    /**
     * Recebe o repositório do módulo e o serviço público de estudos.
     *
     * @param candidateRepository persistência de candidatos
     * @param studyService serviço público para consultar estudo e estado
     */
    public CandidateService(CandidateRepository candidateRepository, StudyService studyService) {
        this.candidateRepository = candidateRepository;
        this.studyService = studyService;
    }

    /**
     * Cadastra candidato somente em estudo existente e aberto ao recrutamento.
     * A chave única no banco também protege contra duas gravações concorrentes.
     *
     * @param studyId identificador do estudo
     * @param name nome informado
     * @param age idade informada
     * @return candidato persistido
     * @throws ResourceNotFoundException quando o estudo não existe
     * @throws CandidateConflictException quando o estudo não está em recrutamento
     *     ou o candidato já foi cadastrado
     */
    @Transactional
    public Candidate create(Long studyId, String name, Integer age) {
        Study study = studyService.lockForCandidateRegistration(studyId);
        if (study.getStatus() != StudyStatus.RECRUITMENT) {
            throw new CandidateConflictException("O estudo não está aberto ao recrutamento.");
        }

        String displayName = normalizeDisplayName(name);
        String nameKey = normalizeNameKey(displayName);
        if (candidateRepository.existsByStudyIdAndNameKeyAndAge(studyId, nameKey, age)) {
            throw new CandidateConflictException("Este candidato já está cadastrado no estudo.");
        }

        return candidateRepository.saveAndFlush(new Candidate(studyId, displayName, nameKey, age));
    }

    /**
     * Lista candidatos de um estudo existente.
     *
     * @param studyId identificador do estudo
     * @return candidatos ordenados pelo cadastro
     * @throws ResourceNotFoundException quando o estudo não existe
     */
    @Transactional(readOnly = true)
    public List<Candidate> list(Long studyId) {
        studyService.getStudy(studyId);
        return candidateRepository.findAllByStudyIdOrderByIdAsc(studyId);
    }

    /**
     * Consulta um candidato dentro do estudo indicado.
     *
     * @param studyId identificador do estudo
     * @param candidateId identificador do candidato
     * @return candidato encontrado
     * @throws ResourceNotFoundException quando o estudo ou candidato não existe
     */
    @Transactional(readOnly = true)
    public Candidate get(Long studyId, Long candidateId) {
        studyService.getStudy(studyId);
        return candidateRepository.findByIdAndStudyId(candidateId, studyId)
                .orElseThrow(() -> new ResourceNotFoundException("Candidato não encontrado: " + candidateId));
    }

    /**
     * Bloqueia um candidato do estudo para alterar seu consentimento ou incluí-lo.
     * Deve ser chamado dentro da transação da operação de negócio.
     *
     * @param studyId identificador do estudo
     * @param candidateId identificador do candidato
     * @return candidato bloqueado
     */
    @Transactional
    public Candidate lockForConsentUpdate(Long studyId, Long candidateId) {
        studyService.getStudy(studyId);
        return candidateRepository.findForConsentUpdate(candidateId, studyId)
                .orElseThrow(() -> new ResourceNotFoundException("Candidato não encontrado: " + candidateId));
    }

    private String normalizeDisplayName(String name) {
        return WHITESPACE.matcher(name.strip()).replaceAll(" ");
    }

    private String normalizeNameKey(String name) {
        return name.toLowerCase(Locale.ROOT);
    }
}
