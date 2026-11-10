package clinicalstudypb.studies.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Registro imutável de uma mudança no ciclo de vida de um estudo.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
@Entity
@Table(name = "study_status_history")
public class StudyStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "study_id", nullable = false)
    private Long studyId;

    @Column(name = "actor_user_id", nullable = false)
    private Long actorUserId;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", nullable = false, length = 20)
    private StudyStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 20)
    private StudyStatus toStatus;

    @Column(length = 1000)
    private String reason;

    /** Construtor usado pela JPA. */
    protected StudyStatusHistory() {
    }

    /**
     * Cria um registro que não deve ser modificado após a persistência.
     *
     * @param studyId estudo alterado
     * @param actorUserId usuário que fez a alteração
     * @param changedAt instante da mudança
     * @param fromStatus estado anterior
     * @param toStatus novo estado
     * @param reason justificativa do cancelamento, se houver
     */
    public StudyStatusHistory(Long studyId, Long actorUserId, Instant changedAt,
                              StudyStatus fromStatus, StudyStatus toStatus, String reason) {
        this.studyId = studyId;
        this.actorUserId = actorUserId;
        this.changedAt = changedAt;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.reason = reason;
    }

    /**
     * Consulta o identificador do registro.
     *
     * @return identificador do registro
     */
    public Long getId() {
        return id;
    }

    /**
     * Consulta o estudo alterado.
     *
     * @return estudo alterado
     */
    public Long getStudyId() {
        return studyId;
    }

    /**
     * Consulta quem fez a alteração.
     *
     * @return usuário que fez a alteração
     */
    public Long getActorUserId() {
        return actorUserId;
    }

    /**
     * Consulta quando a mudança ocorreu.
     *
     * @return instante da mudança
     */
    public Instant getChangedAt() {
        return changedAt;
    }

    /**
     * Consulta o estado anterior.
     *
     * @return estado anterior
     */
    public StudyStatus getFromStatus() {
        return fromStatus;
    }

    /**
     * Consulta o estado de destino.
     *
     * @return novo estado
     */
    public StudyStatus getToStatus() {
        return toStatus;
    }

    /**
     * Consulta a justificativa do cancelamento.
     *
     * @return justificativa, se houver
     */
    public String getReason() {
        return reason;
    }
}
