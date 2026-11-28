package clinicalstudypb.results.application;

import clinicalstudypb.results.api.ActivityResultResponse;
import clinicalstudypb.results.api.VisitResultActivityResponse;
import clinicalstudypb.results.api.VisitResultsResponse;
import clinicalstudypb.results.domain.ActivityResult;
import clinicalstudypb.results.infrastructure.ActivityResultRepository;
import clinicalstudypb.scheduling.domain.ScheduledVisit;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import clinicalstudypb.scheduling.domain.SchedulingConflictException;
import clinicalstudypb.scheduling.infrastructure.ScheduledVisitRepository;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.visits.api.PlannedActivityResponse;
import clinicalstudypb.visits.api.PlannedVisitResponse;
import clinicalstudypb.visits.application.PlannedVisitLookup;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Regras de consulta e gravação dos resultados fictícios de atividades. */
@Service
public class ActivityResultService implements ActivityResultLookup {

    private final ActivityResultRepository results;
    private final ScheduledVisitRepository visits;
    private final PlannedVisitLookup plannedVisits;
    private final StudyService studies;
    private final CurrentActor currentActor;
    private final Clock clock;

    /** Recebe as dependências necessárias ao registro e à consulta dos resultados. */
    public ActivityResultService(ActivityResultRepository results,
                                 ScheduledVisitRepository visits,
                                 PlannedVisitLookup plannedVisits,
                                 StudyService studies,
                                 CurrentActor currentActor,
                                 @Qualifier("schedulingClock") Clock clock) {
        this.results = results;
        this.visits = visits;
        this.plannedVisits = plannedVisits;
        this.studies = studies;
        this.currentActor = currentActor;
        this.clock = clock;
    }

    /** Lista todas as atividades do protocolo, com resultado quando existir. */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public VisitResultsResponse get(Long studyId, Long participantId, Long visitId) {
        studies.getStudy(studyId);
        ScheduledVisit visit = findVisit(studyId, participantId, visitId);
        PlannedVisitResponse planned = findPlannedVisit(studyId, visit.getPlannedVisitId());
        Map<Long, ActivityResultResponse> byActivity = results.findByVisitId(visitId).stream()
                .map(row -> ActivityResultResponse.from(row.result(), row.activityName()))
                .collect(Collectors.toMap(ActivityResultResponse::activityId, Function.identity()));
        List<VisitResultActivityResponse> activities = planned.activities().stream()
                .sorted(Comparator.comparing(PlannedActivityResponse::position))
                .map(activity -> new VisitResultActivityResponse(activity.id(), activity.name(),
                        activity.description(), activity.position(), byActivity.get(activity.id())))
                .toList();
        return new VisitResultsResponse(visitId, planned.id(), planned.name(), visit.getStatus(), activities);
    }

    /** Cria ou substitui o resultado da atividade e informa se o registro já existia. */
    @Transactional
    public WriteResult put(Long studyId, Long participantId, Long visitId, Long activityId,
                           String value, String note) {
        Study study = studies.lockForScheduling(studyId);
        studies.requireResponsible(study);
        ScheduledVisit visit = visits.findByIdAndStudyIdAndParticipantIdForUpdate(
                visitId, studyId, participantId).orElseThrow(
                    () -> new ResourceNotFoundException("Agendamento não encontrado: " + visitId));
        PlannedVisitResponse planned = findPlannedVisit(studyId, visit.getPlannedVisitId());
        PlannedActivityResponse matchedActivity = planned.activities().stream()
                .filter(activity -> activity.id().equals(activityId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Atividade não encontrada nesta visita: " + activityId));
        if (study.getStatus() == StudyStatus.CLOSED || study.getStatus() == StudyStatus.CANCELLED) {
            throw new SchedulingConflictException("STUDY_READ_ONLY", "O estudo não aceita resultados de atividades.");
        }
        if (visit.getStatus() != ScheduledVisitStatus.DONE) {
            throw new SchedulingConflictException("VISIT_NOT_DONE", "A visita precisa estar realizada.");
        }
        String normalizedValue = value.strip();
        String normalizedNote = note == null || note.strip().isEmpty() ? null : note.strip();
        ActivityResult existing = results.findByVisitIdAndActivityId(visitId, activityId).orElse(null);
        boolean created = existing == null;
        ActivityResult result = created
                ? new ActivityResult(visitId, activityId, normalizedValue, normalizedNote,
                        currentActor.userId(), clock.instant().truncatedTo(ChronoUnit.MICROS))
                : existing;
        if (!created) {
            result.replace(normalizedValue, normalizedNote,
                    currentActor.userId(), clock.instant().truncatedTo(ChronoUnit.MICROS));
        }
        return new WriteResult(
                ActivityResultResponse.from(results.saveAndFlush(result), matchedActivity.name()), created);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ActivityResultResponse> findByVisitId(Long visitId) {
        return results.findByVisitId(visitId).stream()
                .map(row -> ActivityResultResponse.from(row.result(), row.activityName()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, List<ActivityResultResponse>> findByVisitIds(Collection<Long> visitIds) {
        if (visitIds.isEmpty()) {
            return Map.of();
        }
        // A consulta já ordena por visita e posição; o LinkedHashMap e o toList preservam essa ordem.
        return results.findByVisitIdIn(visitIds).stream()
                .map(row -> ActivityResultResponse.from(row.result(), row.activityName()))
                .collect(Collectors.groupingBy(ActivityResultResponse::visitId, LinkedHashMap::new,
                        Collectors.toList()));
    }

    private ScheduledVisit findVisit(Long studyId, Long participantId, Long visitId) {
        return visits.findByIdAndStudyIdAndParticipantId(visitId, studyId, participantId)
                .orElseThrow(() -> new ResourceNotFoundException("Agendamento não encontrado: " + visitId));
    }

    private PlannedVisitResponse findPlannedVisit(Long studyId, Long plannedVisitId) {
        return plannedVisits.findByStudyAndId(studyId, plannedVisitId)
                .orElseThrow(() -> new ResourceNotFoundException("Visita prevista não encontrada: " + plannedVisitId));
    }

    /** Resposta da gravação com indicação do código HTTP apropriado. */
    public record WriteResult(ActivityResultResponse result, boolean created) {
    }
}
