package clinicalstudypb.candidates.api;

import clinicalstudypb.candidates.domain.Candidate;
import java.time.Instant;

/**
 * Metadados do cancelamento de uma candidatura, exibidos quando {@code status=CANCELLED}.
 *
 * @param reason justificativa informada pelo coordenador
 * @param cancelledAt instante em que o cancelamento foi registrado
 * @param cancelledByUserId identificador do usuário que cancelou a candidatura
 */
public record CandidateCancellationResponse(String reason, Instant cancelledAt, Long cancelledByUserId) {

    /** Constrói a visão pública quando o candidato foi cancelado, ou {@code null} caso contrário. */
    public static CandidateCancellationResponse from(Candidate candidate) {
        if (!candidate.isCancelled()) {
            return null;
        }
        return new CandidateCancellationResponse(
                candidate.getCancellationReason(),
                candidate.getCancelledAt(),
                candidate.getCancelledByUserId());
    }
}
