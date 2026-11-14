package clinicalstudypb.visits.application;

import clinicalstudypb.visits.infrastructure.PlannedVisitRepository;
import clinicalstudypb.visits.infrastructure.PlannedVisitRepository.PlannedVisitNameProjection;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implementação pública das consultas de visitas previstas para outros módulos.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
@Service
public class PlannedVisitQueryService implements PlannedVisitLookup {

    private final PlannedVisitRepository plannedVisitRepository;

    /**
     * Cria o serviço de consulta de visitas previstas.
     *
     * @param plannedVisitRepository repositório de visitas previstas
     */
    public PlannedVisitQueryService(PlannedVisitRepository plannedVisitRepository) {
        this.plannedVisitRepository = plannedVisitRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<String> findNameByStudyAndId(Long studyId, Long plannedVisitId) {
        return plannedVisitRepository.findNameByIdAndStudyId(plannedVisitId, studyId);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, String> findNamesByStudy(Long studyId) {
        return plannedVisitRepository.findNamesByStudyId(studyId).stream()
                .collect(Collectors.toMap(
                        PlannedVisitNameProjection::getId,
                        PlannedVisitNameProjection::getName));
    }
}
