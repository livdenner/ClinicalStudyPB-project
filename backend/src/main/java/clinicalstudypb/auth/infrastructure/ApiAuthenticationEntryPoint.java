package clinicalstudypb.auth.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import clinicalstudypb.auth.api.AuthErrorResponse;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

/** Retorna erros de autenticação no formato documentado pela API.
 *
 * @author Lívia
 * @since 2026-10-23
 * @version 0.0.1
 */
@Component
public class ApiAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    /**
     * Recebe o serializador JSON da aplicação.
     *
     * @param objectMapper serializador configurado pelo Spring Boot
     */
    public ApiAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /** {@inheritDoc} */
    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception
    ) throws IOException, ServletException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(),
                new AuthErrorResponse("UNAUTHORIZED", "Token ausente ou inválido."));
    }
}
