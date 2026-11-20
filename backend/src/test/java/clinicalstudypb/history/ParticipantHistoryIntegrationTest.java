package clinicalstudypb.history;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.support.IntegrationTestSupport;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Locale;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Verifica sobre PostgreSQL real o histórico do participante (RF15, T21.1): visitas em ordem
 * cronológica com desfecho e resultados na ordem do protocolo, situação ativa e retirada,
 * participante sem histórico, isolamento entre participantes e estudos, e perfis de acesso.
 *
 * @author Allan Guilherme
 * @since 2026-11-19
 * @version 0.0.1
 */
class ParticipantHistoryIntegrationTest extends IntegrationTestSupport {

    private static final String HISTORY = "/api/studies/{studyId}/participants/{participantId}/history";
    private static final String RESULT =
            "/api/studies/{studyId}/participants/{participantId}/visits/{visitId}/results/{activityId}";
    private static final String WITHDRAWAL = "/api/studies/{studyId}/participants/{participantId}/withdrawal";

    @Autowired
    private JdbcTemplate jdbc;

    private User researcher;
    private User coordinator;
    private String researcherToken;
    private String otherResearcherToken;
    private String coordinatorToken;
    private String adminToken;
    private String participantToken;

    private Long studyA;
    private Long studyB;
    private Long initial;
    private Long followUp;
    private Long closing;
    private Long pressure;
    private Long weight;
    private Long interview;

    private Long ana;
    private Long bruno;
    private Long carla;
    private Long davi;
    private Long eva;

    private Long anaScheduled;
    private Long anaDone;
    private Long anaAbsent;
    private Long anaCancelled;
    private Long daviDone;
    private Long daviFuture;

    @BeforeEach
    void prepare() throws Exception {
        researcher = saveUser("Paula Pesquisadora", "history.researcher@test.local", UserRole.RESEARCHER);
        User otherResearcher = saveUser("Outro Pesquisador", "history.other@test.local", UserRole.RESEARCHER);
        coordinator = saveUser("Coordenadora", "history.coordinator@test.local", UserRole.COORDINATOR);
        User admin = saveUser("Administrador", "history.admin@test.local", UserRole.ADMINISTRATOR);
        User anaAccount = saveUser("Ana Souza", "history.ana@clinicalstudypb.test", UserRole.PARTICIPANT);
        researcherToken = tokenFor(researcher.getEmail());
        otherResearcherToken = tokenFor(otherResearcher.getEmail());
        coordinatorToken = tokenFor(coordinator.getEmail());
        adminToken = tokenFor(admin.getEmail());
        participantToken = tokenFor(anaAccount.getEmail());

        studyA = study("Estudo A", researcher);
        studyB = study("Estudo B", researcher);
        initial = plannedVisit(studyA, 1, "Inicial");
        followUp = plannedVisit(studyA, 2, "Retorno");
        closing = plannedVisit(studyA, 3, "Encerramento");
        pressure = activity(initial, "Pressão", 1);
        weight = activity(initial, "Peso", 2);
        interview = activity(followUp, "Entrevista", 1);
        Long initialB = plannedVisit(studyB, 1, "Inicial B");

        ana = participant(studyA, candidate(studyA, anaAccount), "2026-11-01T12:00:00Z");
        bruno = participant(studyA, candidate(studyA, account("Bruno Lima")), "2026-11-02T12:00:00Z");
        carla = participant(studyA, candidate(studyA, account("Carla Dias")), "2026-11-03T12:00:00Z");
        davi = participant(studyA, candidate(studyA, account("Davi Rocha")), "2026-11-04T12:00:00Z");
        eva = participant(studyB, candidate(studyB, account("Eva Melo")), "2026-11-05T12:00:00Z");

        // Inseridas fora da ordem cronológica: a consulta precisa ordenar por scheduledAt, não pelo id.
        anaScheduled = visit(studyA, ana, closing, "2027-04-01T12:00:00Z", "SCHEDULED", null);
        anaDone = visit(studyA, ana, initial, "2027-01-10T12:00:00Z", "DONE", "Pressão aferida");
        anaAbsent = visit(studyA, ana, followUp, "2027-02-01T12:00:00Z", "ABSENT", "Não compareceu");
        anaCancelled = visit(studyA, ana, followUp, "2027-02-01T12:00:00Z", "CANCELLED", "Pediu para remarcar");
        // Resultado da segunda atividade gravado antes do da primeira: a resposta segue o protocolo.
        result(anaDone, weight, "70 kg", null, "2027-01-10T14:00:00Z");
        result(anaDone, pressure, "120x80 mmHg", "Em repouso", "2027-01-10T13:00:00Z");

        Long brunoDone = visit(studyA, bruno, initial, "2027-01-05T12:00:00Z", "DONE", null);
        result(brunoDone, pressure, "valor de outro participante", null, "2027-01-05T13:00:00Z");

        daviDone = visit(studyA, davi, initial, "2027-01-12T12:00:00Z", "DONE", null);
        result(daviDone, pressure, "130x85 mmHg", null, "2027-01-12T13:00:00Z");
        daviFuture = visit(studyA, davi, followUp, "2027-05-01T12:00:00Z", "SCHEDULED", null);

        Long evaDone = visit(studyB, eva, initialB, "2027-01-15T12:00:00Z", "DONE", null);
        jdbc.update("UPDATE scheduled_visits SET outcome_note = 'Visita de outro estudo' WHERE id = ?", evaDone);
    }

