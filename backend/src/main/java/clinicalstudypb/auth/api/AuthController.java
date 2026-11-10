package clinicalstudypb.auth.api;

import clinicalstudypb.auth.application.AuthService;
import clinicalstudypb.users.api.UserResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Expõe os endpoints de login e logout previstos no contrato da API.
 *
 * @author Lívia
 * @since 2026-10-23
 * @version 0.0.2
 */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Autenticação", description = "Endpoints de login e logout")
public class AuthController {

    private final AuthService authService;

    /**
     * Cria o controller com o caso de uso de autenticação.
     *
     * @param authService serviço de autenticação
     */
    public AuthController(AuthService authService) {
        this.authService = authService;
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
        AuthService.AuthenticatedUser authenticated = authService.login(request.email(), request.password());
        return new LoginResponse(
                authenticated.token().value(),
                "Bearer",
                authenticated.token().expiresIn(),
                UserResponse.from(authenticated.user()));
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
}
