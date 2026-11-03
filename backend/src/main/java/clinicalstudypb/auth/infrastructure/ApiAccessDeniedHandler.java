package clinicalstudypb.auth.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import clinicalstudypb.auth.api.AuthErrorResponse;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/** Retorna acessos negados por perfil (403) no formato documentado pela API.
 *
 * @author Júlia Pamplona
 * @since 2026-10-30
 * @version 0.0.1
 */
@Component
public class ApiAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    /**
     * Recebe o serializador JSON da aplicação.
     *
     * @param objectMapper serializador configurado pelo Spring Boot
     */
    public ApiAccessDeniedHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /** {@inheritDoc} */
    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException exception
    ) throws IOException, ServletException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(),
                new AuthErrorResponse("FORBIDDEN", "Perfil sem permissão para a operação."));
    }
}
