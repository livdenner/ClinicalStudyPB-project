package clinicalstudypb.candidates.api;

import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.EligibilityStatus;

/**
 * Representação pública de um candidato.
 *
 * @param id identificador do candidato
 * @param studyId identificador do estudo
 * @param name nome do candidato
 * @param age idade informada
 * @param eligibilityStatus resultado atual da elegibilidade
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
public record CandidateResponse(Long id, Long studyId, String name, Integer age,
                                EligibilityStatus eligibilityStatus) {

    /**
     * Converte a entidade persistida para o contrato da API.
     *
     * @param candidate entidade de candidato
     * @return resposta da API
     */
    public static CandidateResponse from(Candidate candidate) {
        return new CandidateResponse(candidate.getId(), candidate.getStudyId(), candidate.getName(),
                candidate.getAge(), candidate.getEligibilityStatus());
    }
}
