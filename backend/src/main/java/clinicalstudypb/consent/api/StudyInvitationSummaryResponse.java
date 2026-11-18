package clinicalstudypb.consent.api;

import clinicalstudypb.candidates.domain.CandidateStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * Resumo de um convite de estudo visível para o candidato autenticado.
 *
 * @param candidateId identificador da candidatura neste estudo
 * @param studyId identificador do estudo
 * @param studyTitle título do estudo
 * @param status situação atual ({@code CONSENT_PENDING}, {@code GRANTED} ou {@code DECLINED})
 * @param decidedAt instante da decisão ou ausente enquanto pendente
 * @author Lucas N. de Araújo
 * @since 2026-11-17
 * @version 0.0.1
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "StudyInvitationSummary", requiredProperties = {"candidateId", "studyId", "studyTitle", "status"})
public record StudyInvitationSummaryResponse(
        Long candidateId,
        Long studyId,
        String studyTitle,
        CandidateStatus status,
        Instant decidedAt) {
}
