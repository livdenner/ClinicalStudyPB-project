package clinicalstudypb.auth.api;

import clinicalstudypb.auth.domain.InvalidCredentialsException;
import java.util.List;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Converte erros de entrada e credenciais do controller de autenticação para o contrato da API.
 *
 * @author Lívia
 * @since 2026-10-23
 * @version 0.0.1
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = AuthController.class)
public class AuthExceptionHandler {

    /** Cria o tratador de erros das requisições de autenticação. */
    public AuthExceptionHandler() {
    }

    /**
     * Retorna um erro genérico para credenciais inválidas ou conta inativa.
     *
     * @param exception erro de autenticação
     * @return resposta HTTP 401
     */
    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<AuthErrorResponse> handleInvalidCredentials(InvalidCredentialsException exception) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new AuthErrorResponse("INVALID_CREDENTIALS", exception.getMessage()));
    }

    /**
     * Converte falhas de validação dos dados de login em erro HTTP 400.
     *
     * @param exception erros de validação do corpo da requisição
     * @return resposta HTTP 400 com erros por campo
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<AuthValidationErrorResponse> handleInvalidRequest(
            MethodArgumentNotValidException exception
    ) {
        List<AuthValidationErrorResponse.FieldErrorResponse> fieldErrors = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::toFieldError)
                .toList();
        return ResponseEntity.badRequest()
                .body(new AuthValidationErrorResponse("INVALID_REQUEST", "Dados de login inválidos.", fieldErrors));
    }

    private AuthValidationErrorResponse.FieldErrorResponse toFieldError(FieldError fieldError) {
        return new AuthValidationErrorResponse.FieldErrorResponse(
                fieldError.getField(), fieldError.getDefaultMessage());
    }
}
