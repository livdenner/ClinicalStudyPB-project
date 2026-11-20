package clinicalstudypb.results.api;

import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import java.util.List;

/** Atividades e resultados de uma visita agendada. */
public record VisitResultsResponse(Long visitId, Long plannedVisitId, String plannedVisitName,
                                   ScheduledVisitStatus status, List<VisitResultActivityResponse> activities) {
}
