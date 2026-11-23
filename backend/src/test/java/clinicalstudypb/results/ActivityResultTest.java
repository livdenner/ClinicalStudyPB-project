package clinicalstudypb.results;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import clinicalstudypb.results.domain.ActivityResult;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/**
 * Comprova as regras de criação e substituição integral na entidade {@link ActivityResult}.
 */
class ActivityResultTest {

    private static final Long VISIT_ID = 10L;
    private static final Long ACTIVITY_ID = 20L;
    private static final Instant FIRST_RECORDED_AT = Instant.parse("2027-06-01T13:00:00Z");
    private static final Instant SECOND_RECORDED_AT = Instant.parse("2027-06-01T14:15:30Z");

    @Test
    void constructorStoresResultLinksValueNoteAuthorAndInstant() {
        ActivityResult result = new ActivityResult(
                VISIT_ID, ACTIVITY_ID, "120x80 mmHg", "Em repouso", 7L, FIRST_RECORDED_AT);

        assertNull(result.getId());
        assertEquals(VISIT_ID, result.getVisitId());
        assertEquals(ACTIVITY_ID, result.getActivityId());
        assertEquals("120x80 mmHg", result.getValue());
        assertEquals("Em repouso", result.getNote());
        assertEquals(7L, result.getRecordedByUserId());
        assertEquals(FIRST_RECORDED_AT, result.getRecordedAt());
    }

    @Test
    void constructorAllowsOptionalNullNote() {
        ActivityResult result = new ActivityResult(
                VISIT_ID, ACTIVITY_ID, "72 bpm", null, 7L, FIRST_RECORDED_AT);

        assertEquals("72 bpm", result.getValue());
        assertNull(result.getNote());
    }

    @Test
    void replaceUpdatesValueNoteAuthorAndInstantPreservingVisitAndActivity() {
        ActivityResult result = new ActivityResult(
                VISIT_ID, ACTIVITY_ID, "120x80 mmHg", "Primeira medição", 7L, FIRST_RECORDED_AT);

        result.replace("128x84 mmHg", "Segunda medição", 11L, SECOND_RECORDED_AT);

        assertEquals(VISIT_ID, result.getVisitId());
        assertEquals(ACTIVITY_ID, result.getActivityId());
        assertEquals("128x84 mmHg", result.getValue());
        assertEquals("Segunda medição", result.getNote());
        assertEquals(11L, result.getRecordedByUserId());
        assertEquals(SECOND_RECORDED_AT, result.getRecordedAt());
    }

    @Test
    void replaceClearsPreviousNoteWhenNewNoteIsNull() {
        ActivityResult result = new ActivityResult(
                VISIT_ID, ACTIVITY_ID, "120x80 mmHg", "Observação anterior", 7L, FIRST_RECORDED_AT);

        result.replace("118x78 mmHg", null, 12L, SECOND_RECORDED_AT);

        assertEquals("118x78 mmHg", result.getValue());
        assertNull(result.getNote());
        assertEquals(12L, result.getRecordedByUserId());
        assertEquals(SECOND_RECORDED_AT, result.getRecordedAt());
    }
}
