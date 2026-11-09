package clinicalstudypb.criteria.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Critério de inclusão ou exclusão persistido para um estudo.
 *
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
@Entity
@Table(name = "study_criteria")
public class StudyCriterion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "study_id", nullable = false)
    private Long studyId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CriterionType type;

    @Column(nullable = false, length = 500)
    private String description;

    /** Construtor exigido pela JPA para reconstruir o critério persistido. */
    protected StudyCriterion() {
    }

    /**
     * Cria um critério associado ao estudo.
     *
     * @param studyId identificador do estudo
     * @param type classificação de inclusão ou exclusão
     * @param description descrição obrigatória
     */
    public StudyCriterion(Long studyId, CriterionType type, String description) {
        this.studyId = studyId;
        this.type = type;
        this.description = description;
    }

    /** @return identificador persistido */
    public Long getId() {
        return id;
    }

    /** @return identificador do estudo associado */
    public Long getStudyId() {
        return studyId;
    }

    /** @return tipo de critério */
    public CriterionType getType() {
        return type;
    }

    /** @return descrição do critério */
    public String getDescription() {
        return description;
    }
}
