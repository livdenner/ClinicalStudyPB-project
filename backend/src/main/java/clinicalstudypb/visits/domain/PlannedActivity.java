package clinicalstudypb.visits.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

/**
 * Atividade de uma visita prevista, mapeada para planned_activities.
 * Seu nome normalizado é único apenas dentro da visita.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
@Entity
@Immutable
@Table(name = "planned_activities")
public class PlannedActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "planned_visit_id", nullable = false)
    private PlannedVisit visit;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "name_key", nullable = false, length = 120)
    private String nameKey;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(nullable = false)
    private Integer position;

    /** Construtor usado pela JPA ao ler uma atividade. */
    protected PlannedActivity() {
    }

    /**
     * Consulta o identificador estável da atividade.
     *
     * @return identificador da atividade
     */
    public Long getId() {
        return id;
    }

    /**
     * Consulta a visita que contém a atividade.
     *
     * @return visita associada
     */
    public PlannedVisit getVisit() {
        return visit;
    }

    /**
     * Consulta o nome exibido da atividade.
     *
     * @return nome da atividade
     */
    public String getName() {
        return name;
    }

    /**
     * Consulta o nome normalizado para comparação.
     *
     * @return nome normalizado
     */
    public String getNameKey() {
        return nameKey;
    }

    /**
     * Consulta a descrição da atividade.
     *
     * @return descrição da atividade
     */
    public String getDescription() {
        return description;
    }

    /**
     * Consulta a posição da atividade dentro da visita.
     *
     * @return posição da atividade
     */
    public Integer getPosition() {
        return position;
    }
}
