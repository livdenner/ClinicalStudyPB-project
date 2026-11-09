package clinicalstudypb.candidates.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Autor e instante da última avaliação; o resultado permanece no cadastro do candidato.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
@Entity
@Table(name = "eligibility_evaluations")
public class EligibilityEvaluation {

    @Id
    @Column(name = "candidate_id")
    private Long candidateId;

    @Column(name = "evaluated_by", nullable = false)
    private Long evaluatedBy;

    @Column(name = "evaluated_at", nullable = false)
    private Instant evaluatedAt;

    /** Construtor exigido pela JPA. */
    protected EligibilityEvaluation() {
    }

    /**
     * Registra a autoria da avaliação atual do candidato.
     *
     * @param candidateId candidato avaliado
     * @param evaluatedBy autor autenticado
     * @param evaluatedAt instante da avaliação
     */
    public EligibilityEvaluation(Long candidateId, Long evaluatedBy, Instant evaluatedAt) {
        this.candidateId = candidateId;
        this.evaluatedBy = evaluatedBy;
        this.evaluatedAt = evaluatedAt;
    }

    /** @return candidato avaliado */
    public Long getCandidateId() {
        return candidateId;
    }

    /** @return identificador do autor autenticado */
    public Long getEvaluatedBy() {
        return evaluatedBy;
    }

    /** @return instante da última avaliação */
    public Instant getEvaluatedAt() {
        return evaluatedAt;
    }
}
