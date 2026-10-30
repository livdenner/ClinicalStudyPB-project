package clinicalstudypb.studies.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Dados recebidos para cadastrar ou atualizar um estudo.
 *
 * @param title título do estudo
 * @param objective objetivo do estudo
 * @param responsibleUserId identificador do pesquisador responsável
 * @param startDate data de início
 * @param endDate data de término
 * @param participantLimit número máximo de participantes
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-22
 * @version 0.0.1
 */
public record StudyRequest(
        @NotBlank @Size(max = 200) String title,
        @NotBlank String objective,
        @NotNull @Positive Long responsibleUserId,
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,
        @NotNull @Positive Integer participantLimit
) {
}
