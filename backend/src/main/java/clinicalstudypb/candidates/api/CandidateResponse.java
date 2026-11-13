package clinicalstudypb.candidates.api;

import clinicalstudypb.candidates.application.CandidateService;
import clinicalstudypb.candidates.domain.Candidate;
import clinicalstudypb.candidates.domain.CandidateStatus;
import clinicalstudypb.candidates.domain.EligibilityStatus;
import clinicalstudypb.consent.domain.ConsentStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

/** Representação pública de um candidato, sem hash ou senha da conta. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CandidateResponse(Long id, Long studyId, String name, Integer age,
                                String email, String phone, Long userId, CandidateStatus status,
                                EligibilityStatus eligibilityStatus, ConsentStatus consentStatus,
                                CandidateActivationResponse activation) {

    /** Monta a resposta com a situação atual do candidato e do convite. */
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
                snapshot.status(), candidate.getEligibilityStatus(), snapshot.consent(), activation);
    }
}
