package clinicalstudypb.shared;

import clinicalstudypb.studies.domain.InvalidStudyException;
import clinicalstudypb.users.domain.EmailAlreadyInUseException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Converte erros conhecidos da aplicação em respostas HTTP padronizadas.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
@RestControllerAdvice
public class GlobalExceptionHandler {
    /** Cria o componente que trata exceções compartilhadas pela API. */
    public GlobalExceptionHandler() {
    }

    /**
     * Responde com 404 quando o recurso solicitado não existe.
     *
     * @param exception erro gerado pela busca
     * @return detalhe HTTP do recurso ausente
     */
    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleResourceNotFound(ResourceNotFoundException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    /**
     * Responde com 409 quando o e-mail já está em uso.
     *
     * @param exception erro de duplicidade de e-mail
     * @return detalhe HTTP do conflito
     */
    @ExceptionHandler(EmailAlreadyInUseException.class)
    public ProblemDetail handleEmailAlreadyInUse(EmailAlreadyInUseException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    }

    /**
     * Responde com 409 quando uma restrição de integridade do banco é violada.
     *
     * @param exception erro de integridade de dados
     * @return detalhe HTTP sem dados internos do banco
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleDataConflict(DataIntegrityViolationException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "Dados em conflito com um registro existente.");
    }

    /**
     * Responde com 400 quando os dados de um estudo violam uma regra.
     *
     * @param exception erro de validação do estudo
     * @return detalhe HTTP da regra violada
     */
    @ExceptionHandler(InvalidStudyException.class)
    public ProblemDetail handleInvalidStudy(InvalidStudyException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    }
}
