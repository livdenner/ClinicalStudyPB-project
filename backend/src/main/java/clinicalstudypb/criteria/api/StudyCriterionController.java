package clinicalstudypb.criteria.api;

import clinicalstudypb.criteria.application.StudyCriterionService;
import clinicalstudypb.criteria.domain.StudyCriterion;
import io.swagger.v3.oas.annotations.Operation;
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
 * Expõe cadastro e consulta de critérios de inclusão e exclusão.
 *
 * @author Lívia
 * @since 2026-11-06
 * @version 0.0.1
 */
@RestController
@RequestMapping("/api/studies/{studyId}/criteria")
@Tag(name = "Critérios", description = "Critérios de inclusão e exclusão por estudo")
public class StudyCriterionController {

    private final StudyCriterionService criterionService;

    /**
     * Recebe o serviço de critérios.
     *
     * @param criterionService operações de critérios
     */
    public StudyCriterionController(StudyCriterionService criterionService) {
        this.criterionService = criterionService;
    }

    /**
     * Lista critérios de um estudo existente.
     *
     * @param studyId identificador do estudo
     * @return critérios do estudo
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('RESEARCHER', 'COORDINATOR')")
    @Operation(summary = "Lista critérios de inclusão e exclusão",
            security = @SecurityRequirement(name = "bearerAuth"),
            responses = {
                @ApiResponse(responseCode = "200", description = "Critérios do estudo",
                        content = @Content(array = @ArraySchema(
                                schema = @Schema(implementation = StudyCriterionResponse.class)))),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo não encontrado")
            })
    public List<StudyCriterionResponse> list(@PathVariable Long studyId) {
        return criterionService.list(studyId).stream().map(StudyCriterionResponse::from).toList();
    }

    /**
     * Cadastra critério no protocolo do pesquisador responsável.
     *
     * @param studyId identificador do estudo
     * @param request tipo e descrição do critério
     * @return critério criado e sua localização
     */
    @PostMapping
    @PreAuthorize("hasRole('RESEARCHER')")
    @Operation(summary = "Define um critério do estudo",
            security = @SecurityRequirement(name = "bearerAuth"),
            responses = {
                @ApiResponse(responseCode = "201", description = "Critério criado",
                        content = @Content(schema = @Schema(implementation = StudyCriterionResponse.class))),
                @ApiResponse(responseCode = "400", description = "Dados inválidos"),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo não encontrado"),
                @ApiResponse(responseCode = "409", description = "Estado atual impede alterar o protocolo")
            })
    public ResponseEntity<StudyCriterionResponse> create(@PathVariable Long studyId,
            @Valid @RequestBody StudyCriterionWriteRequest request) {
        StudyCriterion created = criterionService.create(studyId, request.type(), request.description());
        StudyCriterionResponse response = StudyCriterionResponse.from(created);
        return ResponseEntity.created(URI.create("/api/studies/" + studyId
                + "/criteria/" + created.getId())).body(response);
    }

    /**
     * Consulta critério dentro do estudo informado.
     *
     * @param studyId identificador do estudo
     * @param criterionId identificador do critério
     * @return critério encontrado
     */
    @GetMapping("/{criterionId}")
    @PreAuthorize("hasAnyRole('RESEARCHER', 'COORDINATOR')")
    @Operation(summary = "Consulta um critério do estudo",
            security = @SecurityRequirement(name = "bearerAuth"),
            responses = {
                @ApiResponse(responseCode = "200", description = "Critério encontrado",
                        content = @Content(schema = @Schema(implementation = StudyCriterionResponse.class))),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo ou critério não encontrado")
            })
    public StudyCriterionResponse get(@PathVariable Long studyId, @PathVariable Long criterionId) {
        return StudyCriterionResponse.from(criterionService.get(studyId, criterionId));
    }
}
