package clinicalstudypb.users.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Representa um usuário persistido na tabela {@code users}.
 * O hash da senha permanece interno e não compõe a resposta da API.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private UserRole role;

    @Column(nullable = false)
    private boolean active = true;

    /** Construtor exigido pela JPA para reconstruir a entidade do banco. */
    protected User() {
    }

    /**
     * Cria um usuário ativo com senha já codificada.
     *
     * @param name nome do usuário
     * @param email e-mail único do usuário
     * @param passwordHash hash da senha, nunca a senha em texto puro
     * @param role perfil de acesso inicial
     */
    public User(String name, String email, String passwordHash, UserRole role) {
        this.name = name;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
    }

    /**
     * Consulta o identificador do usuário.
     *
     * @return identificador gerado pelo banco
     */
    public Long getId() {
        return this.id;
    }

    /**
     * Consulta o nome do usuário.
     *
     * @return nome cadastrado
     */
    public String getName() {
        return this.name;
    }

    /**
     * Consulta o e-mail do usuário.
     *
     * @return e-mail cadastrado
     */
    public String getEmail() {
        return this.email;
    }

    /**
     * Consulta o hash interno para validar a senha durante a autenticação.
     * O hash não deve ser incluído em respostas da API.
     *
     * @return hash codificado da senha
     */
    public String getPasswordHash() {
        return this.passwordHash;
    }

    /**
     * Consulta o perfil de acesso do usuário.
     *
     * @return perfil de acesso do usuário
     */
    public UserRole getRole() {
        return this.role;
    }

    /**
     * Informa se o usuário pode ser considerado ativo.
     *
     * @return {@code true} quando o usuário está ativo
     */
    public boolean isActive() {
        return this.active;
    }

    /** Marca o usuário como ativo. */
    public void activate() {
        this.active = true;
    }

    /** Marca o usuário como inativo sem remover seu registro. */
    public void deactivate() {
        this.active = false;
    }

    /**
     * Atualiza os dados básicos após a validação feita pelo serviço.
     *
     * @param name novo nome
     * @param email novo e-mail
     */
    public void updateDetails(String name, String email) {
        this.name = name;
        this.email = email;
    }

    /**
     * Altera o perfil de acesso do usuário.
     *
     * @param role novo perfil
     */
    public void changeRole(UserRole role) {
        this.role = role;
    }
}
