package clinicalstudypb.visits.application;

import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.InvalidStudyException;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.visits.api.PlannedActivityRequest;
import clinicalstudypb.visits.api.PlannedActivityResponse;
import clinicalstudypb.visits.api.PlannedVisitRequest;
import clinicalstudypb.visits.api.PlannedVisitResponse;
import clinicalstudypb.visits.domain.PlannedVisit;
import clinicalstudypb.visits.domain.ProtocolConflictException;
import clinicalstudypb.visits.infrastructure.PlannedVisitRepository;
import java.sql.Date;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mantém visitas previstas e atividades como parte do protocolo de um estudo.
 * Toda alteração bloqueia a linha do estudo; o banco valida posições únicas no commit.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
@Service
public class PlannedVisitService {

    private final JdbcTemplate jdbc;
    private final StudyService studies;
    private final PlannedVisitRepository visits;

    /**
     * Recebe o acesso transacional ao banco e às regras do estudo.
     *
     * @param jdbc acesso SQL ao protocolo
     * @param studies regras de estudo e responsável
     * @param visits leitura JPA das visitas com suas atividades
     */
    public PlannedVisitService(JdbcTemplate jdbc, StudyService studies, PlannedVisitRepository visits) {
        this.jdbc = jdbc;
        this.studies = studies;
        this.visits = visits;
    }

    /**
     * Lista as visitas na ordem definida pelo protocolo.
     *
     * @param studyId identificador do estudo
     * @return visitas com atividades
     */
    @Transactional(readOnly = true)
    public List<PlannedVisitResponse> list(Long studyId) {
        studies.getStudy(studyId);
        return visits.findByStudyIdOrderByPositionAsc(studyId).stream()
                .map(this::toResponse).toList();
    }

