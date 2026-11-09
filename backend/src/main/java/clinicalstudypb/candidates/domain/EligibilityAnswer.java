package clinicalstudypb.candidates.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Resposta registrada para um critério durante a avaliação de um candidato.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
@Entity
@Table(name = "eligibility_answers", uniqueConstraints = @UniqueConstraint(
        name = "uq_eligibility_answer_candidate_criterion", columnNames = {"candidate_id", "criterion_id"}))
public class EligibilityAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "candidate_id", nullable = false)
    private Long candidateId;

    @Column(name = "criterion_id", nullable = false)
    private Long criterionId;

    @Column(nullable = false)
    private boolean matches;

    /** Construtor usado pela JPA. */
    protected EligibilityAnswer() {
    }

    /**
     * Cria uma resposta de elegibilidade.
     *
     * @param candidateId identificador do candidato
     * @param criterionId identificador do critério
     * @param matches se o candidato atende ao critério
     */
    public EligibilityAnswer(Long candidateId, Long criterionId, boolean matches) {
        this.candidateId = candidateId;
        this.criterionId = criterionId;
        this.matches = matches;
    }

    /** @return identificador da resposta */
    public Long getId() {
        return id;
    }

    /** @return identificador do candidato */
    public Long getCandidateId() {
        return candidateId;
    }

    /** @return identificador do critério */
    public Long getCriterionId() {
        return criterionId;
    }

    /** @return se o candidato atende ao critério */
    public boolean isMatches() {
        return matches;
    }
}
