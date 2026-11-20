package clinicalstudypb.results.api;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Atividade do protocolo acompanhada de seu resultado, quando registrado. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record VisitResultActivityResponse(Long activityId, String name, String description,
                                          Integer position, ActivityResultResponse result) {
}
