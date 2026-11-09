package clinicalstudypb.candidates.infrastructure;

import clinicalstudypb.candidates.domain.EligibilityEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Persistência dos metadados da última avaliação de cada candidato.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
public interface EligibilityEvaluationRepository extends JpaRepository<EligibilityEvaluation, Long> {
}
