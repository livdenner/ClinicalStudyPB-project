package clinicalstudypb.shared;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * Recupera o identificador do usuário autenticado no JWT.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
@Component
public class CurrentActor {

    /** Cria o leitor do contexto de autenticação. */
    public CurrentActor() {
    }

    /**
     * Lê o identificador do usuário autenticado.
     *
     * @return identificador do usuário
     */
    public Long userId() {
        if (SecurityContextHolder.getContext().getAuthentication()
                instanceof JwtAuthenticationToken authentication
                && authentication.getToken().getClaim("userId") instanceof Number id) {
            return id.longValue();
        }
        throw new AccessDeniedException("Não foi possível identificar o usuário autenticado.");
    }
}
