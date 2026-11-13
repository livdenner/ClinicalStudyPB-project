package clinicalstudypb.auth.domain;

import org.springframework.http.HttpStatus;

/**
 * Erro de validação da senha atual ou das regras da nova senha em {@code PUT /api/auth/password}.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
public class PasswordChangeException extends AuthProblemException {

    private PasswordChangeException(String code, String message) {
        super(HttpStatus.BAD_REQUEST, code, message);
    }

    /**
     * Indica que a nova senha não atende à política mínima definida no contrato.
     *
     * @return exceção com código {@code PASSWORD_POLICY}
     */
    public static PasswordChangeException policy() {
        return new PasswordChangeException("PASSWORD_POLICY",
                "A nova senha deve ter entre 8 e 72 caracteres, com ao menos uma letra e um número.");
    }

    /**
     * Indica ausência ou divergência da senha atual fora do primeiro acesso.
     *
     * @return exceção com código {@code CURRENT_PASSWORD_INVALID}
     */
    public static PasswordChangeException currentPasswordInvalid() {
        return new PasswordChangeException("CURRENT_PASSWORD_INVALID",
                "A senha atual está ausente ou incorreta.");
    }
}
