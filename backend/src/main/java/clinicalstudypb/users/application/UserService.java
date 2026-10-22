package clinicalstudypb.users.application;

import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.users.domain.EmailAlreadyInUseException;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import clinicalstudypb.users.infrastructure.UserRepository;
import java.util.List;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coordena os casos de uso de cadastro e gestão de usuários.
 * Aplica regras de e-mail único e codifica senhas antes da persistência.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Recebe as dependências de persistência e codificação de senha.
     *
     * @param userRepository repositório de usuários
     * @param passwordEncoder codificador compartilhado de senhas
     */
    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Lista os usuários cadastrados.
     *
     * @return usuários encontrados
     */
    public List<User> listUsers() {
        return userRepository.findAll();
    }

    /**
     * Busca um usuário pelo identificador.
     *
     * @param id identificador do usuário
     * @return usuário encontrado
     * @throws ResourceNotFoundException se o identificador não existir
     */
    public User getUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Usuário não encontrado: " + id));
    }

    /**
     * Cadastra um usuário com e-mail normalizado e senha codificada.
     *
     * @param name nome informado no cadastro
     * @param email e-mail informado no cadastro
     * @param password senha em texto puro recebida apenas para codificação
     * @param role perfil inicial
     * @return usuário persistido
     * @throws EmailAlreadyInUseException se o e-mail já estiver cadastrado
     */
    @Transactional
    public User createUser(String name, String email, String password, UserRole role) {
        String normalizedEmail = normalizeEmail(email);
        ensureEmailAvailable(normalizedEmail);
        User user = new User(name.strip(), normalizedEmail, passwordEncoder.encode(password), role);
        return userRepository.save(user);
    }

    /**
     * Atualiza nome, e-mail e perfil de um usuário existente.
     * A transação permite que a JPA grave as alterações da entidade gerenciada.
     *
     * @param id identificador do usuário
     * @param name novo nome
     * @param email novo e-mail
     * @param role novo perfil
     * @return usuário atualizado
     * @throws ResourceNotFoundException se o usuário não existir
     * @throws EmailAlreadyInUseException se o novo e-mail já estiver em uso
     */
    @Transactional
    public User updateUser(Long id, String name, String email, UserRole role) {
        User user = getUser(id);
        String normalizedEmail = normalizeEmail(email);
        if (!user.getEmail().equalsIgnoreCase(normalizedEmail)) {
            ensureEmailAvailable(normalizedEmail);
        }
        user.updateDetails(name.strip(), normalizedEmail);
        user.changeRole(role);
        return user;
    }

    /**
     * Ativa um usuário existente.
     *
     * @param id identificador do usuário
     * @return usuário ativo
     * @throws ResourceNotFoundException se o usuário não existir
     */
    @Transactional
    public User activateUser(Long id) {
        User user = getUser(id);
        user.activate();
        return user;
    }

    /**
     * Desativa um usuário sem apagar seu registro.
     *
     * @param id identificador do usuário
     * @return usuário inativo
     * @throws ResourceNotFoundException se o usuário não existir
     */
    @Transactional
    public User deactivateUser(Long id) {
        User user = getUser(id);
        user.deactivate();
        return user;
    }

    /**
     * Remove permanentemente um usuário existente.
     *
     * @param id identificador do usuário
     * @throws ResourceNotFoundException se o usuário não existir
     */
    @Transactional
    public void deleteUser(Long id) {
        userRepository.delete(getUser(id));
    }

    private void ensureEmailAvailable(String email) {
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new EmailAlreadyInUseException(email);
        }
    }

    private String normalizeEmail(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }
}
