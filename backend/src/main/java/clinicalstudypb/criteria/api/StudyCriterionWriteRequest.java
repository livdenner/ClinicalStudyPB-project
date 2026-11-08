package clinicalstudypb.criteria.api;

import clinicalstudypb.criteria.domain.CriterionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Dados recebidos para cadastrar um critério.
 *
 * @param type classificação de inclusão ou exclusão
 * @param description descrição do critério
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
public record StudyCriterionWriteRequest(@NotNull CriterionType type,
                                         @NotBlank @Size(max = 500) String description) {
}
