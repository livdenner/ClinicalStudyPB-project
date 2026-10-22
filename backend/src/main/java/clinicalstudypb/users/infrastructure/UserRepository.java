package clinicalstudypb.users.infrastructure;

import clinicalstudypb.users.domain.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Acessa usuários persistidos por meio do Spring Data JPA.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Localiza um usuário pelo e-mail informado.
     *
     * @param email e-mail cadastrado
     * @return usuário encontrado ou vazio
     */
    Optional<User> findByEmail(String email);

    /**
     * Verifica se já existe um usuário com o e-mail, sem diferenciar maiúsculas.
     *
     * @param email e-mail a verificar
     * @return {@code true} quando o e-mail já está em uso
     */
    boolean existsByEmailIgnoreCase(String email);
}
