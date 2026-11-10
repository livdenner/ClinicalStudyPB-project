package clinicalstudypb.candidates.application;

import clinicalstudypb.candidates.infrastructure.EligibilityAnswerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fornece aos demais módulos uma consulta pública sobre avaliações de candidatos.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
@Service
public class EligibilityResponseQueryService implements EligibilityResponseLookup {

    private final EligibilityAnswerRepository answerRepository;

    /**
     * Recebe o repositório de respostas.
     *
     * @param answerRepository persistência das respostas de elegibilidade
     */
    public EligibilityResponseQueryService(EligibilityAnswerRepository answerRepository) {
        this.answerRepository = answerRepository;
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(readOnly = true)
    public boolean hasResponses(Long studyId) {
        return answerRepository.existsForStudy(studyId);
    }
}
