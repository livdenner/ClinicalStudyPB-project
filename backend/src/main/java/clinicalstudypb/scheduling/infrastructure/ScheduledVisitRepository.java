package clinicalstudypb.scheduling.infrastructure;

import clinicalstudypb.scheduling.domain.ScheduledVisit;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.time.Instant;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.repository.Repository;

/**
 * Repositório JPA para persistência e consulta de visitas agendadas.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
public interface ScheduledVisitRepository extends Repository<ScheduledVisit, Long> {

    /**
     * Verifica se há agendamentos pendentes no estudo.
     *
     * @param studyId estudo consultado
     * @param status estado procurado
     * @return verdadeiro quando existe ao menos um registro
     */
    boolean existsByStudyIdAndStatus(Long studyId, ScheduledVisitStatus status);

    /**
     * Cancela apenas visitas pendentes e incrementa a versão para invalidar ETags anteriores.
     *
     * @param studyId estudo cancelado
     * @param actorUserId autor da mudança
     * @param occurredAt instante da mudança
     * @param note motivo registrado nas visitas
     * @return quantidade de visitas canceladas
     */
    @Modifying(flushAutomatically = true)
    @Query("UPDATE ScheduledVisit v SET v.status = :cancelled, v.outcomeByUserId = :actorUserId, "
            + "v.outcomeAt = :occurredAt, v.outcomeNote = :note, v.version = v.version + 1 "
            + "WHERE v.studyId = :studyId AND v.status = :scheduled")
    int cancelPendingByStudy(@Param("studyId") Long studyId,
                             @Param("actorUserId") Long actorUserId,
                             @Param("occurredAt") Instant occurredAt,
                             @Param("note") String note,
                             @Param("scheduled") ScheduledVisitStatus scheduled,
                             @Param("cancelled") ScheduledVisitStatus cancelled);

    /**
     * Persiste e força descarga imediata para validar o índice de duplicidade ativa.
     *
     * @param scheduledVisit agendamento a persistir
     * @return agendamento persistido com identificador e versão
     */
    ScheduledVisit saveAndFlush(ScheduledVisit scheduledVisit);

    /**
     * Verifica se o participante já possui agendamento nos estados informados para a visita prevista.
     *
     * @param participantId identificador do participante
     * @param plannedVisitId identificador da visita prevista
     * @param statuses estados que impedem novo agendamento
     * @return {@code true} quando há agendamento bloqueante
     */
    boolean existsByParticipantIdAndPlannedVisitIdAndStatusIn(
            Long participantId,
            Long plannedVisitId,
            Collection<ScheduledVisitStatus> statuses);

    /**
     * Busca um agendamento garantindo que pertença ao estudo e ao participante da rota.
     *
     * @param id identificador do agendamento
     * @param studyId identificador do estudo
     * @param participantId identificador do participante
     * @return agendamento correspondente ou vazio
     */
    Optional<ScheduledVisit> findByIdAndStudyIdAndParticipantId(Long id, Long studyId, Long participantId);

    /**
     * Lista todos os agendamentos do estudo ordenados cronologicamente.
     *
     * @param studyId identificador do estudo
     * @return lista ordenada por instante agendado e identificador
     */
    List<ScheduledVisit> findByStudyIdOrderByScheduledAtAscIdAsc(Long studyId);

    /**
     * Lista os agendamentos do estudo filtrados por estado.
     *
     * @param studyId identificador do estudo
     * @param status estado desejado
     * @return lista ordenada por instante agendado e identificador
     */
    List<ScheduledVisit> findByStudyIdAndStatusOrderByScheduledAtAscIdAsc(
            Long studyId,
            ScheduledVisitStatus status);

    /**
     * Lista os agendamentos de um participante dentro do estudo.
     *
     * @param studyId identificador do estudo
     * @param participantId identificador do participante
     * @return lista ordenada por instante agendado e identificador
     */
    List<ScheduledVisit> findByStudyIdAndParticipantIdOrderByScheduledAtAscIdAsc(
            Long studyId,
            Long participantId);

    /**
     * Lista os agendamentos de um participante dentro do estudo filtrados por estado.
     *
     * @param studyId identificador do estudo
     * @param participantId identificador do participante
     * @param status estado desejado
     * @return lista ordenada por instante agendado e identificador
     */
    List<ScheduledVisit> findByStudyIdAndParticipantIdAndStatusOrderByScheduledAtAscIdAsc(
            Long studyId,
            Long participantId,
            ScheduledVisitStatus status);
}
