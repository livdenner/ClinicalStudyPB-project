package clinicalstudypb.candidates.api;

import clinicalstudypb.candidates.application.CandidateService;
import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.CandidateStatus;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.consent.domain.ConsentStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

/**
 * Representação pública de um candidato, sem hash ou senha da conta.
 *
 * @param id identificador do candidato
 * @param studyId identificador do estudo associado
 * @param name nome de exibição do candidato
 * @param age idade cadastrada
 * @param email endereço de e-mail da conta vinculada
 * @param phone telefone de contato informado
 * @param userId identificador da conta de usuário vinculada
 * @param status estado geral do candidato no fluxo de recrutamento
 * @param eligibilityStatus resultado da avaliação de elegibilidade
 * @param consentStatus estado do consentimento simulado
 * @param activation metadados do convite quando pendente de ativação
 * @param cancellation metadados do cancelamento, quando cancelado
 * @author Lívia
 * @author Lucas N. de Araújo
 * @since 2026-11-06
 * @version 0.0.1
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CandidateResponse(Long id, Long studyId, String name, Integer age,
                                String email, String phone, Long userId, CandidateStatus status,
                                EligibilityStatus eligibilityStatus, ConsentStatus consentStatus,
                                CandidateActivationResponse activation,
                                CandidateCancellationResponse cancellation) {

    /**
     * Monta a resposta com a situação atual do candidato e do convite.
     *
     * @param snapshot fotografia consistente do candidato, status, consentimento e convite
     * @return representação pública serializável do candidato
     */
    public static CandidateResponse from(CandidateService.Snapshot snapshot) {
        Candidate candidate = snapshot.candidate();
        CandidateActivationResponse activation = null;
        if (snapshot.invitation() != null && snapshot.status() == CandidateStatus.INVITED) {
            Instant expiresAt = snapshot.invitation().getExpiresAt();
            String code = snapshot.issued() == null ? null : snapshot.issued().value();
            activation = new CandidateActivationResponse(expiresAt, !expiresAt.isAfter(Instant.now()), code);
        }
        return new CandidateResponse(candidate.getId(), candidate.getStudyId(), candidate.getName(),
                candidate.getAge(), candidate.getEmail(), candidate.getPhone(), candidate.getUserId(),
                snapshot.status(), candidate.getEligibilityStatus(), snapshot.consent(), activation,
                CandidateCancellationResponse.from(candidate));
    }
}
