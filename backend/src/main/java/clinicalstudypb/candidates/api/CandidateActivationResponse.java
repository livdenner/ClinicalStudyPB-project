package clinicalstudypb.candidates.api;

import clinicalstudypb.candidates.application.CandidateInvitationService;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

/** Metadados do convite; o código só é devolvido quando foi recém-gerado. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CandidateActivationResponse(Instant expiresAt, boolean expired, String activationCode) {

    public static CandidateActivationResponse from(CandidateInvitationService.IssuedCode issued) {
        return new CandidateActivationResponse(issued.expiresAt(), false, issued.value());
    }
}
