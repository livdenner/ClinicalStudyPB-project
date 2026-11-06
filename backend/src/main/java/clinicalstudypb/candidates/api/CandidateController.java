package clinicalstudypb.candidates.api;

import clinicalstudypb.candidates.application.CandidateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
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
 * Expõe cadastro e consulta de candidatos vinculados a estudos.
 *
 * @author Codex
 * @since 2026-11-06
 * @version 0.0.1
 */
@RestController
@RequestMapping("/api/studies/{studyId}/candidates")
@PreAuthorize("hasRole('COORDINATOR')")
@Tag(name = "Candidatos", description = "Cadastro e consulta de candidatos por estudo")
@SecurityScheme(name = "bearerAuth", type = SecuritySchemeType.HTTP,
        scheme = "bearer", bearerFormat = "JWT")
public class CandidateController {

    private final CandidateService candidateService;

    /**
     * Recebe o serviço de candidatos.
     *
     * @param candidateService operações de candidatos
     */
    public CandidateController(CandidateService candidateService) {
        this.candidateService = candidateService;
    }

    /**
     * Lista candidatos de um estudo.
     *
     * @param studyId identificador do estudo
     * @return candidatos vinculados ao estudo
     */
    @GetMapping
    @Operation(summary = "Lista candidatos vinculados ao estudo",
            security = @SecurityRequirement(name = "bearerAuth"),
            responses = {
                @ApiResponse(responseCode = "200", description = "Candidatos do estudo"),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo não encontrado")
            })
    public List<CandidateResponse> list(@PathVariable Long studyId) {
        return candidateService.list(studyId).stream().map(CandidateResponse::from).toList();
    }

    /**
     * Cadastra candidato em estudo aberto ao recrutamento.
     *
     * @param studyId identificador do estudo
     * @param request dados do candidato
     * @return candidato criado e sua localização
     */
    @PostMapping
    @Operation(summary = "Cadastra um candidato no estudo",
            security = @SecurityRequirement(name = "bearerAuth"),
            responses = {
                @ApiResponse(responseCode = "201", description = "Candidato cadastrado",
                        content = @Content(schema = @Schema(implementation = CandidateResponse.class))),
                @ApiResponse(responseCode = "400", description = "Dados inválidos"),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo não encontrado"),
                @ApiResponse(responseCode = "409", description = "Estudo fechado ou candidato duplicado")
            })
    public ResponseEntity<CandidateResponse> create(@PathVariable Long studyId,
                                                    @Valid @RequestBody CandidateCreateRequest request) {
        CandidateResponse created = CandidateResponse.from(
                candidateService.create(studyId, request.name(), request.age()));
        URI location = URI.create("/api/studies/" + studyId + "/candidates/" + created.id());
        return ResponseEntity.created(location).body(created);
    }

    /**
     * Consulta candidato dentro do estudo informado.
     *
     * @param studyId identificador do estudo
     * @param candidateId identificador do candidato
     * @return candidato encontrado
     */
    @GetMapping("/{candidateId}")
    @Operation(summary = "Consulta um candidato do estudo",
            security = @SecurityRequirement(name = "bearerAuth"),
            responses = {
                @ApiResponse(responseCode = "200", description = "Candidato encontrado",
                        content = @Content(schema = @Schema(implementation = CandidateResponse.class))),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo ou candidato não encontrado")
            })
    public CandidateResponse get(@PathVariable Long studyId, @PathVariable Long candidateId) {
        return CandidateResponse.from(candidateService.get(studyId, candidateId));
    }
}
