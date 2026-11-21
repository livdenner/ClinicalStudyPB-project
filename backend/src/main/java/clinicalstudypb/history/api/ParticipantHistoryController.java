package clinicalstudypb.history.api;

import clinicalstudypb.history.application.ParticipantHistoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Consulta somente leitura do histórico do participante no estudo (RF15, T21.1).
 *
 * @author Allan Guilherme
 * @since 2026-11-19
 * @version 0.0.1
 */
@RestController
@RequestMapping("/api/studies/{studyId}/participants/{participantId}/history")
@Tag(name = "Participantes")
@SecurityRequirement(name = "bearerAuth")
public class ParticipantHistoryController {

    private final ParticipantHistoryService participantHistoryService;

    /**
     * Recebe o serviço que monta o histórico.
     *
     * @param participantHistoryService composição do histórico
     */
    public ParticipantHistoryController(ParticipantHistoryService participantHistoryService) {
        this.participantHistoryService = participantHistoryService;
    }

    /**
     * Retorna a situação do participante e as visitas em ordem cronológica, com desfechos e resultados.
     *
     * @param studyId estudo da rota
     * @param participantId participante da rota, que precisa pertencer ao estudo
     * @return histórico do participante
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('RESEARCHER', 'COORDINATOR')")
    @Operation(summary = "Consulta o histórico do participante (RF15, T21.1)",
            description = "Somente leitura. RESEARCHER ou COORDINATOR. Visitas em ordem de scheduledAt, "
                    + "cada uma com desfecho e resultados; sem visitas, visits=[].",
            responses = {
                @ApiResponse(responseCode = "200", description = "Histórico do participante",
                        content = @Content(schema = @Schema(implementation = ParticipantHistoryResponse.class))),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo ou participante não encontrado")
            })
    public ParticipantHistoryResponse get(@PathVariable Long studyId, @PathVariable Long participantId) {
        return ParticipantHistoryResponse.from(participantHistoryService.get(studyId, participantId));
    }
}
