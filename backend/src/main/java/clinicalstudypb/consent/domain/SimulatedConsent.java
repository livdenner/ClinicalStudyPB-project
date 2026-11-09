package clinicalstudypb.consent.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Última decisão simulada de um candidato, vinculada a ele por chave primária.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-07
 * @version 0.0.1
 */
@Entity
@Table(name = "simulated_consents")
public class SimulatedConsent {
    @Id
    @Column(name = "candidate_id")
    private Long candidateId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ConsentDecision status;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Column(name = "locked_after_inclusion", nullable = false)
    private boolean lockedAfterInclusion;

    /** Construtor usado pela JPA. */
    protected SimulatedConsent() {
    }

    /**
     * Cria uma decisão inicial.
     *
     * @param candidateId candidato ao qual pertence
     * @param status decisão simulada
     * @param recordedAt horário atribuído pelo servidor
     */
    public SimulatedConsent(Long candidateId, ConsentDecision status, Instant recordedAt) {
        this.candidateId = candidateId;
        this.status = status;
        this.recordedAt = recordedAt;
    }

    /**
     * Substitui uma decisão anterior enquanto não houve inclusão.
     *
     * @param nextStatus nova decisão
     * @param when horário da substituição
     */
    public void replace(ConsentDecision nextStatus, Instant when) {
        if (lockedAfterInclusion) {
            throw new ConsentConflictException("O consentimento não pode mudar após a inclusão.");
        }
        status = nextStatus;
        recordedAt = when;
    }

    /** Impede alterações posteriores à inclusão do candidato. */
    public void lockAfterInclusion() {
        if (status != ConsentDecision.GRANTED) {
            throw new ConsentConflictException("A inclusão exige consentimento concedido.");
        }
        lockedAfterInclusion = true;
    }

    /**
     * Consulta o candidato vinculado.
     *
     * @return identificador do candidato
     */
    public Long getCandidateId() {
        return candidateId;
    }

    /**
     * Consulta a última decisão.
     *
     * @return última decisão registrada
     */
    public ConsentDecision getStatus() {
        return status;
    }

    /**
     * Consulta o horário da decisão.
     *
     * @return horário da última decisão
     */
    public Instant getRecordedAt() {
        return recordedAt;
    }

    /**
     * Consulta o bloqueio da decisão.
     *
     * @return se a decisão foi bloqueada após inclusão
     */
    public boolean isLockedAfterInclusion() {
        return lockedAfterInclusion;
    }
}
