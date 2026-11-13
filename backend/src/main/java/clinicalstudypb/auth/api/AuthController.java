package clinicalstudypb.auth.api;

import clinicalstudypb.auth.application.ActivationService;
import clinicalstudypb.auth.application.AuthService;
import clinicalstudypb.auth.application.PasswordChangeService;
import clinicalstudypb.users.api.UserResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Expõe os endpoints de autenticação, ativação e senha previstos no contrato da API.
 *
 * @author Lívia
 * @since 2026-10-23
 * @version 0.0.3
 */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Autenticação", description = "Endpoints de login e logout")
public class AuthController {

    private final AuthService authService;
    private final ActivationService activationService;
    private final PasswordChangeService passwordChangeService;

    /**
     * Cria o controller com os casos de uso de autenticação.
     *
     * @param authService serviço de autenticação
     * @param activationService serviço de ativação de conta de participante
     * @param passwordChangeService serviço de definição inicial e alteração de senha
     */
    public AuthController(
            AuthService authService,
            ActivationService activationService,
            PasswordChangeService passwordChangeService
    ) {
        this.authService = authService;
        this.activationService = activationService;
        this.passwordChangeService = passwordChangeService;
    }

    /**
     * Autentica uma conta e retorna um JWT.
     *
     * @param request credenciais enviadas pelo cliente
     * @return token e dados públicos do usuário
     */
    @PostMapping("/login")
    @Operation(summary = "Autentica usuário e retorna JWT")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return toLoginResponse(authService.login(request.email(), request.password()));
    }

    /**
     * Inicia a sessão restrita do participante a partir do código enviado no mobile.
     *
     * @param request e-mail e código de ativação informados no aplicativo
     * @return token restrito até a definição da senha
     */
    @PostMapping("/activation")
    @Operation(summary = "Ativa a conta do candidato e exige definição de senha")
    public LoginResponse activation(@Valid @RequestBody ActivationRequest request) {
        return toLoginResponse(activationService.activate(request.email(), request.activationCode()));
    }

    /**
     * Define a senha no primeiro acesso ou altera a senha da conta autenticada.
     *
     * @param request senha atual (quando exigida) e nova senha
     * @return novo token sem restrição de primeiro acesso e dados públicos do usuário
     */
    @PutMapping("/password")
    @Operation(summary = "Define ou troca a senha do usuário autenticado",
            security = @SecurityRequirement(name = "bearerAuth"))
    public LoginResponse changePassword(@RequestBody PasswordChangeRequest request) {
        return toLoginResponse(passwordChangeService.changePassword(
                request.currentPassword(), request.newPassword()));
    }

    /**
     * Confirma o logout no cliente; com JWT stateless o cliente descarta o token.
     * O acesso a este método já exige um token válido na configuração de segurança.
     *
     * @return resposta HTTP 204 sem conteúdo
     */
    @PostMapping("/logout")
    @Operation(summary = "Encerra a sessão do usuário",
            security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().build();
    }

    private LoginResponse toLoginResponse(AuthService.AuthenticatedUser authenticated) {
        return new LoginResponse(
                authenticated.token().value(),
                "Bearer",
                authenticated.token().expiresIn(),
                UserResponse.from(authenticated.user()));
    }
}
