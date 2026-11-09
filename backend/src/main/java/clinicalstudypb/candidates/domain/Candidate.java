package clinicalstudypb.candidates.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Candidato persistido e vinculado a um estudo clínico.
 *
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
@Entity
@Table(name = "candidates")
public class Candidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "study_id", nullable = false)
    private Long studyId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "name_key", nullable = false, length = 360)
    private String nameKey;

    @Column(nullable = false)
    private Integer age;

    @Enumerated(EnumType.STRING)
    @Column(name = "eligibility_status", nullable = false, length = 20)
    private EligibilityStatus eligibilityStatus = EligibilityStatus.PENDING;

    /** Construtor exigido pela JPA para reconstruir a entidade persistida. */
    protected Candidate() {
    }

    /**
     * Cria um candidato vinculado ao estudo informado.
     *
     * @param studyId identificador do estudo
     * @param name nome exibido
     * @param nameKey nome normalizado usado para detectar duplicidade
     * @param age idade informada
     */
    public Candidate(Long studyId, String name, String nameKey, Integer age) {
        this.studyId = studyId;
        this.name = name;
        this.nameKey = nameKey;
        this.age = age;
        this.eligibilityStatus = EligibilityStatus.PENDING;
    }

    /**
     * Consulta o identificador persistido.
     *
     * @return identificador do candidato
     */
    public Long getId() {
        return id;
    }

    /**
     * Consulta o estudo ao qual o candidato pertence.
     *
     * @return identificador do estudo
     */
    public Long getStudyId() {
        return studyId;
    }

    /**
     * Consulta o nome do candidato.
     *
     * @return nome exibido
     */
    public String getName() {
        return name;
    }

    /**
     * Consulta a idade informada no cadastro.
     *
     * @return idade do candidato
     */
    public Integer getAge() {
        return age;
    }

    /**
     * Consulta o resultado de elegibilidade do candidato.
     *
     * @return estado da avaliação
     */
    public EligibilityStatus getEligibilityStatus() {
        return eligibilityStatus;
    }

    /**
     * Atualiza o resultado calculado na mesma transação das respostas de elegibilidade.
     *
     * @param status resultado da avaliação atual
     */
    public void updateEligibilityStatus(EligibilityStatus status) {
        this.eligibilityStatus = java.util.Objects.requireNonNull(status);
    }
}
