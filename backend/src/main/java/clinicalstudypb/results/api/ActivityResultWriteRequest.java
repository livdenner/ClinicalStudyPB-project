package clinicalstudypb.results.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Dados fictícios fornecidos pelo pesquisador para uma atividade. */
public record ActivityResultWriteRequest(
        @NotBlank @Size(max = 200) String value,
        @Size(max = 500) String note) {
}
