package clinicalstudypb.auth.domain;

import org.springframework.http.HttpStatus;

/** Erro de validação do código no primeiro acesso. */
public class ActivationException extends AuthProblemException {

    private ActivationException(HttpStatus status, String code, String message) {
        super(status, code, message);
    }

    /**
     * Erro para e-mail inexistente ou código incorreto/substituído/consumido.
     *
     * @return exceção com código {@code ACTIVATION_INVALID}
     */
    public static ActivationException invalid() {
        return new ActivationException(HttpStatus.BAD_REQUEST, "ACTIVATION_INVALID",
                "E-mail ou código de ativação inválido.");
    }

    /**
     * Erro para código válido cujo prazo de 72 horas venceu.
     *
     * @return exceção com código {@code ACTIVATION_EXPIRED}
     */
    public static ActivationException expired() {
        return new ActivationException(HttpStatus.GONE, "ACTIVATION_EXPIRED",
                "Código de ativação expirado. Solicite outro ao coordenador.");
    }
}
