package clinicalstudypb.users.api;

import clinicalstudypb.users.application.UserService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Expõe as operações HTTP de cadastro e manutenção de usuários.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('ADMINISTRATOR')")
public class UserController {

    private final UserService userService;

    /**
     * Cria o controlador com o serviço responsável pelas regras de usuário.
     *
     * @param userService serviço de usuários
     */
    public UserController(UserService userService) {
        this.userService = userService;
    }

    /**
     * Lista todos os usuários sem expor os hashes de senha.
     *
     * @return representações públicas dos usuários
     */
    @GetMapping
    public List<UserResponse> listUsers() {
        return userService.listUsers().stream().map(UserResponse::from).toList();
    }

    /**
     * Consulta um usuário pelo identificador.
     *
     * @param id identificador do usuário
     * @return representação pública do usuário
     */
    @GetMapping("/{id}")
    public UserResponse getUser(@PathVariable Long id) {
        return UserResponse.from(userService.getUser(id));
    }

    /**
     * Cadastra um usuário e informa a localização do novo recurso.
     *
     * @param request dados validados para cadastro
     * @return resposta HTTP 201 com o usuário e o cabeçalho Location
     */
    @PostMapping
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        var user = userService.createUser(
                request.name(), request.email(), request.password(), request.role());
        return ResponseEntity.created(URI.create("/api/users/" + user.getId()))
                .body(UserResponse.from(user));
    }

    /**
     * Atualiza nome, e-mail e perfil de um usuário.
     *
     * @param id identificador do usuário
     * @param request dados validados para atualização
     * @return representação pública atualizada
     */
    @PutMapping("/{id}")
    public UserResponse updateUser(@PathVariable Long id, @Valid @RequestBody UpdateUserRequest request) {
        return UserResponse.from(userService.updateUser(id, request.name(), request.email(), request.role()));
    }

    /**
     * Reativa um usuário existente.
     *
     * @param id identificador do usuário
     * @return representação pública com o usuário ativo
     */
    @PatchMapping("/{id}/activate")
    public UserResponse activateUser(@PathVariable Long id) {
        return UserResponse.from(userService.activateUser(id));
    }

    /**
     * Desativa um usuário existente.
     *
     * @param id identificador do usuário
     * @return representação pública com o usuário inativo
     */
    @PatchMapping("/{id}/deactivate")
    public UserResponse deactivateUser(@PathVariable Long id) {
        return UserResponse.from(userService.deactivateUser(id));
    }

    /**
     * Remove um usuário existente.
     *
     * @param id identificador do usuário
     * @return resposta HTTP 204 sem corpo
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
