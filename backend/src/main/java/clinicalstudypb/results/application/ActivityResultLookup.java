package clinicalstudypb.results.application;

import clinicalstudypb.results.api.ActivityResultResponse;
import java.util.List;

/** Consulta de resultados para o histórico do participante (RF15). */
public interface ActivityResultLookup {

    /** Retorna somente os resultados registrados para uma visita agendada. */
    List<ActivityResultResponse> findByVisitId(Long visitId);
}
