package clinicalstudypb.auth.domain;

/** Sinaliza credenciais inválidas ou uma conta inativa sem revelar qual caso ocorreu.
 *
 * @author Lívia
 * @since 2026-10-23
 * @version 0.0.1
 */
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException() {
        super("E-mail ou senha inválidos.");
    }
}
