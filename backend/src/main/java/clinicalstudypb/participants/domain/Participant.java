package clinicalstudypb.participants.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

/**
 * Vínculo persistido de um candidato incluído como participante do estudo.
 * A inclusão adquire antes os bloqueios públicos do estudo e do candidato.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
@Entity
@Table(name = "participants")
public class Participant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "study_id", nullable = false)
    private Long studyId;

    @Column(name = "candidate_id", nullable = false, unique = true)
    private Long candidateId;

    @Column(name = "included_by", nullable = false)
    private Long includedBy;

    @Column(name = "included_at", nullable = false)
    private Instant includedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ParticipantStatus status;

    @Column(name = "withdrawal_reason", length = 500)
    private String withdrawalReason;

    @Column(name = "withdrawn_at")
    private Instant withdrawnAt;

    @Column(name = "withdrawn_by_user_id")
    private Long withdrawnByUserId;

    @Column(name = "withdrawal_cancelled_visit_count")
    private Integer withdrawalCancelledVisitCount;

    /** Construtor exigido pela JPA. */
    protected Participant() {
    }

    /**
     * Registra o vínculo após as validações de inclusão do módulo de participantes.
     *
     * @param studyId estudo do candidato
     * @param candidateId candidato incluído
     * @param includedBy usuário que realizou a inclusão
     * @param includedAt instante da inclusão
     */
    public Participant(Long studyId, Long candidateId, Long includedBy, Instant includedAt) {
        this.studyId = studyId;
        this.candidateId = candidateId;
        this.includedBy = includedBy;
        this.includedAt = includedAt;
        this.status = ParticipantStatus.ACTIVE;
    }

    /**
     * Retorna identificador do participante.
     *
     * @return identificador do participante
     */
    public Long getId() {
        return id;
    }

    /**
     * Retorna estudo do participante.
     *
     * @return estudo do participante
     */
    public Long getStudyId() {
        return studyId;
    }

    /**
     * Retorna candidato que originou o participante.
     *
     * @return candidato que originou o participante
     */
    public Long getCandidateId() {
        return candidateId;
    }

    /**
     * Retorna autor da inclusão.
     *
     * @return autor da inclusão
     */
    public Long getIncludedBy() {
        return includedBy;
    }

    /**
     * Retorna instante da inclusão.
     *
     * @return instante da inclusão
     */
    public Instant getIncludedAt() {
        return includedAt;
    }

    /**
     * Retorna a situação do participante no acompanhamento.
     *
     * @return {@link ParticipantStatus#ACTIVE} ou {@link ParticipantStatus#WITHDRAWN}
     */
    public ParticipantStatus getStatus() {
        return status;
    }

    /**
     * Indica se o participante foi retirado do estudo.
     *
     * @return {@code true} quando o estado é {@link ParticipantStatus#WITHDRAWN}
     */
    public boolean isWithdrawn() {
        return status == ParticipantStatus.WITHDRAWN;
    }

    /**
     * Registra a retirada definitiva do participante (RF16). As regras de estado do estudo,
     * de autorização e de retirada duplicada são conferidas antes pelo serviço; esta
     * verificação protege a invariante caso o método seja chamado fora desse fluxo.
     *
     * @param reason motivo já normalizado, sem espaços nas extremidades
     * @param occurredAt instante da retirada
     * @param actorUserId coordenador que registrou a retirada
     * @param cancelledVisitCount visitas futuras canceladas na mesma operação
     * @throws IllegalStateException se o participante já foi retirado
     * @throws IllegalArgumentException se o motivo estiver vazio ou a contagem for negativa
     */
    public void withdraw(String reason, Instant occurredAt, Long actorUserId, int cancelledVisitCount) {
        if (isWithdrawn()) {
            throw new IllegalStateException("O participante já foi retirado.");
        }
        Objects.requireNonNull(reason, "reason");
        Objects.requireNonNull(occurredAt, "occurredAt");
        Objects.requireNonNull(actorUserId, "actorUserId");
        if (reason.isBlank()) {
            throw new IllegalArgumentException("O motivo da retirada é obrigatório.");
        }
        if (cancelledVisitCount < 0) {
            throw new IllegalArgumentException("A quantidade de visitas canceladas não pode ser negativa.");
        }
        this.withdrawalReason = reason;
        this.withdrawnAt = occurredAt;
        this.withdrawnByUserId = actorUserId;
        this.withdrawalCancelledVisitCount = cancelledVisitCount;
        this.status = ParticipantStatus.WITHDRAWN;
    }

    /**
     * Retorna o motivo da retirada.
     *
     * @return motivo informado pelo coordenador ou {@code null} para participante ativo
     */
    public String getWithdrawalReason() {
        return withdrawalReason;
    }

    /**
     * Retorna o instante da retirada.
     *
     * @return instante registrado pelo servidor ou {@code null} para participante ativo
     */
    public Instant getWithdrawnAt() {
        return withdrawnAt;
    }

    /**
     * Retorna o autor da retirada.
     *
     * @return coordenador que registrou a retirada ou {@code null} para participante ativo
     */
    public Long getWithdrawnByUserId() {
        return withdrawnByUserId;
    }

    /**
     * Retorna quantas visitas futuras foram canceladas pela retirada.
     *
     * @return quantidade de visitas canceladas ou {@code null} para participante ativo
     */
    public Integer getWithdrawalCancelledVisitCount() {
        return withdrawalCancelledVisitCount;
    }
}
