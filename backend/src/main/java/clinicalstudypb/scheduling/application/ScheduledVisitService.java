package clinicalstudypb.scheduling.application;

import clinicalstudypb.participants.application.ParticipantSchedulingLookup;
import clinicalstudypb.participants.application.ParticipantSchedulingView;
import clinicalstudypb.scheduling.domain.InvalidScheduledVisitException;
import clinicalstudypb.scheduling.domain.ScheduledVisit;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import clinicalstudypb.scheduling.domain.SchedulingConflictException;
import clinicalstudypb.scheduling.infrastructure.ScheduledVisitRepository;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.visits.application.PlannedVisitLookup;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Regras transacionais de agendamento e consultas de visitas previstas para participantes.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
@Service
public class ScheduledVisitService {

    private static final ZoneId FORTALEZA_ZONE = ZoneId.of("America/Fortaleza");
    private static final EnumSet<ScheduledVisitStatus> BLOCKING_STATUSES =
            EnumSet.of(ScheduledVisitStatus.SCHEDULED, ScheduledVisitStatus.DONE);
    private static final String ACTIVE_UNIQUE_INDEX = "ux_scheduled_visit_active";

    private final ScheduledVisitRepository scheduledVisitRepository;
    private final StudyService studyService;
    private final ParticipantSchedulingLookup participantSchedulingLookup;
    private final PlannedVisitLookup plannedVisitLookup;
    private final CurrentActor currentActor;
    private final Clock clock;

    /**
     * Constrói o serviço de agendamentos com suas dependências entre módulos.
     *
     * @param scheduledVisitRepository repositório de agendamentos
     * @param studyService serviço público de estudos
     * @param participantSchedulingLookup consulta pública de participantes para agendamento
     * @param plannedVisitLookup consulta pública de visitas previstas
     * @param currentActor resolvedor do usuário autenticado
     * @param clock relógio UTC de referência temporal
     */
    public ScheduledVisitService(ScheduledVisitRepository scheduledVisitRepository,
                                 StudyService studyService,
                                 ParticipantSchedulingLookup participantSchedulingLookup,
                                 PlannedVisitLookup plannedVisitLookup,
                                 CurrentActor currentActor,
                                 @Qualifier("schedulingClock") Clock clock) {
        this.scheduledVisitRepository = scheduledVisitRepository;
        this.studyService = studyService;
        this.participantSchedulingLookup = participantSchedulingLookup;
        this.plannedVisitLookup = plannedVisitLookup;
        this.currentActor = currentActor;
        this.clock = clock;
    }

    /**
     * Agenda uma visita prevista para o participante mantendo bloqueio na ordem {@code study -> participant}.
     *
     * @param studyId identificador do estudo
     * @param participantId identificador do participante no estudo
     * @param plannedVisitId identificador da visita prevista do protocolo
     * @param scheduledAt data e hora agendadas para a visita
     * @return agendamento criado com nomes públicos associados
     */
    @Transactional
    public ScheduledVisitResult schedule(Long studyId,
                                         Long participantId,
                                         Long plannedVisitId,
                                         Instant scheduledAt) {
        Study study = studyService.lockForScheduling(studyId);
        ParticipantSchedulingView participant =
                participantSchedulingLookup.lockForScheduling(studyId, participantId);
        validateSchedulableState(study, participant);
        String plannedVisitName = findPlannedVisitName(studyId, plannedVisitId);
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        Instant normalizedScheduledAt = normalizeScheduledAt(scheduledAt);
        validateVisitTiming(study, normalizedScheduledAt, now);
        ensureNoBlockingVisit(participantId, plannedVisitId);
        ScheduledVisit visit = new ScheduledVisit(
                studyId,
                participantId,
                plannedVisitId,
                normalizedScheduledAt,
                currentActor.userId(),
                now);
        ScheduledVisit saved = persistWithConflictTranslation(visit);
        return new ScheduledVisitResult(saved, participant.candidateName(), plannedVisitName);
    }

