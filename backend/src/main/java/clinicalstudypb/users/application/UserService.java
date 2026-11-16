package clinicalstudypb.users.application;

import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.users.domain.EmailAlreadyInUseException;
import clinicalstudypb.users.domain.ParticipantRoleNotAllowedException;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserConflictException;
import clinicalstudypb.users.domain.UserRole;
import clinicalstudypb.users.infrastructure.UserRepository;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coordena os casos de uso de cadastro e gestão de usuários.
 * Aplica regras de e-mail único e codifica senhas antes da persistência.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.2
 */
@Service
public class UserService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CurrentActor currentActor;

    /**
     * Recebe as dependências de persistência, codificação de senha e ator autenticado.
     *
     * @param userRepository repositório de usuários
     * @param passwordEncoder codificador compartilhado de senhas
     * @param currentActor ator autenticado na requisição atual
     */
    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, CurrentActor currentActor) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.currentActor = currentActor;
    }

    /**
     * Lista apenas as contas da equipe administradas pelo administrador.
     *
     * @return usuários encontrados
     */
    public List<User> listUsers() {
        return userRepository.findByRoleNot(UserRole.PARTICIPANT);
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

    /** Busca uma conta da equipe para as rotas administrativas. */
    public User getStaffUser(Long id) {
        User user = getUser(id);
        if (user.getRole() == UserRole.PARTICIPANT) {
            throw new ResourceNotFoundException("Usuário não encontrado: " + id);
        }
        return user;
    }

    /**
     * Localiza uma conta pelo e-mail para integração com outros módulos.
     *
     * @param email e-mail já normalizado
     * @return conta encontrada ou {@link Optional#empty()} se não existir
     */
    @Transactional(readOnly = true)
    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(email);
    }

    /**
     * Busca e bloqueia uma conta para alterações transacionais.
     *
     * @param id identificador do usuário
     * @return conta bloqueada ou {@link Optional#empty()} se não existir
     */
    @Transactional
    public Optional<User> findLockedById(Long id) {
        return userRepository.findForUpdate(id);
    }

    /**
     * Busca e bloqueia uma conta pelo e-mail para operações transacionais de candidatura ou ativação.
     *
     * @param email e-mail já normalizado
     * @return conta bloqueada ou {@link Optional#empty()} se não existir
     */
    @Transactional
    public Optional<User> findLockedByEmail(String email) {
        return userRepository.findForUpdateByEmail(email);
    }

    /** Persiste uma conta sem senha conhecida e bloqueada até a ativação. */
    @Transactional
    public User createInvitedParticipant(String name, String email) {
        String normalizedEmail = normalizeEmail(email);
        ensureEmailAvailable(normalizedEmail);
        byte[] secret = new byte[32];
        RANDOM.nextBytes(secret);
        String unusablePassword = Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
        User user = User.invitedParticipant(name.strip(), normalizedEmail,
                passwordEncoder.encode(unusablePassword));
        return userRepository.saveAndFlush(user);
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
        rejectParticipantRole(role);
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
        User user = getStaffUser(id);
        rejectParticipantRole(role);
        if (role != user.getRole()) {
            rejectSelfAccountChange(user.getId(), "O administrador não pode alterar o perfil da própria conta.");
            ensureNotLastActiveAdministrator(user);
        }
        String normalizedEmail = normalizeEmail(email);
        if (!user.getEmail().equalsIgnoreCase(normalizedEmail)) {
            ensureEmailAvailable(normalizedEmail);
        }
        user.updateDetails(name.strip(), normalizedEmail);
        user.changeRole(role);
        userRepository.flush();
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
        User user = getStaffUser(id);
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
        User user = getStaffUser(id);
        rejectSelfAccountChange(user.getId(), "O administrador não pode desativar a própria conta.");
        ensureNotLastActiveAdministrator(user);
        user.deactivate();
        userRepository.flush();
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
        User user = getStaffUser(id);
        rejectSelfAccountChange(user.getId(), "O administrador não pode excluir a própria conta.");
        ensureNotLastActiveAdministrator(user);
        userRepository.delete(user);
        userRepository.flush();
    }

    private void rejectSelfAccountChange(Long targetUserId, String message) {
        if (targetUserId != null && Objects.equals(targetUserId, currentActor.userId())) {
            throw new UserConflictException(UserConflictException.SELF_ACCOUNT_CHANGE_NOT_ALLOWED, message);
        }
    }

    private void ensureNotLastActiveAdministrator(User target) {
        if (target.getRole() != UserRole.ADMINISTRATOR || !target.isActive()) {
            return;
        }
        List<User> activeAdmins = userRepository.lockActiveByRoleOrderByIdAsc(UserRole.ADMINISTRATOR);
        boolean anotherActiveAdminExists = activeAdmins.stream()
                .anyMatch(admin -> !Objects.equals(admin.getId(), target.getId()));
        if (!anotherActiveAdminExists) {
            throw new UserConflictException(
                    UserConflictException.LAST_ACTIVE_ADMINISTRATOR,
                    "O sistema deve manter pelo menos um administrador ativo.");
        }
    }

    private void rejectParticipantRole(UserRole role) {
        if (role == UserRole.PARTICIPANT) {
            throw new ParticipantRoleNotAllowedException();
        }
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
