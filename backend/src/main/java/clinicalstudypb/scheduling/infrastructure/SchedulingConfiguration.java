package clinicalstudypb.scheduling.infrastructure;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configura os componentes de infraestrutura do módulo de agendamento de visitas.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
@Configuration
public class SchedulingConfiguration {

    /** Cria a configuração do módulo de agendamento. */
    public SchedulingConfiguration() {
    }

    /**
     * Fornece o relógio UTC usado para validar datas futuras e registrar criações.
     *
     * @return relógio do sistema em UTC
     */
    @Bean
    public Clock schedulingClock() {
        return Clock.systemUTC();
    }
}
