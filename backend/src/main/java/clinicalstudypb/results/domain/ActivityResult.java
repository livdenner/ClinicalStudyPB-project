package clinicalstudypb.results.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Resultado fictício de uma atividade em uma visita realizada. */
@Entity
@Table(name = "activity_results")
public class ActivityResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scheduled_visit_id", nullable = false)
    private Long visitId;

    @Column(name = "planned_activity_id", nullable = false)
    private Long activityId;

    @Column(nullable = false, length = 200)
    private String value;

    @Column(length = 500)
    private String note;

    @Column(name = "recorded_by_user_id", nullable = false)
    private Long recordedByUserId;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    protected ActivityResult() {
    }

    /** Cria o primeiro resultado de uma atividade. */
    public ActivityResult(Long visitId, Long activityId, String value, String note,
                          Long recordedByUserId, Instant recordedAt) {
        this.visitId = visitId;
        this.activityId = activityId;
        replace(value, note, recordedByUserId, recordedAt);
    }

    /** Substitui integralmente o valor, a observação e os dados de autoria. */
    public void replace(String value, String note, Long recordedByUserId, Instant recordedAt) {
        this.value = value;
        this.note = note;
        this.recordedByUserId = recordedByUserId;
        this.recordedAt = recordedAt;
    }

    public Long getId() {
        return id;
    }

    public Long getVisitId() {
        return visitId;
    }

    public Long getActivityId() {
        return activityId;
    }

    public String getValue() {
        return value;
    }

    public String getNote() {
        return note;
    }

    public Long getRecordedByUserId() {
        return recordedByUserId;
    }

    public Instant getRecordedAt() {
        return recordedAt;
    }
}
