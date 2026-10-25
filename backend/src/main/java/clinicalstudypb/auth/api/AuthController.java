package clinicalstudypb.auth.api;

import clinicalstudypb.auth.application.AuthService;
import clinicalstudypb.users.api.UserResponse;
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
 * @version 0.0.1
 */
@RestController
@RequestMapping("/api/v1/auth")
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
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().build();
    }
}
