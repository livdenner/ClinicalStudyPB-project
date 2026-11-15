package clinicalstudypb.candidates.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Candidato persistido e vinculado a um estudo clínico.
 *
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
@Entity
@Table(name = "candidates")
public class Candidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "study_id", nullable = false)
    private Long studyId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "name_key", nullable = false, length = 360)
    private String nameKey;

    @Column(nullable = false)
    private Integer age;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(nullable = false, length = 20)
    private String phone;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "eligibility_status", nullable = false, length = 20)
    private EligibilityStatus eligibilityStatus = EligibilityStatus.PENDING;

    @Column(name = "cancellation_reason", length = 500)
    private String cancellationReason;

    @Column(name = "cancelled_at")
    private java.time.Instant cancelledAt;

    @Column(name = "cancelled_by_user_id")
    private Long cancelledByUserId;

    /** Construtor exigido pela JPA para reconstruir a entidade persistida. */
    protected Candidate() {
    }

    /**
     * Cria um candidato vinculado ao estudo e à conta de participante informados.
     *
     * @param studyId identificador do estudo
     * @param name nome exibido
     * @param nameKey nome normalizado usado para detectar duplicidade
     * @param age idade informada
     * @param email e-mail normalizado da conta vinculada
     * @param phone telefone informado no cadastro
     * @param userId identificador da conta PARTICIPANT vinculada
     */
    public Candidate(Long studyId, String name, String nameKey, Integer age,
                     String email, String phone, Long userId) {
        this.studyId = studyId;
        this.name = name;
        this.nameKey = nameKey;
        this.age = age;
        this.email = email;
        this.phone = phone;
        this.userId = userId;
        this.eligibilityStatus = EligibilityStatus.PENDING;
    }

    /**
     * Mantém a criação em memória usada por testes de regras que não gravam candidatos.
     *
     * @param studyId identificador do estudo
     * @param name nome exibido
     * @param nameKey nome normalizado do candidato
     * @param age idade informada
     */
    public Candidate(Long studyId, String name, String nameKey, Integer age) {
        this(studyId, name, nameKey, age, null, null, null);
    }

    /**
     * Retorna o e-mail normalizado da conta vinculada.
     *
     * @return endereço de e-mail da conta
     */
    public String getEmail() {
        return email;
    }

    /**
     * Retorna o telefone informado no cadastro.
     *
     * @return número de telefone com DDD
     */
    public String getPhone() {
        return phone;
    }

    /**
     * Retorna o identificador da conta PARTICIPANT vinculada.
     *
     * @return identificador do usuário associado
     */
    public Long getUserId() {
        return userId;
    }

    /**
     * Consulta o identificador persistido.
     *
     * @return identificador do candidato
     */
    public Long getId() {
        return id;
    }

    /**
     * Consulta o estudo ao qual o candidato pertence.
     *
     * @return identificador do estudo
     */
    public Long getStudyId() {
        return studyId;
    }

    /**
     * Consulta o nome do candidato.
     *
     * @return nome exibido
     */
    public String getName() {
        return name;
    }

    /**
     * Consulta a idade informada no cadastro.
     *
     * @return idade do candidato
     */
    public Integer getAge() {
        return age;
    }

    /**
     * Consulta o resultado de elegibilidade do candidato.
     *
     * @return estado da avaliação
     */
    public EligibilityStatus getEligibilityStatus() {
        return eligibilityStatus;
    }

    /**
     * Atualiza o resultado calculado na mesma transação das respostas de elegibilidade.
     *
     * @param status resultado da avaliação atual
     */
    public void updateEligibilityStatus(EligibilityStatus status) {
        this.eligibilityStatus = java.util.Objects.requireNonNull(status);
    }

    /**
     * Indica se a candidatura foi cancelada antes da inclusão.
     *
     * @return {@code true} quando há data de cancelamento registrada
     */
    public boolean isCancelled() {
        return cancelledAt != null;
    }

    /**
     * Retorna o motivo informado no cancelamento, quando cancelado.
     *
     * @return justificativa do cancelamento ou {@code null}
     */
    public String getCancellationReason() {
        return cancellationReason;
    }

    /**
     * Retorna o instante em que a candidatura foi cancelada, quando cancelado.
     *
     * @return instante do cancelamento ou {@code null}
     */
    public java.time.Instant getCancelledAt() {
        return cancelledAt;
    }

    /**
     * Retorna o identificador do usuário autor do cancelamento, quando cancelado.
     *
     * @return identificador do autor ou {@code null}
     */
    public Long getCancelledByUserId() {
        return cancelledByUserId;
    }

    /**
     * Registra o cancelamento irreversível da candidatura antes da inclusão.
     *
     * @param reason motivo normalizado do cancelamento
     * @param cancelledAt instante do cancelamento
     * @param cancelledByUserId identificador do usuário autor
     */
    public void cancel(String reason, java.time.Instant cancelledAt, Long cancelledByUserId) {
        this.cancellationReason = java.util.Objects.requireNonNull(reason);
        this.cancelledAt = java.util.Objects.requireNonNull(cancelledAt);
        this.cancelledByUserId = java.util.Objects.requireNonNull(cancelledByUserId);
    }
}
