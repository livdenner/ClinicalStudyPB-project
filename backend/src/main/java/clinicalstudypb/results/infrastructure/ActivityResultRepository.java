package clinicalstudypb.results.infrastructure;

import clinicalstudypb.results.domain.ActivityResult;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Persistência dos resultados de atividades. */
public interface ActivityResultRepository extends Repository<ActivityResult, Long> {

    Optional<ActivityResult> findByVisitIdAndActivityId(Long visitId, Long activityId);

    @Query("SELECT new clinicalstudypb.results.infrastructure.NamedActivityResult(r, a.name) "
            + "FROM ActivityResult r, PlannedActivity a "
            + "WHERE r.visitId = :visitId AND a.id = r.activityId ORDER BY a.position")
    List<NamedActivityResult> findByVisitId(@Param("visitId") Long visitId);

    /** Resultados das visitas informadas, agrupados por visita e na ordem do protocolo. */
    @Query("SELECT new clinicalstudypb.results.infrastructure.NamedActivityResult(r, a.name) "
            + "FROM ActivityResult r, PlannedActivity a "
            + "WHERE r.visitId IN :visitIds AND a.id = r.activityId ORDER BY r.visitId, a.position, r.id")
    List<NamedActivityResult> findByVisitIdIn(@Param("visitIds") Collection<Long> visitIds);

    ActivityResult saveAndFlush(ActivityResult result);
}
