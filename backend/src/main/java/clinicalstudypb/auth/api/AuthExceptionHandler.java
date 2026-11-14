package clinicalstudypb.auth.api;

import clinicalstudypb.auth.domain.AuthProblemException;
import clinicalstudypb.auth.domain.InvalidCredentialsException;
import java.util.List;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Converte erros de entrada e credenciais do controller de autenticação para o contrato da API.
 *
 * @author Lívia
 * @since 2026-10-23
 * @version 0.0.2
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
     * Devolve o código estável da falha de ativação ou troca de senha no formato ProblemDetail.
     *
     * @param exception regra de negócio violada
     * @return detalhe HTTP com propriedade {@code code}
     */
    @ExceptionHandler(AuthProblemException.class)
    public ProblemDetail handleAuthProblem(AuthProblemException exception) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(exception.getStatus(), exception.getMessage());
        detail.setProperty("code", exception.getCode());
        return detail;
    }

    /**
     * Converte falhas de validação do corpo em {@code 400} segundo o contrato de cada rota de autenticação.
     *
     * @param exception erros de validação do corpo da requisição
     * @return resposta HTTP 400 com {@code ProblemDetail} ou erros por campo
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleInvalidRequest(MethodArgumentNotValidException exception) {
        if (exception.getBindingResult().getTarget() instanceof ActivationRequest) {
            ProblemDetail detail = ProblemDetail.forStatusAndDetail(
                    HttpStatus.BAD_REQUEST, "E-mail ou código de ativação inválido.");
            detail.setProperty("code", "ACTIVATION_INVALID");
            return ResponseEntity.badRequest().contentType(MediaType.APPLICATION_PROBLEM_JSON).body(detail);
        }
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
