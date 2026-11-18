package clinicalstudypb.consent.api;

import clinicalstudypb.candidates.domain.CandidateStatus;
import clinicalstudypb.visits.api.PlannedVisitResponse;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Detalhe de um convite de estudo com protocolo previsto e termo simulado para decisão do candidato.
 *
 * @param candidateId identificador da candidatura neste estudo
 * @param studyId identificador do estudo
 * @param studyTitle título do estudo
 * @param studyObjective objetivo clínico do estudo
 * @param startDate data de início do estudo
 * @param endDate data de término do estudo
 * @param responsibleName nome do pesquisador responsável pelo estudo
 * @param plannedVisits visitas previstas na ordem do protocolo com suas atividades
 * @param termText texto fixo do termo simulado sem valor legal
 * @param status situação atual da decisão do convite
 * @param decidedAt instante da decisão ou ausente enquanto pendente
 * @author Lucas N. de Araújo
 * @since 2026-11-17
 * @version 0.0.1
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "StudyInvitation", requiredProperties = {
    "candidateId", "studyId", "studyTitle", "studyObjective", "startDate", "endDate",
    "responsibleName", "plannedVisits", "termText", "status"
})
public record StudyInvitationResponse(
        Long candidateId,
        Long studyId,
        String studyTitle,
        String studyObjective,
        LocalDate startDate,
        LocalDate endDate,
        String responsibleName,
        List<PlannedVisitResponse> plannedVisits,
        String termText,
        CandidateStatus status,
        Instant decidedAt) {
}
