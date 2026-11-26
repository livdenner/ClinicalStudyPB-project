package clinicalstudypb.results.api;

import clinicalstudypb.results.domain.ActivityResult;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

/** Resultado persistido de uma atividade de visita. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ActivityResultResponse(Long visitId, Long activityId, String activityName, String value, String note,
                                     Long recordedByUserId, Instant recordedAt) {

    /** Converte o registro para a representação pública com o nome atual da atividade. */
    public static ActivityResultResponse from(ActivityResult result, String activityName) {
        return new ActivityResultResponse(result.getVisitId(), result.getActivityId(), activityName,
                result.getValue(), result.getNote(), result.getRecordedByUserId(), result.getRecordedAt());
    }
}
