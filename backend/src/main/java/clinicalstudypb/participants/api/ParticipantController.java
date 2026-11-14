package clinicalstudypb.participants.api;

import clinicalstudypb.participants.application.ParticipantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Expõe inclusão, consultas e retirada de participantes conforme o contrato (RF11 e RF16).
 *
 * @author Lívia
 * @since 2026-11-09
 * @version 0.0.1
 */
@RestController
@RequestMapping("/api/studies/{studyId}")
@Tag(name = "Participantes", description = "Inclusão, consulta e retirada de participantes por estudo")
@SecurityRequirement(name = "bearerAuth")
public class ParticipantController {

    private final ParticipantService participantService;

    /**
     * Recebe o serviço transacional do módulo.
     *
     * @param participantService operações transacionais de participantes
     */
    public ParticipantController(ParticipantService participantService) {
        this.participantService = participantService;
    }

    /**
     * Inclui o candidato e informa o endereço de consulta do participante.
     *
     * @param studyId estudo da rota
     * @param candidateId candidato da rota; a operação não recebe corpo JSON
     * @return participante criado e endereço de consulta no cabeçalho Location
     */
    @PostMapping("/candidates/{candidateId}/inclusion")
    @PreAuthorize("hasRole('COORDINATOR')")
    @Operation(summary = "Inclui candidato como participante",
            description = "Somente COORDINATOR. Exige RECRUITMENT, elegibilidade, consentimento e vaga.",
            responses = {
                @ApiResponse(responseCode = "201", description = "Participante incluído",
                        headers = @Header(name = "Location", description = "Caminho do participante criado",
                                schema = @Schema(type = "string")),
                        content = @Content(schema = @Schema(implementation = ParticipantResponse.class))),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo ou candidato não encontrado"),
                @ApiResponse(responseCode = "409", description = "Pré-condição de inclusão não atendida")
            })
    public ResponseEntity<ParticipantResponse> include(@PathVariable Long studyId, @PathVariable Long candidateId) {
        ParticipantResponse created = ParticipantResponse.from(participantService.include(studyId, candidateId));
        URI location = URI.create("/api/studies/" + studyId + "/participants/" + created.id());
        return ResponseEntity.created(location).body(created);
    }

    /**
     * Lista as inclusões do estudo.
     *
     * @param studyId estudo da rota
     * @return participantes incluídos no estudo
     */
    @GetMapping("/participants")
    @PreAuthorize("hasAnyRole('COORDINATOR', 'RESEARCHER')")
    @Operation(summary = "Lista participantes incluídos no estudo",
            description = "RESEARCHER ou COORDINATOR. Retorna lista vazia quando não há inclusões.",
            responses = {
                @ApiResponse(responseCode = "200", description = "Participantes do estudo",
                        content = @Content(array = @ArraySchema(
                                schema = @Schema(implementation = ParticipantResponse.class)))),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo não encontrado")
            })
    public List<ParticipantResponse> list(@PathVariable Long studyId) {
        return participantService.list(studyId).stream().map(ParticipantResponse::from).toList();
    }

    /**
     * Consulta um vínculo dentro do estudo indicado pela rota.
     *
     * @param studyId estudo da rota
     * @param participantId vínculo consultado
     * @return participante do estudo
     */
    @GetMapping("/participants/{participantId}")
    @PreAuthorize("hasAnyRole('COORDINATOR', 'RESEARCHER')")
    @Operation(summary = "Consulta um participante do estudo",
            description = "RESEARCHER ou COORDINATOR. O participante deve pertencer ao estudo.",
            responses = {
                @ApiResponse(responseCode = "200", description = "Participante encontrado",
                        content = @Content(schema = @Schema(implementation = ParticipantResponse.class))),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo ou participante não encontrado")
            })
    public ParticipantResponse get(@PathVariable Long studyId, @PathVariable Long participantId) {
        return ParticipantResponse.from(participantService.get(studyId, participantId));
    }

    /**
     * Registra a retirada do participante e cancela as visitas futuras na mesma operação.
     *
     * @param studyId estudo da rota
     * @param participantId participante da rota
     * @param request motivo da retirada
     * @return participante retirado, com os dados da retirada
     */
    @PostMapping("/participants/{participantId}/withdrawal")
    @PreAuthorize("hasRole('COORDINATOR')")
    @Operation(summary = "Registra a retirada do participante (RF16, T22.1)",
            description = "Somente COORDINATOR. Motivo obrigatório; data e autor gravados pelo backend. "
                    + "Cancela as visitas SCHEDULED posteriores à retirada com outcomeNote "
                    + "\"Retirada do participante\", na mesma operação atômica. A vaga não volta ao estudo "
                    + "e o candidato não pode ser reincluído.",
            responses = {
                @ApiResponse(responseCode = "200", description = "Retirada registrada",
                        content = @Content(schema = @Schema(implementation = ParticipantResponse.class))),
                @ApiResponse(responseCode = "400", description = "Motivo ausente, em branco ou com mais de 500 "
                        + "caracteres"),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo ou participante não encontrado"),
                @ApiResponse(responseCode = "409",
                        description = "PARTICIPANT_ALREADY_WITHDRAWN ou STUDY_READ_ONLY")
            })
    public ParticipantResponse withdraw(@PathVariable Long studyId, @PathVariable Long participantId,
                                        @Valid @RequestBody ParticipantWithdrawalRequest request) {
        return ParticipantResponse.from(participantService.withdraw(studyId, participantId, request.reason()));
    }
}
