package clinicalstudypb.studies.infrastructure;

import clinicalstudypb.studies.domain.StudyStatusHistory;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Consulta e grava o histórico de estado dos estudos.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
public interface StudyStatusHistoryRepository extends JpaRepository<StudyStatusHistory, Long> {

    /**
     * Lista as mudanças de um estudo na ordem em que foram gravadas.
     *
     * @param studyId estudo consultado
     * @return registros ordenados
     */
    List<StudyStatusHistory> findByStudyIdOrderByIdAsc(Long studyId);

    /**
     * Busca a última mudança de estado.
     *
     * @param studyId estudo consultado
     * @return última mudança, se houver
     */
    Optional<StudyStatusHistory> findFirstByStudyIdOrderByIdDesc(Long studyId);
}
