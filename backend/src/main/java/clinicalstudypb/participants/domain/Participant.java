package clinicalstudypb.participants.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Vínculo persistido de um candidato incluído como participante do estudo.
 * A gravação pela T15.1 deve adquirir antes o bloqueio público de operações do candidato.
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
    }

    /** @return identificador do participante */
    public Long getId() {
        return id;
    }

    /** @return estudo do participante */
    public Long getStudyId() {
        return studyId;
    }

    /** @return candidato que originou o participante */
    public Long getCandidateId() {
        return candidateId;
    }

    /** @return autor da inclusão */
    public Long getIncludedBy() {
        return includedBy;
    }

    /** @return instante da inclusão */
    public Instant getIncludedAt() {
        return includedAt;
    }
}
