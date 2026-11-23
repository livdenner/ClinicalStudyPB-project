package clinicalstudypb.me.application;

import clinicalstudypb.participants.application.ParticipantQueryService;
import clinicalstudypb.participants.domain.Participant;
import clinicalstudypb.scheduling.application.ScheduledVisitService;
import clinicalstudypb.scheduling.domain.ScheduledVisit;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.visits.api.PlannedActivityResponse;
import clinicalstudypb.visits.api.PlannedVisitResponse;
import clinicalstudypb.visits.application.PlannedVisitLookup;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Monta, só para a conta autenticada, os estudos em que ela participa e suas visitas (RF17 e RF18).
 * A conta vem sempre do token: não há parâmetro que permita consultar outra pessoa.
 *
 * @author Allan Guilherme
 * @since 2026-11-17
 * @version 0.0.1
 */
@Service
public class ParticipantSelfService {

    /** Histórico: visita mais recente primeiro; empate resolvido pelo identificador. */
    private static final Comparator<ScheduledVisit> MOST_RECENT_FIRST = Comparator
            .comparing(ScheduledVisit::getScheduledAt)
            .thenComparing(ScheduledVisit::getId)
            .reversed();

    private final CurrentActor currentActor;
    private final ParticipantQueryService participantQueryService;
    private final ScheduledVisitService scheduledVisitService;
    private final StudyService studyService;
    private final UserService userService;
    private final PlannedVisitLookup plannedVisitLookup;

    /**
     * Recebe as consultas públicas dos módulos usados na composição.
     *
     * @param currentActor conta autenticada na requisição
     * @param participantQueryService participações da conta
     * @param scheduledVisitService agendamentos das participações
     * @param studyService dados dos estudos
     * @param userService nome do pesquisador responsável
     * @param plannedVisitLookup nomes e visitas previstas do protocolo
     */
    public ParticipantSelfService(CurrentActor currentActor,
                                  ParticipantQueryService participantQueryService,
                                  ScheduledVisitService scheduledVisitService,
                                  StudyService studyService,
                                  UserService userService,
                                  PlannedVisitLookup plannedVisitLookup) {
        this.currentActor = currentActor;
        this.participantQueryService = participantQueryService;
        this.scheduledVisitService = scheduledVisitService;
        this.studyService = studyService;
        this.userService = userService;
        this.plannedVisitLookup = plannedVisitLookup;
    }

    /**
     * Lista os estudos em que a conta autenticada participa, com participação ativa ou retirada.
     *
     * @return participações da inclusão mais recente para a mais antiga; vazio sem inclusão
     */
    @Transactional(readOnly = true)
    public List<ParticipantStudyView> listStudies() {
        List<Participant> participations = participantQueryService.listByAccount(currentActor.userId());
        Map<Long, Study> studies = new HashMap<>();
        Map<Long, String> responsibleNames = new HashMap<>();
        Map<Long, List<PlannedVisitResponse>> plannedVisitsByStudy = new HashMap<>();
        return participations.stream()
                .map(participant -> {
                    Study study = studies.computeIfAbsent(participant.getStudyId(), studyService::getStudy);
                    String responsibleName = responsibleNames.computeIfAbsent(study.getResponsibleUserId(),
                            id -> userService.getUser(id).getName());
                    List<PlannedVisitResponse> plannedVisits = plannedVisitsByStudy.computeIfAbsent(
                            participant.getStudyId(), plannedVisitLookup::findByStudy);
                    return new ParticipantStudyView(participant, study, responsibleName, plannedVisits);
                })
                .toList();
    }

    /**
     * Lista as visitas da conta autenticada em todos os seus estudos, separadas em próximas
     * (ainda {@code SCHEDULED}, da mais antiga para a mais nova) e histórico de desfechos
     * ({@code DONE}, {@code ABSENT} e {@code CANCELLED}, da mais recente para a mais antiga),
     * com as atividades previstas de cada visita na ordem do protocolo.
     *
     * @return listas separadas de próximas visitas e histórico; ambas vazias sem inclusão
     */
    @Transactional(readOnly = true)
    public ParticipantVisitsView listVisits() {
        List<Long> participantIds = participantQueryService.listByAccount(currentActor.userId()).stream()
                .map(Participant::getId)
                .toList();
        if (participantIds.isEmpty()) {
            return new ParticipantVisitsView(List.of(), List.of());
        }
        List<ScheduledVisit> visits = scheduledVisitService.listByParticipants(participantIds);
        Map<Long, String> studyTitles = new HashMap<>();
        Map<Long, Map<Long, PlannedVisitResponse>> plannedVisitsByStudy = new HashMap<>();
        List<ParticipantVisitView> upcoming = visits.stream()
                .filter(visit -> visit.getStatus() == ScheduledVisitStatus.SCHEDULED)
                .map(visit -> toView(visit, studyTitles, plannedVisitsByStudy))
                .toList();
        List<ParticipantVisitView> history = visits.stream()
                .filter(visit -> visit.getStatus() != ScheduledVisitStatus.SCHEDULED)
                .sorted(MOST_RECENT_FIRST)
                .map(visit -> toView(visit, studyTitles, plannedVisitsByStudy))
                .toList();
        return new ParticipantVisitsView(upcoming, history);
    }

    private ParticipantVisitView toView(ScheduledVisit visit,
                                        Map<Long, String> studyTitles,
                                        Map<Long, Map<Long, PlannedVisitResponse>> plannedVisitsByStudy) {
        String studyTitle = studyTitles.computeIfAbsent(visit.getStudyId(),
                id -> studyService.getStudy(id).getTitle());
        PlannedVisitResponse plannedVisit = plannedVisitsByStudy
                .computeIfAbsent(visit.getStudyId(), this::indexPlannedVisits)
                .get(visit.getPlannedVisitId());
        String plannedVisitName = plannedVisit != null ? plannedVisit.name() : "";
        List<PlannedActivityResponse> activities = plannedVisit != null
                ? plannedVisit.activities()
                : List.of();
        return new ParticipantVisitView(visit, studyTitle, plannedVisitName, activities);
    }

    private Map<Long, PlannedVisitResponse> indexPlannedVisits(Long studyId) {
        return plannedVisitLookup.findByStudy(studyId).stream()
                .collect(Collectors.toMap(
                        PlannedVisitResponse::id, Function.identity(), (first, second) -> first));
    }
}
