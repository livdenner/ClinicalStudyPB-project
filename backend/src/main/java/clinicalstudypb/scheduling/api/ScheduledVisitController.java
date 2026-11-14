package clinicalstudypb.scheduling.api;

import clinicalstudypb.scheduling.application.ScheduledVisitService;
import clinicalstudypb.scheduling.domain.ScheduledVisitStatus;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Expõe criação e consultas de agendamentos de visitas clínicas conforme contrato RF12.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
@RestController
@RequestMapping("/api/studies/{studyId}")
@Tag(name = "Agendamento de Visitas", description = "Agendamento e consulta de visitas previstas por estudo")
@SecurityRequirement(name = "bearerAuth")
public class ScheduledVisitController {

    private final ScheduledVisitService scheduledVisitService;

    /**
     * Recebe o serviço transacional de agendamento de visitas.
     *
     * @param scheduledVisitService operações de negócio de agendamento
     */
    public ScheduledVisitController(ScheduledVisitService scheduledVisitService) {
        this.scheduledVisitService = scheduledVisitService;
    }

    /**
     * Agenda uma visita prevista do protocolo para o participante do estudo.
     *
     * @param studyId identificador do estudo
     * @param participantId identificador do participante
     * @param request visita prevista e instante proposto
     * @return agendamento criado com cabeçalhos {@code Location} e {@code ETag}
     */
    @PostMapping("/participants/{participantId}/visits")
    @PreAuthorize("hasRole('COORDINATOR')")
    @Operation(summary = "Agenda visita prevista para participante (RF12, T18.2)",
            description = "Somente COORDINATOR. Exige estudo em RECRUITMENT ou EXECUTION, participante ativo, "
                    + "visita prevista do estudo, instante futuro no período do estudo (America/Fortaleza) "
                    + "e ausência de duplicidade SCHEDULED ou DONE.",
            responses = {
                @ApiResponse(responseCode = "201", description = "Agendamento criado",
                        headers = {
                            @Header(name = "Location", description = "Caminho do agendamento criado",
                                    schema = @Schema(type = "string")),
                            @Header(name = "ETag", description = "Versão inicial para controle de concorrência",
                                    schema = @Schema(type = "string"))
                        },
                        content = @Content(schema = @Schema(implementation = ScheduledVisitResponse.class))),
                @ApiResponse(responseCode = "400", description = "Dados inválidos ou fora da janela permitida"),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo ou participante não encontrado"),
                @ApiResponse(responseCode = "409", description = "Estado incompatível ou agendamento duplicado")
            })
    public ResponseEntity<ScheduledVisitResponse> schedule(
            @PathVariable Long studyId,
            @PathVariable Long participantId,
            @Valid @RequestBody ScheduledVisitCreateRequest request) {
        ScheduledVisitResponse created = ScheduledVisitResponse.from(scheduledVisitService.schedule(
                studyId,
                participantId,
                request.plannedVisitId(),
                request.scheduledAt().toInstant()));
        URI location = URI.create("/api/studies/" + studyId + "/participants/"
                + participantId + "/visits/" + created.id());
        return ResponseEntity.created(location)
                .eTag(String.valueOf(created.version()))
                .body(created);
    }

    /**
     * Consulta um agendamento específico vinculado ao participante e ao estudo da rota.
     *
     * @param studyId identificador do estudo
     * @param participantId identificador do participante
     * @param visitId identificador do agendamento
     * @return agendamento detalhado com cabeçalho {@code ETag}
     */
    @GetMapping("/participants/{participantId}/visits/{visitId}")
    @PreAuthorize("hasAnyRole('RESEARCHER', 'COORDINATOR')")
    @Operation(summary = "Consulta detalhe de visita agendada (RF12, T18.2)",
            description = "RESEARCHER ou COORDINATOR. Retorna 404 se o estudo, participante ou visita não existir.",
            responses = {
                @ApiResponse(responseCode = "200", description = "Agendamento encontrado",
                        headers = @Header(name = "ETag", description = "Versão atual do agendamento",
                                schema = @Schema(type = "string")),
                        content = @Content(schema = @Schema(implementation = ScheduledVisitResponse.class))),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo, participante ou agendamento não encontrado")
            })
    public ResponseEntity<ScheduledVisitResponse> get(
            @PathVariable Long studyId,
            @PathVariable Long participantId,
            @PathVariable Long visitId) {
        ScheduledVisitResponse visit = ScheduledVisitResponse.from(
                scheduledVisitService.get(studyId, participantId, visitId));
        return ResponseEntity.ok()
                .eTag(String.valueOf(visit.version()))
                .body(visit);
    }

    /**
     * Lista os agendamentos de todo o estudo com filtros opcionais.
     *
     * @param studyId identificador do estudo
     * @param status filtro opcional por estado
     * @param participantId filtro opcional por participante
     * @return agendamentos ordenados por data agendada e identificador
     */
    @GetMapping("/visits")
    @PreAuthorize("hasAnyRole('RESEARCHER', 'COORDINATOR')")
    @Operation(summary = "Lista visitas agendadas do estudo (RF12, T18.2)",
            description = "RESEARCHER ou COORDINATOR. Aceita filtros opcionais status e participantId.",
            responses = {
                @ApiResponse(responseCode = "200", description = "Lista ordenada de agendamentos do estudo",
                        content = @Content(array = @ArraySchema(
                                schema = @Schema(implementation = ScheduledVisitResponse.class)))),
                @ApiResponse(responseCode = "400", description = "Parâmetro de filtro inválido"),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo ou participante filtrado não encontrado")
            })
    public List<ScheduledVisitResponse> listByStudy(
            @PathVariable Long studyId,
            @RequestParam(required = false) ScheduledVisitStatus status,
            @RequestParam(required = false) Long participantId) {
        return scheduledVisitService.listByStudy(studyId, status, participantId).stream()
                .map(ScheduledVisitResponse::from)
                .toList();
    }

    /**
     * Lista os agendamentos do participante pertencente ao estudo da rota.
     *
     * @param studyId identificador do estudo
     * @param participantId identificador do participante
     * @return agendamentos ordenados por data agendada e identificador
     */
    @GetMapping("/participants/{participantId}/visits")
    @PreAuthorize("hasAnyRole('RESEARCHER', 'COORDINATOR')")
    @Operation(summary = "Lista visitas agendadas de um participante (RF12, T18.2)",
            description = "RESEARCHER ou COORDINATOR. Retorna lista vazia quando não há agendamentos.",
            responses = {
                @ApiResponse(responseCode = "200", description = "Lista ordenada de agendamentos do participante",
                        content = @Content(array = @ArraySchema(
                                schema = @Schema(implementation = ScheduledVisitResponse.class)))),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo ou participante não encontrado")
            })
    public List<ScheduledVisitResponse> listByParticipant(
            @PathVariable Long studyId,
            @PathVariable Long participantId) {
        return scheduledVisitService.listByParticipant(studyId, participantId).stream()
                .map(ScheduledVisitResponse::from)
                .toList();
    }
}
