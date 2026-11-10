package clinicalstudypb.auth.api;

import java.util.List;

/** Resposta de validação para dados de login inválidos.
 *
 * @param code código estável do erro
 * @param message mensagem legível
 * @param fieldErrors problemas associados aos campos da requisição
 * @author Lívia
 * @since 2026-10-23
 * @version 0.0.1
 */
public record AuthValidationErrorResponse(
        String code,
        String message,
        List<FieldErrorResponse> fieldErrors
) {

    /** Erro associado a um campo da requisição.
     *
     * @param field nome do campo
     * @param message mensagem de validação
     */
    public record FieldErrorResponse(String field, String message) {
    }
}
