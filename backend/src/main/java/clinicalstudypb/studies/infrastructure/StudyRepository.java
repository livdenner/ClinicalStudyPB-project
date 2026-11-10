package clinicalstudypb.studies.infrastructure;

import clinicalstudypb.studies.domain.Study;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Acessa estudos persistidos por meio do Spring Data JPA.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-22
 * @version 0.0.1
 */
public interface StudyRepository extends JpaRepository<Study, Long> {

    /**
     * Busca um estudo com bloqueio de escrita até o fim da transação.
     * Assim, transições simultâneas são avaliadas em sequência.
     *
     * @param id identificador do estudo
     * @return estudo encontrado, se existir
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Study s WHERE s.id = :id")
    Optional<Study> findByIdForUpdate(@Param("id") Long id);
}
