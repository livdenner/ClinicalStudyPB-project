package clinicalstudypb;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Inicia a aplicação Spring Boot do ClinicalStudyPB.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-21
 * @version 0.0.1
 */
@SpringBootApplication
public class ClinicalStudyPBApplication {
    /** Cria a classe de configuração principal da aplicação. */
    public ClinicalStudyPBApplication() {
    }

    /**
     * Inicia o servidor e os componentes do backend.
     *
     * @param args argumentos recebidos pela aplicação
     */
    public static void main(String[] args) {
        SpringApplication.run(ClinicalStudyPBApplication.class, args);
    }
}
