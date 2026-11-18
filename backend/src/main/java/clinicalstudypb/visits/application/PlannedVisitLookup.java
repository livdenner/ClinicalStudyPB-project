package clinicalstudypb.visits.application;

import clinicalstudypb.visits.api.PlannedVisitResponse;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Consultas públicas de visitas previstas do protocolo para outros módulos.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
public interface PlannedVisitLookup {

    /**
     * Busca o nome de uma visita prevista pertencente ao estudo informado.
     *
     * @param studyId identificador do estudo
     * @param plannedVisitId identificador da visita prevista
     * @return nome da visita ou vazio caso não pertença ao estudo
     */
    Optional<String> findNameByStudyAndId(Long studyId, Long plannedVisitId);

    /**
     * Busca o protocolo completo de uma visita prevista no estudo.
     *
     * @param studyId identificador do estudo
     * @param plannedVisitId identificador da visita prevista
     * @return visita e atividades ou vazio
     */
    Optional<PlannedVisitResponse> findByStudyAndId(Long studyId, Long plannedVisitId);

    /**
     * Mapeia identificadores de visitas previstas do estudo para seus nomes.
     *
     * @param studyId identificador do estudo
     * @return mapa {@code plannedVisitId -> nome}
     */
    Map<Long, String> findNamesByStudy(Long studyId);

    /**
     * Lista as visitas previstas e suas atividades na ordem do protocolo do estudo.
     *
     * @param studyId identificador do estudo
     * @return visitas ordenadas por posição crescente
     */
    List<PlannedVisitResponse> findByStudy(Long studyId);
}
