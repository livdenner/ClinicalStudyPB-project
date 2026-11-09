package clinicalstudypb.participants.infrastructure;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Fornece um relógio UTC substituível nos testes de inclusão.
 *
 * @author Lívia
 * @since 2026-11-09
 * @version 0.0.1
 */
@Configuration
public class ParticipantConfiguration {

    /** Cria a configuração do relógio da inclusão. */
    public ParticipantConfiguration() {
    }

    /**
     * Fornece o relógio de inclusões com fuso UTC.
     *
     * @return relógio usado para registrar o instante da inclusão
     */
    @Bean
    public Clock participantClock() {
        return Clock.systemUTC();
    }
}
