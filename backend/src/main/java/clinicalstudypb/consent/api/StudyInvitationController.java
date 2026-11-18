package clinicalstudypb.consent.api;

import clinicalstudypb.consent.application.StudyInvitationService;
import clinicalstudypb.consent.domain.StudyInvitationFilterStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Expõe a consulta de convites de estudo e a decisão de consentimento pelo participante autenticado.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-17
 * @version 0.0.1
 */
@RestController
@RequestMapping("/api/me/invitations")
@PreAuthorize("hasRole('PARTICIPANT')")
@Tag(name = "Convites do participante",
        description = "Consulta de convites e registro da decisão de consentimento pelo candidato")
@SecurityRequirement(name = "bearerAuth")
public class StudyInvitationController {

    private final StudyInvitationService invitationService;

    /**
     * Recebe o serviço de convites e decisões do participante.
     *
     * @param invitationService serviço de aplicação dos convites
     */
    public StudyInvitationController(StudyInvitationService invitationService) {
        this.invitationService = invitationService;
    }

    /**
     * Lista os convites de estudo da conta participante autenticada.
     *
     * @param status filtro opcional por situação ({@code CONSENT_PENDING}, {@code GRANTED}, {@code DECLINED})
     * @return convites da mais recente para a mais antiga candidatura
     */
    @GetMapping
    @Operation(summary = "Lista os convites de estudo do candidato autenticado (T17.1)",
            description = "Somente PARTICIPANT. Lista candidaturas CONSENT_PENDING, GRANTED ou DECLINED.",
            responses = {
                @ApiResponse(responseCode = "200", description = "Convites do candidato",
                        content = @Content(array = @ArraySchema(
                                schema = @Schema(implementation = StudyInvitationSummaryResponse.class)))),
                @ApiResponse(responseCode = "400", description = "Filtro de situação inválido"),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão")
            })
    public List<StudyInvitationSummaryResponse> list(
            @RequestParam(required = false) StudyInvitationFilterStatus status) {
        return invitationService.list(status);
    }

    /**
     * Consulta o convite detalhado com protocolo e termo simulado para a candidatura informada.
     *
     * @param candidateId identificador da candidatura do usuário autenticado
     * @return convite encontrado
     */
    @GetMapping("/{candidateId}")
    @Operation(summary = "Consulta o convite com os dados do estudo e o termo simulado (T17.1)",
            description = "Somente PARTICIPANT. Candidaturas de outra conta ou fora dos estados visíveis retornam 404.",
            responses = {
                @ApiResponse(responseCode = "200", description = "Convite encontrado",
                        content = @Content(schema = @Schema(implementation = StudyInvitationResponse.class))),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Convite não encontrado")
            })
    public StudyInvitationResponse get(@PathVariable Long candidateId) {
        return invitationService.get(candidateId);
    }

    /**
     * Registra uma única vez o aceite ou a recusa do termo simulado pelo candidato autenticado.
     *
     * @param candidateId identificador da candidatura do usuário autenticado
     * @param request decisão {@code GRANTED} ou {@code DECLINED}
     * @return convite atualizado com situação e instante da decisão
     */
    @PostMapping("/{candidateId}/decision")
    @Operation(summary = "Registra o aceite ou a recusa do termo simulado (RF10, T17.1)",
            description = "Somente PARTICIPANT dono da candidatura. Decisão única e imutável.",
            responses = {
                @ApiResponse(responseCode = "200", description = "Decisão registrada",
                        content = @Content(schema = @Schema(implementation = StudyInvitationResponse.class))),
                @ApiResponse(responseCode = "400", description = "Status ausente ou inválido"),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Candidatura inexistente ou de outra conta"),
                @ApiResponse(responseCode = "409",
                        description = "CANDIDATE_CANCELLED, CONSENT_ALREADY_DECIDED, "
                                + "CONSENT_NOT_AVAILABLE ou STUDY_NOT_RECRUITING")
            })
    public StudyInvitationResponse decide(
            @PathVariable Long candidateId,
            @Valid @RequestBody SimulatedConsentWriteRequest request) {
        return invitationService.decide(candidateId, request.status());
    }
}