    /**
     * Consulta um agendamento específico vinculado ao estudo e ao participante informados.
     *
     * @param studyId identificador do estudo
     * @param participantId identificador do participante
     * @param visitId identificador do agendamento
     * @return agendamento detalhado com nomes associados
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ScheduledVisitResult get(Long studyId, Long participantId, Long visitId) {
        ParticipantSchedulingView participant =
                participantSchedulingLookup.getForScheduling(studyId, participantId);
        ScheduledVisit visit = scheduledVisitRepository
                .findByIdAndStudyIdAndParticipantId(visitId, studyId, participantId)
                .orElseThrow(() -> new ResourceNotFoundException("Agendamento não encontrado: " + visitId));
        String plannedVisitName = plannedVisitLookup
                .findNameByStudyAndId(studyId, visit.getPlannedVisitId())
                .orElse("");
        return new ScheduledVisitResult(visit, participant.candidateName(), plannedVisitName);
    }

    /**
     * Lista os agendamentos do participante no estudo ordenados cronologicamente.
     *
     * @param studyId identificador do estudo
     * @param participantId identificador do participante
     * @return agendamentos do participante em ordem crescente de data e identificador
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public List<ScheduledVisitResult> listByParticipant(Long studyId, Long participantId) {
        ParticipantSchedulingView participant =
                participantSchedulingLookup.getForScheduling(studyId, participantId);
        List<ScheduledVisit> visits = scheduledVisitRepository
                .findByStudyIdAndParticipantIdOrderByScheduledAtAscIdAsc(studyId, participantId);
        if (visits.isEmpty()) {
            return List.of();
        }
        Map<Long, String> plannedVisitNames = plannedVisitLookup.findNamesByStudy(studyId);
        return visits.stream()
                .map(visit -> new ScheduledVisitResult(
                        visit,
                        participant.candidateName(),
                        plannedVisitNames.getOrDefault(visit.getPlannedVisitId(), "")))
                .toList();
    }

    /**
     * Lista os agendamentos do estudo com filtros opcionais de estado e participante.
     *
     * @param studyId identificador do estudo
     * @param status filtro opcional de estado
     * @param participantId filtro opcional de participante no estudo
     * @return agendamentos compatíveis ordenados por data agendada e identificador
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public List<ScheduledVisitResult> listByStudy(Long studyId,
                                                  ScheduledVisitStatus status,
                                                  Long participantId) {
        if (participantId != null && participantId < 1L) {
            throw new InvalidScheduledVisitException(
                    "INVALID_PARTICIPANT_ID",
                    "O identificador do participante deve ser positivo.");
        }
        if (participantId != null) {
            participantSchedulingLookup.getForScheduling(studyId, participantId);
        } else {
            studyService.getStudy(studyId);
        }
        List<ScheduledVisit> visits = findStudyVisits(studyId, status, participantId);
        if (visits.isEmpty()) {
            return List.of();
        }
        Map<Long, String> participantNames = participantSchedulingLookup.findNamesByStudy(studyId);
        Map<Long, String> plannedVisitNames = plannedVisitLookup.findNamesByStudy(studyId);
        return visits.stream()
                .map(visit -> new ScheduledVisitResult(
                        visit,
                        participantNames.getOrDefault(visit.getParticipantId(), ""),
                        plannedVisitNames.getOrDefault(visit.getPlannedVisitId(), "")))
                .toList();
    }

    private void validateSchedulableState(Study study, ParticipantSchedulingView participant) {
        if (study.getStatus() != StudyStatus.RECRUITMENT
                && study.getStatus() != StudyStatus.EXECUTION) {
            throw new SchedulingConflictException(
                    "STUDY_STATUS_DOES_NOT_ALLOW_SCHEDULING",
                    "O estudo precisa estar em RECRUITMENT ou EXECUTION para agendar visitas.");
        }
        if (participant.withdrawn()) {
            throw new SchedulingConflictException(
                    "PARTICIPANT_WITHDRAWN",
                    "O participante foi retirado do estudo e não pode receber agendamentos.");
        }
    }

    private String findPlannedVisitName(Long studyId, Long plannedVisitId) {
        if (plannedVisitId == null) {
            throw new InvalidScheduledVisitException(
                    "PLANNED_VISIT_NOT_IN_STUDY",
                    "Informe uma visita prevista pertencente ao estudo.");
        }
        return plannedVisitLookup.findNameByStudyAndId(studyId, plannedVisitId)
                .orElseThrow(() -> new InvalidScheduledVisitException(
                        "PLANNED_VISIT_NOT_IN_STUDY",
                        "A visita prevista informada não pertence ao estudo."));
    }

    private Instant normalizeScheduledAt(Instant scheduledAt) {
        if (scheduledAt == null) {
            throw new InvalidScheduledVisitException(
                    "VISIT_DATE_NOT_FUTURE",
                    "Informe uma data e hora futuras para o agendamento.");
        }
        return scheduledAt.truncatedTo(ChronoUnit.MICROS);
    }

    private void validateVisitTiming(Study study, Instant scheduledAt, Instant now) {
        if (!scheduledAt.isAfter(now)) {
            throw new InvalidScheduledVisitException(
                    "VISIT_DATE_NOT_FUTURE",
                    "A data da visita deve ser futura em relação ao instante atual.");
        }
        LocalDate visitDay = scheduledAt.atZone(FORTALEZA_ZONE).toLocalDate();
        if (visitDay.isBefore(study.getStartDate()) || visitDay.isAfter(study.getEndDate())) {
            throw new InvalidScheduledVisitException(
                    "VISIT_DATE_OUTSIDE_STUDY_PERIOD",
                    "A data da visita no fuso America/Fortaleza está fora do período do estudo.");
        }
    }

    private void ensureNoBlockingVisit(Long participantId, Long plannedVisitId) {
        if (scheduledVisitRepository.existsByParticipantIdAndPlannedVisitIdAndStatusIn(
                participantId, plannedVisitId, BLOCKING_STATUSES)) {
            throw new SchedulingConflictException(
                    "VISIT_ALREADY_SCHEDULED",
                    "Já existe um agendamento ativo ou concluído desta visita para o participante.");
        }
    }

    private ScheduledVisit persistWithConflictTranslation(ScheduledVisit visit) {
        try {
            return scheduledVisitRepository.saveAndFlush(visit);
        } catch (DataIntegrityViolationException exception) {
            if (isDuplicateActiveVisit(exception)) {
                throw new SchedulingConflictException(
                        "VISIT_ALREADY_SCHEDULED",
                        "Já existe um agendamento ativo ou concluído desta visita para o participante.");
            }
            throw exception;
        }
    }

    private List<ScheduledVisit> findStudyVisits(Long studyId,
                                                 ScheduledVisitStatus status,
                                                 Long participantId) {
        if (participantId != null && status != null) {
            return scheduledVisitRepository
                    .findByStudyIdAndParticipantIdAndStatusOrderByScheduledAtAscIdAsc(
                            studyId, participantId, status);
        }
        if (participantId != null) {
            return scheduledVisitRepository
                    .findByStudyIdAndParticipantIdOrderByScheduledAtAscIdAsc(studyId, participantId);
        }
        if (status != null) {
            return scheduledVisitRepository
                    .findByStudyIdAndStatusOrderByScheduledAtAscIdAsc(studyId, status);
        }
        return scheduledVisitRepository.findByStudyIdOrderByScheduledAtAscIdAsc(studyId);
    }

    private boolean isDuplicateActiveVisit(DataIntegrityViolationException exception) {
        Throwable cause = exception;
        while (cause != null) {
            if (cause instanceof ConstraintViolationException constraintViolation
                    && ACTIVE_UNIQUE_INDEX.equalsIgnoreCase(constraintViolation.getConstraintName())) {
                return true;
            }
            String message = cause.getMessage();
            if (message != null && message.toLowerCase(Locale.ROOT).contains(ACTIVE_UNIQUE_INDEX)) {
                return true;
            }
            cause = cause.getCause();
        }
        return false;
    }
}
