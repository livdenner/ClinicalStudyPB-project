package clinicalstudypb.candidates.infrastructure;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Fornece o relógio da avaliação, substituível por um relógio fixo nos testes.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
@Configuration
public class EligibilityConfiguration {

    /** @return relógio UTC usado para registrar avaliações */
    @Bean
    public Clock eligibilityClock() {
        return Clock.systemUTC();
    }
}
