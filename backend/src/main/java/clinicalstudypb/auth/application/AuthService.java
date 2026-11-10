package clinicalstudypb.auth.application;

import clinicalstudypb.auth.domain.InvalidCredentialsException;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.User;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Executa o caso de uso de autenticação de um usuário.
 *
 * @author Lívia
 * @since 2026-10-23
 * @version 0.0.1
 */
@Service
public class AuthService {

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    /**
     * Recebe os componentes necessários para consultar a conta, conferir a senha e emitir o token.
     *
     * @param userService serviço de usuários usado como integração entre módulos
     * @param passwordEncoder codificador DelegatingPasswordEncoder compartilhado
     * @param jwtService serviço responsável pela emissão de JWT
     */
    public AuthService(
            UserService userService,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    /**
     * Autentica uma conta ativa e emite seu token de acesso.
     *
     * @param email e-mail informado
     * @param password senha em texto recebida nesta requisição
     * @return token, validade e dados públicos da conta
     * @throws InvalidCredentialsException se o e-mail, senha ou situação da conta forem inválidos
     */
    @Transactional(readOnly = true)
    public AuthenticatedUser login(String email, String password) {
        String normalizedEmail = email.strip().toLowerCase(Locale.ROOT);
        User user = userService.findByEmail(normalizedEmail)
                .orElseThrow(InvalidCredentialsException::new);

        boolean passwordMatches = passwordEncoder.matches(password, user.getPasswordHash());
        if (!user.isActive() || !passwordMatches) {
            throw new InvalidCredentialsException();
        }

        JwtToken token = jwtService.issue(user);
        return new AuthenticatedUser(token, user);
    }

    /** Resultado interno do caso de uso, convertido para DTO HTTP pelo controller.
     *
     * @param token token emitido
     * @param user conta autenticada
     */
    public record AuthenticatedUser(JwtToken token, User user) {
    }
}
