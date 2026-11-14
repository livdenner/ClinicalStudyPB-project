package clinicalstudypb.visits.infrastructure;

import clinicalstudypb.visits.domain.PlannedVisit;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

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

    /**
     * Busca apenas o nome da visita prevista pertencente ao estudo.
     *
     * @param id identificador da visita prevista
     * @param studyId identificador do estudo
     * @return nome da visita prevista ou vazio
     */
    @Query("SELECT v.name FROM PlannedVisit v WHERE v.id = :id AND v.studyId = :studyId")
    Optional<String> findNameByIdAndStudyId(@Param("id") Long id, @Param("studyId") Long studyId);

    /**
     * Lista pares identificador e nome das visitas previstas do estudo.
     *
     * @param studyId identificador do estudo
     * @return projeções leves com identificador e nome
     */
    @Query("SELECT v.id AS id, v.name AS name FROM PlannedVisit v WHERE v.studyId = :studyId")
    List<PlannedVisitNameProjection> findNamesByStudyId(@Param("studyId") Long studyId);

    /**
     * Projeção enxuta com identificador e nome de visita prevista.
     *
     * @author Lucas N. de Araújo
     * @since 2026-11-13
     * @version 0.0.1
     */
    interface PlannedVisitNameProjection {

        /**
         * Retorna o identificador da visita prevista.
         *
         * @return identificador da visita prevista
         */
        Long getId();

        /**
         * Retorna o nome da visita prevista.
         *
         * @return nome da visita prevista
         */
        String getName();
    }
}
