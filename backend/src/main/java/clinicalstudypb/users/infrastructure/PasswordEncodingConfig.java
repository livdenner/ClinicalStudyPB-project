package clinicalstudypb.users.infrastructure;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Disponibiliza o codificador de senhas usado no cadastro e no futuro login.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
@Configuration
public class PasswordEncodingConfig {
    /** Cria a configuração responsável pelo codificador de senhas. */
    public PasswordEncodingConfig() {
    }


    /**
     * Cria um codificador que grava novas senhas com o prefixo {@code {bcrypt}}.
     *
     * @return codificador compartilhado pela aplicação
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}
