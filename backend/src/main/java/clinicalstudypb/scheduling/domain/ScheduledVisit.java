package clinicalstudypb.scheduling.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;

/**
 * Agendamento individual de uma visita prevista do protocolo para um participante.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
@Entity
@Table(name = "scheduled_visits")
public class ScheduledVisit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "study_id", nullable = false)
    private Long studyId;

    @Column(name = "participant_id", nullable = false)
    private Long participantId;

    @Column(name = "planned_visit_id", nullable = false)
    private Long plannedVisitId;

    @Column(name = "scheduled_at", nullable = false)
    private Instant scheduledAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ScheduledVisitStatus status;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "outcome_by_user_id")
    private Long outcomeByUserId;

    @Column(name = "outcome_at")
    private Instant outcomeAt;

    @Column(name = "outcome_note", length = 500)
    private String outcomeNote;

    @Version
    @Column(nullable = false)
    private Long version;

    /** Construtor exigido pela JPA. */
    protected ScheduledVisit() {
    }

    /**
     * Cria um agendamento inicial no estado {@link ScheduledVisitStatus#SCHEDULED}.
     *
     * @param studyId identificador do estudo
     * @param participantId identificador do participante
     * @param plannedVisitId identificador da visita prevista no protocolo
     * @param scheduledAt data e hora agendadas em UTC
     * @param createdByUserId identificador do coordenador que criou o agendamento
     * @param createdAt instante da criação atribuído pelo servidor
     */
    public ScheduledVisit(Long studyId,
                          Long participantId,
                          Long plannedVisitId,
                          Instant scheduledAt,
                          Long createdByUserId,
                          Instant createdAt) {
        this.studyId = studyId;
        this.participantId = participantId;
        this.plannedVisitId = plannedVisitId;
        this.scheduledAt = scheduledAt;
        this.status = ScheduledVisitStatus.SCHEDULED;
        this.createdByUserId = createdByUserId;
        this.createdAt = createdAt;
    }

    /**
     * Retorna o identificador do agendamento.
     *
     * @return identificador gerado pelo banco
     */
    public Long getId() {
        return id;
    }

    /**
     * Retorna o identificador do estudo.
     *
     * @return identificador do estudo
     */
    public Long getStudyId() {
        return studyId;
    }

    /**
     * Retorna o identificador do participante.
     *
     * @return identificador do participante
     */
    public Long getParticipantId() {
        return participantId;
    }

    /**
     * Retorna o identificador da visita prevista.
     *
     * @return identificador da visita prevista
     */
    public Long getPlannedVisitId() {
        return plannedVisitId;
    }

    /**
     * Retorna o instante agendado para a visita.
     *
     * @return instante agendado
     */
    public Instant getScheduledAt() {
        return scheduledAt;
    }

    /**
     * Retorna o estado atual do agendamento.
     *
     * @return estado persistido
     */
    public ScheduledVisitStatus getStatus() {
        return status;
    }

    /**
     * Retorna o identificador do usuário que criou o agendamento.
     *
     * @return autor do agendamento
     */
    public Long getCreatedByUserId() {
        return createdByUserId;
    }

    /**
     * Retorna o instante de criação do agendamento.
     *
     * @return instante de criação
     */
    public Instant getCreatedAt() {
        return createdAt;
    }

    /**
     * Retorna o identificador do autor do desfecho, quando houver.
     *
     * @return autor do desfecho ou {@code null}
     */
    public Long getOutcomeByUserId() {
        return outcomeByUserId;
    }

    /**
     * Retorna o instante do desfecho, quando houver.
     *
     * @return instante do desfecho ou {@code null}
     */
    public Instant getOutcomeAt() {
        return outcomeAt;
    }

    /**
     * Retorna a observação do desfecho, quando houver.
     *
     * @return observação ou {@code null}
     */
    public String getOutcomeNote() {
        return outcomeNote;
    }

    /**
     * Retorna a versão para controle de concorrência otimista e ETag.
     *
     * @return versão persistida
     */
    public Long getVersion() {
        return version;
    }
}