    @Test
    void returnsVisitsInChronologicalOrderWithOutcomesAndResultsInProtocolOrder() throws Exception {
        history(studyA, ana, coordinatorToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participant.id").value(ana))
                .andExpect(jsonPath("$.participant.studyId").value(studyA))
                .andExpect(jsonPath("$.participant.candidateName").value("Ana Souza"))
                .andExpect(jsonPath("$.participant.includedAt").value("2026-11-01T12:00:00Z"))
                .andExpect(jsonPath("$.participant.status").value("ACTIVE"))
                .andExpect(jsonPath("$.participant.withdrawal").doesNotExist())
                // Empate em scheduledAt (ausente e cancelada) é resolvido pelo id da visita.
                .andExpect(jsonPath("$.visits[*].id").value(contains(anaDone.intValue(), anaAbsent.intValue(),
                        anaCancelled.intValue(), anaScheduled.intValue())))
                .andExpect(jsonPath("$.visits[*].status").value(contains("DONE", "ABSENT", "CANCELLED", "SCHEDULED")))
                .andExpect(jsonPath("$.visits[*].participantId").value(everyItem(is(ana.intValue()))))
                .andExpect(jsonPath("$.visits[0].studyId").value(studyA))
                .andExpect(jsonPath("$.visits[0].participantName").value("Ana Souza"))
                .andExpect(jsonPath("$.visits[0].plannedVisitId").value(initial))
                .andExpect(jsonPath("$.visits[0].plannedVisitName").value("Inicial"))
                .andExpect(jsonPath("$.visits[0].scheduledAt").value("2027-01-10T12:00:00Z"))
                .andExpect(jsonPath("$.visits[0].createdByUserId").value(coordinator.getId()))
                .andExpect(jsonPath("$.visits[0].createdAt").value("2026-09-01T12:00:00Z"))
                .andExpect(jsonPath("$.visits[0].outcomeByUserId").value(coordinator.getId()))
                .andExpect(jsonPath("$.visits[0].outcomeAt").value("2027-01-20T12:00:00Z"))
                .andExpect(jsonPath("$.visits[0].outcomeNote").value("Pressão aferida"))
                .andExpect(jsonPath("$.visits[0].version").value(1))
                .andExpect(jsonPath("$.visits[0].results[*].activityId").value(contains(
                        pressure.intValue(), weight.intValue())))
                .andExpect(jsonPath("$.visits[0].results[0].visitId").value(anaDone))
                .andExpect(jsonPath("$.visits[0].results[0].value").value("120x80 mmHg"))
                .andExpect(jsonPath("$.visits[0].results[0].note").value("Em repouso"))
                .andExpect(jsonPath("$.visits[0].results[0].recordedByUserId").value(researcher.getId()))
                .andExpect(jsonPath("$.visits[0].results[0].recordedAt").value("2027-01-10T13:00:00Z"))
                .andExpect(jsonPath("$.visits[0].results[1].value").value("70 kg"))
                .andExpect(jsonPath("$.visits[0].results[1].note").doesNotExist())
                .andExpect(jsonPath("$.visits[1].outcomeNote").value("Não compareceu"))
                .andExpect(jsonPath("$.visits[1].results", empty()))
                .andExpect(jsonPath("$.visits[2].plannedVisitName").value("Retorno"))
                .andExpect(jsonPath("$.visits[2].outcomeNote").value("Pediu para remarcar"))
                .andExpect(jsonPath("$.visits[2].results", empty()))
                .andExpect(jsonPath("$.visits[3].plannedVisitName").value("Encerramento"))
                .andExpect(jsonPath("$.visits[3].version").value(0))
                .andExpect(jsonPath("$.visits[3].outcomeByUserId").doesNotExist())
                .andExpect(jsonPath("$.visits[3].outcomeAt").doesNotExist())
                .andExpect(jsonPath("$.visits[3].outcomeNote").doesNotExist())
                .andExpect(jsonPath("$.visits[3].results", empty()));
    }

    @Test
    void participantWithoutHistoryGetsEmptyVisitsThenSeesResultRecordedThroughTheApi() throws Exception {
        history(studyA, carla, researcherToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participant.id").value(carla))
                .andExpect(jsonPath("$.participant.status").value("ACTIVE"))
                .andExpect(jsonPath("$.visits", empty()));

        Long carlaDone = visit(studyA, carla, followUp, "2027-02-10T12:00:00Z", "DONE", null);
        mockMvc.perform(put(RESULT, studyA, carla, carlaDone, interview)
                        .header(HttpHeaders.AUTHORIZATION, bearer(researcherToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"value\":\"Relato sem queixas\"}"))
                .andExpect(status().isCreated());

        history(studyA, carla, coordinatorToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visits", hasSize(1)))
                .andExpect(jsonPath("$.visits[0].id").value(carlaDone))
                .andExpect(jsonPath("$.visits[0].status").value("DONE"))
                .andExpect(jsonPath("$.visits[0].results", hasSize(1)))
                .andExpect(jsonPath("$.visits[0].results[0].activityId").value(interview))
                .andExpect(jsonPath("$.visits[0].results[0].value").value("Relato sem queixas"))
                .andExpect(jsonPath("$.visits[0].results[0].recordedByUserId").value(researcher.getId()));
    }

    @Test
    void withdrawnParticipantShowsWithdrawalCancelledFutureVisitAndEarlierResults() throws Exception {
        mockMvc.perform(post(WITHDRAWAL, studyA, davi)
                        .header(HttpHeaders.AUTHORIZATION, bearer(coordinatorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Mudou de cidade\"}"))
                .andExpect(status().isOk());

        history(studyA, davi, researcherToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participant.status").value("WITHDRAWN"))
                .andExpect(jsonPath("$.participant.withdrawal.reason").value("Mudou de cidade"))
                .andExpect(jsonPath("$.participant.withdrawal.withdrawnByUserId").value(coordinator.getId()))
                .andExpect(jsonPath("$.participant.withdrawal.withdrawnAt").exists())
                .andExpect(jsonPath("$.participant.withdrawal.cancelledVisitCount").value(1))
                .andExpect(jsonPath("$.visits[*].id").value(contains(daviDone.intValue(), daviFuture.intValue())))
                .andExpect(jsonPath("$.visits[0].status").value("DONE"))
                .andExpect(jsonPath("$.visits[0].results[0].value").value("130x85 mmHg"))
                .andExpect(jsonPath("$.visits[1].status").value("CANCELLED"))
                .andExpect(jsonPath("$.visits[1].outcomeNote").value("Retirada do participante"))
                .andExpect(jsonPath("$.visits[1].outcomeByUserId").value(coordinator.getId()))
                .andExpect(jsonPath("$.visits[1].version").value(1))
                .andExpect(jsonPath("$.visits[1].results", empty()));
    }

    @Test
    void historyNeverMixesOtherParticipantsOfTheSameStudy() throws Exception {
        history(studyA, bruno, coordinatorToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visits", hasSize(1)))
                .andExpect(jsonPath("$.visits[0].participantId").value(bruno))
                .andExpect(jsonPath("$.visits[0].results[*].value").value(contains("valor de outro participante")));
        history(studyA, ana, coordinatorToken)
                .andExpect(jsonPath("$.visits[*].results[*].value").value(contains(
                        "120x80 mmHg", "70 kg")));
    }

    @Test
    void participantOfAnotherStudyOrMissingRecordsReturnNotFound() throws Exception {
        history(studyA, eva, coordinatorToken).andExpect(status().isNotFound());
        history(studyB, ana, coordinatorToken).andExpect(status().isNotFound());
        history(studyA, eva + 1000000, researcherToken).andExpect(status().isNotFound());
        history(studyB + 1000000, eva, researcherToken).andExpect(status().isNotFound());
        history(studyB, eva, coordinatorToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participant.id").value(eva))
                .andExpect(jsonPath("$.visits[*].outcomeNote").value(contains("Visita de outro estudo")));
    }

    @Test
    void researcherAndCoordinatorReadWhileOtherProfilesAreRefused() throws Exception {
        for (String token : new String[] {researcherToken, otherResearcherToken, coordinatorToken}) {
            history(studyA, ana, token).andExpect(status().isOk());
        }
        for (String token : new String[] {adminToken, participantToken}) {
            history(studyA, ana, token).andExpect(status().isForbidden());
        }
        mockMvc.perform(get(HISTORY, studyA, ana)).andExpect(status().isUnauthorized());
    }

    private ResultActions history(Long studyId, Long participantId, String token) throws Exception {
        return mockMvc.perform(get(HISTORY, studyId, participantId)
                .header(HttpHeaders.AUTHORIZATION, bearer(token)));
    }

    private User account(String name) {
        String email = "history." + name.toLowerCase(Locale.ROOT).replace(' ', '.') + "@clinicalstudypb.test";
        return saveUser(name, email, UserRole.PARTICIPANT);
    }

    private Long study(String title, User responsible) {
        Long id = studyRepository.save(new Study(title, "Objetivo de " + title, responsible.getId(),
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 12, 31), 10)).getId();
        jdbc.update("UPDATE studies SET status = 'EXECUTION' WHERE id = ?", id);
        return id;
    }

    private Long plannedVisit(Long studyId, int position, String name) {
        return jdbc.queryForObject("INSERT INTO planned_visits (study_id, name, planned_date, position) "
                + "VALUES (?, ?, '2027-06-01', ?) RETURNING id", Long.class, studyId, name, position);
    }

    private Long activity(Long plannedVisitId, String name, int position) {
        return jdbc.queryForObject("INSERT INTO planned_activities "
                + "(planned_visit_id, name, name_key, description, position) "
                + "VALUES (?, ?, ?, 'Atividade de teste', ?) RETURNING id",
                Long.class, plannedVisitId, name, name.toLowerCase(Locale.ROOT), position);
    }

    private Long candidate(Long studyId, User account) {
        return jdbc.queryForObject("INSERT INTO candidates (study_id, name, name_key, age, email, phone, user_id) "
                + "VALUES (?, ?, ?, 35, ?, '(83) 99999-0000', ?) RETURNING id", Long.class, studyId,
                account.getName(), account.getName().toLowerCase(Locale.ROOT), account.getEmail(), account.getId());
    }

    private Long participant(Long studyId, Long candidateId, String includedAt) {
        return jdbc.queryForObject("INSERT INTO participants (study_id, candidate_id, included_by, included_at) "
                + "VALUES (?, ?, ?, ?) RETURNING id", Long.class, studyId, candidateId, coordinator.getId(),
                ts(includedAt));
    }

    private Long visit(Long studyId, Long participantId, Long plannedVisitId, String scheduledAt, String status,
                       String note) {
        boolean finalStatus = !"SCHEDULED".equals(status);
        return jdbc.queryForObject("INSERT INTO scheduled_visits (study_id, participant_id, planned_visit_id, "
                + "scheduled_at, status, created_by_user_id, created_at, outcome_by_user_id, outcome_at, "
                + "outcome_note, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id", Long.class,
                studyId, participantId, plannedVisitId, ts(scheduledAt), status, coordinator.getId(),
                ts("2026-09-01T12:00:00Z"), finalStatus ? coordinator.getId() : null,
                finalStatus ? ts("2027-01-20T12:00:00Z") : null, note, finalStatus ? 1 : 0);
    }

    private void result(Long visitId, Long activityId, String value, String note, String recordedAt) {
        jdbc.update("INSERT INTO activity_results (scheduled_visit_id, planned_activity_id, value, note, "
                + "recorded_by_user_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?)",
                visitId, activityId, value, note, researcher.getId(), ts(recordedAt));
    }

    private static Timestamp ts(String instant) {
        return Timestamp.from(Instant.parse(instant));
    }
}
