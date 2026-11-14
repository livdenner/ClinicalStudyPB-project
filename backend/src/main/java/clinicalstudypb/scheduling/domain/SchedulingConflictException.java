package clinicalstudypb.scheduling.domain;

/**
 * Indica conflito de estado ou duplicidade ativa no agendamento de visitas (HTTP 409).
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
public class SchedulingConflictException extends RuntimeException {

    private final String code;

    /**
     * Cria a exceção com o código estável do contrato e a mensagem do conflito.
     *
     * @param code código de erro exposto em {@code ProblemDetail}
     * @param message explicação do conflito
     */
    public SchedulingConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * Retorna o código estável associado ao conflito.
     *
     * @return código estável de erro
     */
    public String getCode() {
        return code;
    }
}
