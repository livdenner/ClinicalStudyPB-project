package clinicalstudypb.auth.application;

import clinicalstudypb.auth.domain.InvalidCredentialsException;
import clinicalstudypb.auth.domain.PasswordChangeException;
import clinicalstudypb.candidates.application.CandidateInvitationService;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.User;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Executa a definição inicial da senha do candidato e a troca de senha de usuários autenticados.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
@Service
public class PasswordChangeService {

    private static final int MAX_BCRYPT_BYTES = 72;
    private static final Pattern PASSWORD_PATTERN = Pattern.compile("^(?=.*[A-Za-z])(?=.*[0-9]).{8,72}$");

    private final CurrentActor currentActor;
    private final UserService userService;
    private final CandidateInvitationService invitationService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    /**
     * Cria o serviço de definição e alteração de senha.
     *
     * @param currentActor leitor do identificador do usuário no JWT
     * @param userService serviço de contas para leitura com bloqueio e persistência
     * @param invitationService serviço de convites para consumo no primeiro acesso
     * @param passwordEncoder codificador BCrypt compartilhado
     * @param jwtService emissor do novo token irrestrito
     */
    public PasswordChangeService(
            CurrentActor currentActor,
            UserService userService,
            CandidateInvitationService invitationService,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.currentActor = currentActor;
        this.userService = userService;
        this.invitationService = invitationService;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    /**
     * Atualiza a senha da conta autenticada e conclui a ativação pendente, quando houver.
     *
     * @param currentPassword senha atual (dispensada somente enquanto {@code activationPending=true})
     * @param newPassword nova senha em texto puro recebida nesta requisição
     * @return nova sessão JWT sem restrição de primeiro acesso e dados públicos da conta
     */
    @Transactional
    public AuthService.AuthenticatedUser changePassword(String currentPassword, String newPassword) {
        Long userId = currentActor.userId();
        User user = userService.findLockedById(userId)
                .filter(User::isActive)
                .orElseThrow(InvalidCredentialsException::new);

        boolean firstAccess = user.isActivationPending();
        if (!firstAccess && !matchesCurrentPassword(currentPassword, user.getPasswordHash())) {
            throw PasswordChangeException.currentPasswordInvalid();
        }
        if (!satisfiesPolicy(newPassword)) {
            throw PasswordChangeException.policy();
        }

        user.changePassword(passwordEncoder.encode(newPassword));
        if (firstAccess) {
            user.activate();
            invitationService.consume(user.getId());
        }
        return new AuthService.AuthenticatedUser(jwtService.issue(user), user);
    }

    private boolean matchesCurrentPassword(String currentPassword, String passwordHash) {
        return currentPassword != null
                && !currentPassword.isEmpty()
                && passwordEncoder.matches(currentPassword, passwordHash);
    }

    private boolean satisfiesPolicy(String newPassword) {
        return newPassword != null
                && newPassword.getBytes(StandardCharsets.UTF_8).length <= MAX_BCRYPT_BYTES
                && PASSWORD_PATTERN.matcher(newPassword).matches();
    }
}
