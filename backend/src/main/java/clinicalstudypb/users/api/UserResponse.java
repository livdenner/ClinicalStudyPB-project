package clinicalstudypb.users.api;

import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;

/**
 * Representação pública de um usuário sem senha ou hash.
 *
 * @param id identificador do usuário
 * @param name nome cadastrado
 * @param email e-mail cadastrado
 * @param role perfil de acesso
 * @param active situação de ativação
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
public record UserResponse(
        Long id,
        String name,
        String email,
        UserRole role,
        boolean active
) {
    /**
     * Converte uma entidade em uma resposta segura para a API.
     *
     * @param user entidade de usuário
     * @return resposta sem o hash da senha
     */
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(), user.getName(), user.getEmail(), user.getRole(), user.isActive());
    }
}
