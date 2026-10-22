package clinicalstudypb.studies.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;

/**
 * Representa um estudo clínico persistido na tabela {@code studies}.
 * O identificador do responsável referencia um usuário cadastrado.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-22
 * @version 0.0.1
 */
@Entity
@Table(name = "studies")
public class Study {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String objective;

    @Column(name = "responsible_user_id", nullable = false)
    private Long responsibleUserId;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "participant_limit", nullable = false)
    private Integer participantLimit;

    /** Construtor exigido pela JPA para reconstruir a entidade do banco. */
    protected Study() {
    }

    /**
     * Cria um estudo com os dados necessários para a persistência.
     *
     * @param title título do estudo
     * @param objective objetivo do estudo
     * @param responsibleUserId identificador do pesquisador responsável
     * @param startDate data de início
     * @param endDate data de término
     * @param participantLimit número máximo de participantes
     */
    public Study(String title, String objective, Long responsibleUserId,
                 LocalDate startDate, LocalDate endDate, Integer participantLimit) {
        this.title = title;
        this.objective = objective;
        this.responsibleUserId = responsibleUserId;
        this.startDate = startDate;
        this.endDate = endDate;
        this.participantLimit = participantLimit;
    }

    /**
     * Consulta o identificador do estudo.
     *
     * @return identificador gerado pelo banco
     */
    public Long getId() {
        return this.id;
    }

    /**
     * Consulta o título do estudo.
     *
     * @return título cadastrado
     */
    public String getTitle() {
        return this.title;
    }

    /**
     * Consulta o objetivo do estudo.
     *
     * @return objetivo cadastrado
     */
    public String getObjective() {
        return this.objective;
    }

    /**
     * Consulta o identificador do pesquisador responsável.
     *
     * @return identificador do usuário responsável
     */
    public Long getResponsibleUserId() {
        return this.responsibleUserId;
    }

    /**
     * Consulta a data de início do estudo.
     *
     * @return data de início
     */
    public LocalDate getStartDate() {
        return this.startDate;
    }

    /**
     * Consulta a data de término do estudo.
     *
     * @return data de término
     */
    public LocalDate getEndDate() {
        return this.endDate;
    }

    /**
     * Consulta o limite de participantes do estudo.
     *
     * @return número máximo de participantes
     */
    public Integer getParticipantLimit() {
        return this.participantLimit;
    }
}
