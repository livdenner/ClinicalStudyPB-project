package clinicalstudypb.studies.infrastructure;

import clinicalstudypb.studies.domain.Study;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Acessa estudos persistidos por meio do Spring Data JPA.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-22
 * @version 0.0.1
 */
public interface StudyRepository extends JpaRepository<Study, Long> {
}
