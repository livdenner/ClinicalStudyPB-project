package clinicalstudypb.visits.infrastructure;

import clinicalstudypb.visits.domain.PlannedVisit;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.repository.Repository;

/**
 * Lê visitas e atividades do protocolo pelo mapeamento JPA.
 * As escritas ordenadas permanecem no serviço SQL transacional.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
public interface PlannedVisitRepository extends Repository<PlannedVisit, Long> {

    /**
     * Lista as visitas do estudo com as atividades já carregadas.
     *
     * @param studyId identificador do estudo
     * @return visitas ordenadas
     */
    @EntityGraph(attributePaths = "activities")
    List<PlannedVisit> findByStudyIdOrderByPositionAsc(Long studyId);

    /**
     * Busca uma visita somente quando pertence ao estudo da rota.
     *
     * @param id identificador da visita
     * @param studyId identificador do estudo
     * @return visita com atividades ou vazio
     */
    @EntityGraph(attributePaths = "activities")
    Optional<PlannedVisit> findByIdAndStudyId(Long id, Long studyId);
}
