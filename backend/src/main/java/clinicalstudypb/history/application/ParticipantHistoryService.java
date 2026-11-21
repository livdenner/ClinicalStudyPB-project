package clinicalstudypb.history.application;

import clinicalstudypb.participants.application.ParticipantResult;
import clinicalstudypb.participants.application.ParticipantService;
import clinicalstudypb.results.api.ActivityResultResponse;
import clinicalstudypb.results.application.ActivityResultLookup;
import clinicalstudypb.scheduling.application.ScheduledVisitResult;
import clinicalstudypb.scheduling.application.ScheduledVisitService;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Monta o histórico do participante (RF15) só com as consultas públicas dos módulos de
 * participantes (RF11/RF16), agendamento (RF12/RF13) e resultados (RF14), sem tabela própria
 * nem cópia de dados.
 *
 * @author Allan Guilherme
 * @since 2026-11-19
 * @version 0.0.1
 */
@Service
public class ParticipantHistoryService {

    private final ParticipantService participantService;
    private final ScheduledVisitService scheduledVisitService;
    private final ActivityResultLookup activityResultLookup;

    /**
     * Recebe as consultas públicas usadas na composição do histórico.
     *
     * @param participantService participante, situação e retirada
     * @param scheduledVisitService visitas agendadas e desfechos
     * @param activityResultLookup resultados por atividade
     */
    public ParticipantHistoryService(ParticipantService participantService,
                                     ScheduledVisitService scheduledVisitService,
                                     ActivityResultLookup activityResultLookup) {
        this.participantService = participantService;
        this.scheduledVisitService = scheduledVisitService;
        this.activityResultLookup = activityResultLookup;
    }

    /**
     * Consulta o histórico completo do participante dentro do estudo da rota. As leituras rodam
     * em uma única transação {@code REPEATABLE_READ}, para que participante, visitas e resultados
     * venham do mesmo instante, mesmo com uma retirada ou um desfecho gravados em paralelo.
     *
     * @param studyId estudo da rota
     * @param participantId participante da rota
     * @return participante e visitas em ordem cronológica, cada uma com seus resultados
     * @throws clinicalstudypb.shared.ResourceNotFoundException se o estudo não existe ou o
     *         participante não pertence a ele
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ParticipantHistoryView get(Long studyId, Long participantId) {
        ParticipantResult participant = participantService.get(studyId, participantId);
        List<ScheduledVisitResult> visits = scheduledVisitService.listByParticipant(studyId, participantId);
        Map<Long, List<ActivityResultResponse>> results = activityResultLookup.findByVisitIds(
                visits.stream().map(visit -> visit.visit().getId()).toList());
        List<ParticipantHistoryVisitView> history = visits.stream()
                .map(visit -> new ParticipantHistoryVisitView(
                        visit, results.getOrDefault(visit.visit().getId(), List.of())))
                .toList();
        return new ParticipantHistoryView(participant, history);
    }
}