    /**
     * Consulta uma visita e confere seu estudo.
     *
     * @param studyId identificador do estudo
     * @param visitId identificador da visita
     * @return visita encontrada
     */
    @Transactional(readOnly = true)
    public PlannedVisitResponse get(Long studyId, Long visitId) {
        studies.getStudy(studyId);
        PlannedVisit visit = visits.findByIdAndStudyId(visitId, studyId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Visita prevista não encontrada: " + visitId));
        return toResponse(visit);
    }

    /**
     * Insere uma visita em uma posição e desloca as posteriores.
     *
     * @param studyId identificador do estudo
     * @param request visita e atividades
     * @param expectedVersion versão do estudo consultada pelo cliente
     * @return visita criada
     */
    @Transactional
    public PlannedVisitResponse create(Long studyId, PlannedVisitRequest request, Long expectedVersion) {
        Study study = studies.lockForProtocolEdit(studyId);
        studies.touchProtocol(study, expectedVersion);
        validate(study, request);
        int count = visitCount(studyId);
        int position = request.position() == null ? count + 1 : request.position();
        if (position < 1 || position > count + 1) {
            throw new InvalidStudyException("A posição da visita deve estar entre 1 e " + (count + 1) + ".");
        }
        jdbc.update("UPDATE planned_visits SET position = position + 1 "
                + "WHERE study_id = ? AND position >= ?", studyId, position);
        Long id = jdbc.queryForObject(
                "INSERT INTO planned_visits (study_id, name, planned_date, position) "
                        + "VALUES (?, ?, ?, ?) RETURNING id", Long.class,
                studyId, request.name().strip(), Date.valueOf(request.plannedDate()), position);
        writeActivities(id, request.activities(), Set.of());
        return get(studyId, id);
    }

    /**
     * Atualiza visita e lista completa de atividades, mantendo IDs informados.
     *
     * @param studyId identificador do estudo
     * @param visitId identificador da visita
     * @param request novos dados e ordem
     * @param expectedVersion versão do estudo consultada pelo cliente
     * @return visita atualizada
     */
    @Transactional
    public PlannedVisitResponse update(Long studyId, Long visitId, PlannedVisitRequest request,
                                       Long expectedVersion) {
        Study study = studies.lockForProtocolEdit(studyId);
        studies.touchProtocol(study, expectedVersion);
        VisitRow visit = findVisit(studyId, visitId);
        validate(study, request);
        int count = visitCount(studyId);
        int position = request.position() == null ? visit.position() : request.position();
        if (position < 1 || position > count) {
            throw new InvalidStudyException("A posição da visita deve estar entre 1 e " + count + ".");
        }
        if (position < visit.position()) {
            jdbc.update("UPDATE planned_visits SET position = position + 1 "
                    + "WHERE study_id = ? AND position >= ? AND position < ?",
                    studyId, position, visit.position());
        } else if (position > visit.position()) {
            jdbc.update("UPDATE planned_visits SET position = position - 1 "
                    + "WHERE study_id = ? AND position > ? AND position <= ?",
                    studyId, visit.position(), position);
        }
        jdbc.update("UPDATE planned_visits SET name = ?, planned_date = ?, position = ? WHERE id = ?",
                request.name().strip(), Date.valueOf(request.plannedDate()), position, visitId);
        Set<Long> existing = new HashSet<>(jdbc.query(
                "SELECT id FROM planned_activities WHERE planned_visit_id = ?",
                (rs, row) -> rs.getLong("id"), visitId));
        writeActivities(visitId, request.activities(), existing);
        return get(studyId, visitId);
    }

    /**
     * Remove uma visita e fecha a lacuna nas posições.
     *
     * @param studyId identificador do estudo
     * @param visitId identificador da visita
     * @param expectedVersion versão do estudo consultada pelo cliente
     */
    @Transactional
    public void delete(Long studyId, Long visitId, Long expectedVersion) {
        Study study = studies.lockForProtocolEdit(studyId);
        studies.touchProtocol(study, expectedVersion);
        VisitRow visit = findVisit(studyId, visitId);
        if (study.getStatus() == StudyStatus.RECRUITMENT && visitCount(studyId) == 1) {
            throw new ProtocolConflictException("O estudo em recrutamento precisa manter uma visita prevista.");
        }
        jdbc.update("DELETE FROM planned_visits WHERE id = ?", visitId);
        jdbc.update("UPDATE planned_visits SET position = position - 1 "
                + "WHERE study_id = ? AND position > ?", studyId, visit.position());
    }

    /**
     * Reordena todas as visitas de um estudo de modo atômico.
     *
     * @param studyId identificador do estudo
     * @param ids IDs na nova ordem completa
     * @param expectedVersion versão do estudo consultada pelo cliente
     * @return visitas na nova ordem
     */
    @Transactional
    public List<PlannedVisitResponse> reorder(Long studyId, List<Long> ids, Long expectedVersion) {
        Study study = studies.lockForProtocolEdit(studyId);
        studies.touchProtocol(study, expectedVersion);
        List<Long> existing = jdbc.query("SELECT id FROM planned_visits WHERE study_id = ?",
                (rs, row) -> rs.getLong("id"), studyId);
        if (ids == null || ids.size() != existing.size()
                || !new HashSet<>(ids).equals(new HashSet<>(existing))) {
            throw new InvalidStudyException("Informe uma vez cada visita do estudo na nova ordem.");
        }
        for (int index = 0; index < ids.size(); index++) {
            jdbc.update("UPDATE planned_visits SET position = ? WHERE id = ?", index + 1, ids.get(index));
        }
        return list(studyId);
    }

    /**
     * Remove uma atividade, preservando ao menos uma na visita.
     *
     * @param studyId identificador do estudo
     * @param visitId identificador da visita
     * @param activityId identificador da atividade
     * @param expectedVersion versão do estudo consultada pelo cliente
     */
    @Transactional
    public void deleteActivity(Long studyId, Long visitId, Long activityId, Long expectedVersion) {
        Study study = studies.lockForProtocolEdit(studyId);
        studies.touchProtocol(study, expectedVersion);
        findVisit(studyId, visitId);
        List<Integer> positions = jdbc.query("SELECT position FROM planned_activities "
                        + "WHERE id = ? AND planned_visit_id = ?",
                (rs, row) -> rs.getInt("position"), activityId, visitId);
        if (positions.isEmpty()) {
            throw new ResourceNotFoundException("Atividade não encontrada: " + activityId);
        }
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM planned_activities WHERE planned_visit_id = ?",
                Integer.class, visitId);
        if (count == null || count <= 1) {
            throw new ProtocolConflictException("A visita precisa manter pelo menos uma atividade.");
        }
        jdbc.update("DELETE FROM planned_activities WHERE id = ?", activityId);
        jdbc.update("UPDATE planned_activities SET position = position - 1 "
                + "WHERE planned_visit_id = ? AND position > ?", visitId, positions.getFirst());
    }

