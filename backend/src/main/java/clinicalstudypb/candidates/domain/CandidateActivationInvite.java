package clinicalstudypb.candidates.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Convite de uso único associado à conta, sem guardar o código em texto claro.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
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

    /** Construtor exigido pela JPA. */
    protected CandidateActivationInvite() {
    }

    /**
     * Cria o convite inicial de uma conta inativa.
     *
     * @param userId identificador da conta vinculada ao convite
     * @param codeHash resumo SHA-256 do código de ativação
     * @param createdAt instante de criação do convite
     * @param expiresAt instante de expiração do convite
     */
    public CandidateActivationInvite(Long userId, String codeHash, Instant createdAt, Instant expiresAt) {
        this.userId = userId;
        this.codeHash = codeHash;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    /**
     * Substitui o código anterior, invalidando-o imediatamente.
     *
     * @param nextHash resumo SHA-256 do novo código
     * @param created instante da nova emissão
     * @param expires novo instante de expiração
     */
    public void replace(String nextHash, Instant created, Instant expires) {
        codeHash = nextHash;
        createdAt = created;
        expiresAt = expires;
        usedAt = null;
    }

    /**
     * Registra o momento em que o convite foi consumido na definição da senha.
     *
     * @param now instante em que o convite foi utilizado
     */
    public void markUsed(Instant now) {
        usedAt = now;
    }

    /**
     * Retorna o instante de expiração do convite.
     *
     * @return instante limite de validade
     */
    public Instant getExpiresAt() {
        return expiresAt;
    }

    /**
     * Retorna o hash SHA-256 armazenado para o código atual.
     *
     * @return hash hexadecimal do código
     */
    public String getCodeHash() {
        return codeHash;
    }

    /**
     * Retorna o instante em que o convite foi utilizado, quando houver.
     *
     * @return instante de uso ou {@code null}
     */
    public Instant getUsedAt() {
        return usedAt;
    }
}
