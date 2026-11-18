package clinicalstudypb.results.infrastructure;

import clinicalstudypb.results.domain.ActivityResult;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Persistência dos resultados de atividades. */
public interface ActivityResultRepository extends Repository<ActivityResult, Long> {

    Optional<ActivityResult> findByVisitIdAndActivityId(Long visitId, Long activityId);

    @Query("SELECT r FROM ActivityResult r, PlannedActivity a "
            + "WHERE r.visitId = :visitId AND a.id = r.activityId ORDER BY a.position")
    List<ActivityResult> findByVisitId(@Param("visitId") Long visitId);

    ActivityResult saveAndFlush(ActivityResult result);
}
