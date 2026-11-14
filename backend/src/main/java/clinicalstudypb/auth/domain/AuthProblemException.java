package clinicalstudypb.auth.domain;

import org.springframework.http.HttpStatus;

/**
 * Exceção de regra de negócio da autenticação convertida em {@code ProblemDetail} com código estável.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
public abstract class AuthProblemException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    /**
     * Inicializa o erro com status HTTP e código contratado na OpenAPI.
     *
     * @param status status HTTP da resposta
     * @param code código estável de erro
     * @param message descrição legível do motivo
     */
    protected AuthProblemException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    /**
     * Consulta o status HTTP associado ao erro.
     *
     * @return status HTTP
     */
    public HttpStatus getStatus() {
        return status;
    }

    /**
     * Consulta o código estável retornado no {@code ProblemDetail}.
     *
     * @return código de erro da API
     */
    public String getCode() {
        return code;
    }
}
