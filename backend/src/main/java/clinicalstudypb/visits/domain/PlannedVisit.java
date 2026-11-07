package clinicalstudypb.visits.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.Immutable;

/**
 * Visita prevista do protocolo de um estudo, mapeada para a tabela planned_visits.
 * A leitura usa JPA; alterações de posição usam SQL transacional no serviço.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
@Entity
@Immutable
@Table(name = "planned_visits")
public class PlannedVisit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "study_id", nullable = false)
    private Long studyId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "planned_date", nullable = false)
    private LocalDate plannedDate;

    @Column(nullable = false)
    private Integer position;

    @OneToMany(mappedBy = "visit", fetch = FetchType.LAZY)
    @OrderBy("position ASC")
    private List<PlannedActivity> activities = new ArrayList<>();

    /** Construtor usado pela JPA ao ler uma visita. */
    protected PlannedVisit() {
    }

    /**
     * Consulta o identificador estável da visita.
     *
     * @return identificador estável da visita
     */
    public Long getId() {
        return id;
    }

    /**
     * Consulta o estudo ao qual a visita pertence.
     *
     * @return identificador do estudo
     */
    public Long getStudyId() {
        return studyId;
    }

    /**
     * Consulta o nome exibido da visita.
     *
     * @return nome da visita
     */
    public String getName() {
        return name;
    }

    /**
     * Consulta a data prevista dentro do período do estudo.
     *
     * @return data prevista
     */
    public LocalDate getPlannedDate() {
        return plannedDate;
    }

    /**
     * Consulta a posição da visita no estudo.
     *
     * @return posição da visita
     */
    public Integer getPosition() {
        return position;
    }

    /**
     * Consulta as atividades na ordem planejada.
     *
     * @return atividades ordenadas da visita
     */
    public List<PlannedActivity> getActivities() {
        return activities;
    }
}
