package clinicalstudypb.candidates.infrastructure;

import clinicalstudypb.candidates.domain.Candidate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Persistência e consultas de candidatos sem expor repositórios de outros módulos.
 *
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
public interface CandidateRepository extends JpaRepository<Candidate, Long> {

    /**
     * Lista os candidatos do estudo em ordem estável de cadastro.
     *
     * @param studyId identificador do estudo
     * @return candidatos do estudo
     */
    List<Candidate> findAllByStudyIdOrderByIdAsc(Long studyId);

    /**
     * Busca um candidato somente dentro do estudo indicado.
     *
     * @param id identificador do candidato
     * @param studyId identificador do estudo
     * @return candidato quando pertence ao estudo
     */
    Optional<Candidate> findByIdAndStudyId(Long id, Long studyId);

    /**
     * Confere a chave de duplicidade antes de gravar.
     *
     * @param studyId identificador do estudo
     * @param nameKey nome normalizado
     * @param age idade informada
     * @return verdadeiro se já existir candidato com os mesmos dados
     */
    boolean existsByStudyIdAndNameKeyAndAge(Long studyId, String nameKey, Integer age);
}
