package clinicalstudypb.scheduling.domain;

/**
 * Indica violação de regra de entrada ou janela no agendamento de visitas (HTTP 400).
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
public class InvalidScheduledVisitException extends IllegalArgumentException {

    private final String code;

    /**
     * Cria a exceção com o código estável do contrato e a mensagem de erro.
     *
     * @param code código de erro exposto em {@code ProblemDetail}
     * @param message explicação da regra violada
     */
    public InvalidScheduledVisitException(String code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * Retorna o código estável associado ao erro.
     *
     * @return código estável de erro
     */
    public String getCode() {
        return code;
    }
}
