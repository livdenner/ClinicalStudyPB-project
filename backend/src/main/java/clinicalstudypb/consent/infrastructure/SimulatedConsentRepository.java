package clinicalstudypb.consent.infrastructure;

import clinicalstudypb.consent.domain.SimulatedConsent;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Persistência da última decisão simulada de cada candidato.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-07
 * @version 0.0.1
 */
public interface SimulatedConsentRepository extends JpaRepository<SimulatedConsent, Long> {
}
