package clinicalstudypb.results.application;

import clinicalstudypb.results.api.ActivityResultResponse;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/** Consulta de resultados para o histórico do participante (RF15). */
public interface ActivityResultLookup {

    /** Retorna somente os resultados registrados para uma visita agendada. */
    List<ActivityResultResponse> findByVisitId(Long visitId);

    /**
     * Busca em uma consulta os resultados de várias visitas agendadas (RF15, T21.1).
     *
     * @param visitIds visitas agendadas consultadas
     * @return mapa {@code visitId -> resultados na ordem do protocolo}; visitas sem resultado não aparecem
     */
    Map<Long, List<ActivityResultResponse>> findByVisitIds(Collection<Long> visitIds);
}
