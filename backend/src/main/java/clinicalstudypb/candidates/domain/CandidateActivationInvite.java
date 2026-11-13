package clinicalstudypb.candidates.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Convite de uso único associado à conta, sem guardar o código em texto claro. */
@Entity
@Table(name = "candidate_activation_invites")
public class CandidateActivationInvite {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "code_hash", nullable = false, length = 64)
    private String codeHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    protected CandidateActivationInvite() {
    }

    /** Cria o convite inicial de uma conta inativa. */
    public CandidateActivationInvite(Long userId, String codeHash, Instant createdAt, Instant expiresAt) {
        this.userId = userId;
        this.codeHash = codeHash;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    /** Substitui o código anterior, invalidando-o imediatamente. */
    public void replace(String nextHash, Instant created, Instant expires) {
        codeHash = nextHash;
        createdAt = created;
        expiresAt = expires;
        usedAt = null;
    }

    /** Registra o momento em que o convite foi consumido na definição da senha. */
    public void markUsed(Instant now) {
        usedAt = now;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public String getCodeHash() {
        return codeHash;
    }

    public Instant getUsedAt() {
        return usedAt;
    }
}
