package clinicalstudypb.consent.api;

import clinicalstudypb.consent.domain.ConsentDecision;
import jakarta.validation.constraints.NotNull;

/**
 * Decisão simulada recebida para um candidato.
 *
 * @param status decisão GRANTED ou DECLINED
 * @author Lucas N. de Araújo
 * @since 2026-11-07
 * @version 0.0.1
 */
public record SimulatedConsentWriteRequest(@NotNull ConsentDecision status) {
}