    private VisitRow findVisit(Long studyId, Long visitId) {
        return jdbc.query("SELECT id, name, planned_date, position FROM planned_visits "
                        + "WHERE id = ? AND study_id = ?",
                (rs, row) -> new VisitRow(rs.getLong("id"), rs.getString("name"),
                        rs.getDate("planned_date").toLocalDate(), rs.getInt("position")),
                visitId, studyId).stream().findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Visita prevista não encontrada: " + visitId));
    }

    private int visitCount(Long studyId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM planned_visits WHERE study_id = ?", Integer.class, studyId);
        return count == null ? 0 : count;
    }

    private void validate(Study study, PlannedVisitRequest request) {
        if (request == null || request.name() == null || request.name().isBlank()
                || request.name().strip().length() > 120 || request.plannedDate() == null) {
            throw new InvalidStudyException("Informe nome e data válidos para a visita.");
        }
        LocalDate date = request.plannedDate();
        if (date.isBefore(study.getStartDate()) || date.isAfter(study.getEndDate())) {
            throw new InvalidStudyException("A data da visita deve estar no período do estudo.");
        }
        if (request.activities() == null || request.activities().isEmpty()) {
            throw new InvalidStudyException("A visita precisa ter pelo menos uma atividade.");
        }
        Set<String> names = new HashSet<>();
        for (PlannedActivityRequest activity : request.activities()) {
            if (activity == null || activity.name() == null || activity.name().isBlank()
                    || activity.name().strip().length() > 120
                    || activity.description() == null || activity.description().isBlank()
                    || activity.description().strip().length() > 500) {
                throw new InvalidStudyException("Informe nome e descrição válidos para cada atividade.");
            }
            if (!names.add(nameKey(activity.name()))) {
                throw new InvalidStudyException("Não repita o nome de uma atividade na mesma visita.");
            }
        }
    }

    private void writeActivities(Long visitId, List<PlannedActivityRequest> activities, Set<Long> existing) {
        Set<Long> retained = new HashSet<>();
        for (int index = 0; index < activities.size(); index++) {
            PlannedActivityRequest activity = activities.get(index);
            Long id = activity.id();
            String name = activity.name().strip();
            String description = activity.description().strip();
            if (id == null) {
                jdbc.update("INSERT INTO planned_activities "
                        + "(planned_visit_id, name, name_key, description, position) VALUES (?, ?, ?, ?, ?)",
                        visitId, name, nameKey(name), description, index + 1);
            } else {
                if (!existing.contains(id) || !retained.add(id)) {
                    throw new InvalidStudyException("A atividade informada não pertence à visita ou está repetida.");
                }
                jdbc.update("UPDATE planned_activities SET name = ?, name_key = ?, description = ?, "
                        + "position = ? WHERE id = ? AND planned_visit_id = ?",
                        name, nameKey(name), description, index + 1, id, visitId);
            }
        }
        for (Long id : existing) {
            if (!retained.contains(id)) {
                jdbc.update("DELETE FROM planned_activities WHERE id = ?", id);
            }
        }
    }

    private String nameKey(String name) {
        return name.strip().toLowerCase(Locale.ROOT);
    }

    private PlannedVisitResponse toResponse(PlannedVisit visit) {
        List<PlannedActivityResponse> activities = visit.getActivities().stream()
                .map(activity -> new PlannedActivityResponse(activity.getId(), activity.getName(),
                        activity.getDescription(), activity.getPosition()))
                .toList();
        return new PlannedVisitResponse(visit.getId(), visit.getStudyId(), visit.getName(),
                visit.getPlannedDate(), visit.getPosition(), activities);
    }

    private record VisitRow(Long id, String name, LocalDate plannedDate, Integer position) {
    }
}
