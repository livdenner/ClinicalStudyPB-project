package clinicalstudypb.auth.application;

import clinicalstudypb.auth.domain.ActivationException;
import clinicalstudypb.candidates.application.CandidateInvitationService;
import clinicalstudypb.candidates.domain.CandidateActivationInvite;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.Instant;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Valida o convite e inicia o primeiro acesso do participante.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
@Service
public class ActivationService {

    private final UserService userService;
    private final CandidateInvitationService invitationService;
    private final JwtService jwtService;

    /**
     * Inicializa os colaboradores necessários para validar convites e emitir sessão.
     *
     * @param userService serviço de consulta e bloqueio de contas
     * @param invitationService serviço de verificação dos códigos de convite
     * @param jwtService emissor de tokens JWT para a sessão inicial
     */
    public ActivationService(UserService userService, CandidateInvitationService invitationService,
                             JwtService jwtService) {
        this.userService = userService;
        this.invitationService = invitationService;
        this.jwtService = jwtService;
    }

    /**
     * Ativa a conta e emite uma sessão que exige definição de senha.
     *
     * @param email e-mail da conta convidada
     * @param code código de ativação informado pelo participante
     * @return sessão autenticada associada à conta ativada
     */
    @Transactional
    public AuthService.AuthenticatedUser activate(String email, String code) {
        User user = userService.findLockedByEmail(email.strip().toLowerCase(Locale.ROOT))
                .orElseThrow(ActivationException::invalid);
        if (user.getRole() != UserRole.PARTICIPANT || !user.isActivationPending()) {
            throw ActivationException.invalid();
        }
        CandidateActivationInvite invitation = invitationService.find(user.getId())
                .orElseThrow(ActivationException::invalid);
        if (invitation.getUsedAt() != null || !invitationService.matches(invitation, code)) {
            throw ActivationException.invalid();
        }
        if (!invitation.getExpiresAt().isAfter(Instant.now())) {
            throw ActivationException.expired();
        }
        user.beginActivation();
        return new AuthService.AuthenticatedUser(jwtService.issue(user), user);
    }
}
