package clinicalstudypb.shared;

import clinicalstudypb.candidates.domain.CandidateConflictException;
import clinicalstudypb.candidates.domain.InvalidCandidateException;
import clinicalstudypb.candidates.domain.InvalidEligibilityEvaluationException;
import clinicalstudypb.consent.domain.ConsentConflictException;
import clinicalstudypb.participants.domain.InclusionConflictException;
import clinicalstudypb.scheduling.domain.InvalidScheduledVisitException;
import clinicalstudypb.scheduling.domain.SchedulingConflictException;
import clinicalstudypb.studies.domain.InvalidStudyException;
import clinicalstudypb.studies.domain.StudyStatusConflictException;
import clinicalstudypb.users.domain.EmailAlreadyInUseException;
import clinicalstudypb.users.domain.ParticipantRoleNotAllowedException;
import clinicalstudypb.visits.domain.ProtocolConflictException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
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

    /** Responde com o código contratual quando /api/users recebe o perfil de participante. */
    @ExceptionHandler(ParticipantRoleNotAllowedException.class)
    public ProblemDetail handleParticipantRoleNotAllowed(ParticipantRoleNotAllowedException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
        problem.setProperty("code", "PARTICIPANT_ROLE_NOT_ALLOWED");
        return problem;
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

    /**
     * Responde com 400 para respostas de elegibilidade inválidas.
     *
     * @param exception validação não atendida
     * @return detalhe da regra violada
     */
    @ExceptionHandler(InvalidEligibilityEvaluationException.class)
    public ProblemDetail handleInvalidEligibilityEvaluation(InvalidEligibilityEvaluationException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    }

    /**
     * Responde com 400 para dados inválidos em operações de candidatura.
     *
     * @param exception validação não atendida
     * @return detalhe HTTP da regra violada
     */
    @ExceptionHandler(InvalidCandidateException.class)
    public ProblemDetail handleInvalidCandidate(InvalidCandidateException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    }

    /**
     * Responde com 409 quando o estudo não pode avançar para o estado solicitado.
     *
     * @param exception transição recusada
     * @return detalhe HTTP do conflito de estado
     */
    @ExceptionHandler(StudyStatusConflictException.class)
    public ProblemDetail handleStudyStatusConflict(StudyStatusConflictException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
        if (exception.getCode() != null) {
            problem.setProperty("code", exception.getCode());
        }
        return problem;
    }

    /**
     * Responde com 409 para alterações incompatíveis com o protocolo atual.
     *
     * @param exception conflito de protocolo
     * @return detalhe HTTP do conflito
     */
    @ExceptionHandler(ProtocolConflictException.class)
    public ProblemDetail handleProtocolConflict(ProtocolConflictException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    }

    /**
     * Responde com 409 para conflitos de cadastro, consentimento ou inclusão de candidatos.
     *
     * @param exception conflito de candidatos, consentimento ou inclusão
     * @return detalhe HTTP do conflito
     */
    @ExceptionHandler({CandidateConflictException.class, ConsentConflictException.class,
            InclusionConflictException.class})
    public ProblemDetail handleCandidateConflict(RuntimeException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
        if (exception instanceof CandidateConflictException candidate && candidate.getCode() != null) {
            problem.setProperty("code", candidate.getCode());
        }
        return problem;
    }

    /**
     * Responde com 409 quando outra transação alterou o registro primeiro.
     *
     * @param exception conflito de versão
     * @return detalhe HTTP do conflito
     */
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ProblemDetail handleOptimisticConflict(ObjectOptimisticLockingFailureException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "O registro mudou. Atualize os dados antes de tentar novamente.");
    }

    /**
     * Responde com 400 e código estável quando os dados ou janela de agendamento são inválidos.
     *
     * @param exception erro de validação do agendamento
     * @return detalhe HTTP com propriedade {@code code}
     */
    @ExceptionHandler(InvalidScheduledVisitException.class)
    public ProblemDetail handleInvalidScheduledVisit(InvalidScheduledVisitException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
        problem.setProperty("code", exception.getCode());
        return problem;
    }

    /**
     * Responde com 409 e código estável quando há conflito de estado ou duplicidade no agendamento.
     *
     * @param exception erro de conflito do agendamento
     * @return detalhe HTTP com propriedade {@code code}
     */
    @ExceptionHandler(SchedulingConflictException.class)
    public ProblemDetail handleSchedulingConflict(SchedulingConflictException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
        problem.setProperty("code", exception.getCode());
        return problem;
    }
}
