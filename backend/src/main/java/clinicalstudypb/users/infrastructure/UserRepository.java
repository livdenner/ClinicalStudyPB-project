package clinicalstudypb.users.infrastructure;

import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Acessa usuários persistidos por meio do Spring Data JPA.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
public interface UserRepository extends JpaRepository<User, Long> {

    /** Lista apenas as contas da equipe administradas por /api/users. */
    List<User> findByRoleNot(UserRole role);

    /**
     * Bloqueia o usuário para alterações transacionais de credenciais e convites.
     *
     * @param id identificador do usuário
     * @return conta bloqueada para escrita ou vazio
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.id = :id")
    Optional<User> findForUpdate(@Param("id") Long id);

    /**
     * Bloqueia a conta pelo e-mail normalizado sem diferenciar maiúsculas e minúsculas.
     *
     * @param email e-mail a localizar
     * @return conta bloqueada para escrita ou vazio
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE LOWER(u.email) = LOWER(:email)")
    Optional<User> findForUpdateByEmail(@Param("email") String email);

    /**
     * Localiza um usuário pelo e-mail informado.
     *
     * @param email e-mail cadastrado
     * @return usuário encontrado ou vazio
     */
    Optional<User> findByEmail(String email);

    /** Localiza a identidade sem diferenciar maiúsculas e minúsculas. */
    Optional<User> findByEmailIgnoreCase(String email);

    /**
     * Verifica se já existe um usuário com o e-mail, sem diferenciar maiúsculas.
     *
     * @param email e-mail a verificar
     * @return {@code true} quando o e-mail já está em uso
     */
    boolean existsByEmailIgnoreCase(String email);
}
