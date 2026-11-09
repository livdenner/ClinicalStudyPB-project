package clinicalstudypb.candidates.api;

import clinicalstudypb.candidates.application.EligibilityEvaluationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Expõe registro e consulta de elegibilidade exclusivamente ao coordenador.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
@RestController
@RequestMapping("/api/studies/{studyId}/candidates/{candidateId}/eligibility")
@Tag(name = "Elegibilidade", description = "Avaliação dos critérios de inclusão e exclusão")
public class EligibilityEvaluationController {

    private final EligibilityEvaluationService evaluationService;

    /**
     * Recebe o serviço de avaliação.
     *
     * @param evaluationService registro e consulta de elegibilidade
     */
    public EligibilityEvaluationController(EligibilityEvaluationService evaluationService) {
        this.evaluationService = evaluationService;
    }

    /**
     * Consulta respostas e resultado do candidato no estudo da rota.
     *
     * @param studyId estudo da rota
     * @param candidateId candidato da rota
     * @return avaliação atual
     */
    @GetMapping
    @PreAuthorize("hasRole('COORDINATOR')")
    @Operation(summary = "Consulta respostas e resultado da elegibilidade (RF09, T13.1)",
            description = "Somente COORDINATOR. Antes da avaliação, retorna PENDING e answers=[].",
            security = @SecurityRequirement(name = "bearerAuth"),
            responses = {
                @ApiResponse(responseCode = "200", description = "Avaliação atual",
                        content = @Content(schema = @Schema(implementation = EligibilityEvaluationResponse.class))),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo ou candidato não encontrado")
            })
    public EligibilityEvaluationResponse get(@PathVariable Long studyId, @PathVariable Long candidateId) {
        return EligibilityEvaluationResponse.from(evaluationService.get(studyId, candidateId));
    }

    /**
     * Registra o conjunto completo de respostas e recalcula o resultado.
     *
     * @param studyId estudo da rota
     * @param candidateId candidato da rota
     * @param request respostas atuais
     * @return avaliação recalculada
     */
    @PutMapping
    @PreAuthorize("hasRole('COORDINATOR')")
    @Operation(summary = "Registra ou substitui as respostas dos critérios (RF09, T13.1)",
            description = "Somente COORDINATOR. Substitui todas as respostas; critérios ausentes mantêm PENDING. "
                    + "Com todos respondidos, INCLUSION exige true e EXCLUSION exige false. "
                    + "Estudo sem critérios ou candidato já incluído responde 409.",
            security = @SecurityRequirement(name = "bearerAuth"),
            responses = {
                @ApiResponse(responseCode = "200", description = "Respostas e resultado recalculado",
                        content = @Content(schema = @Schema(implementation = EligibilityEvaluationResponse.class))),
                @ApiResponse(responseCode = "400",
                        description = "Respostas inválidas ou critérios repetidos/de outro estudo"),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo ou candidato não encontrado"),
                @ApiResponse(responseCode = "409", description = "Estudo sem critérios ou candidato já incluído")
            })
    public EligibilityEvaluationResponse evaluate(@PathVariable Long studyId, @PathVariable Long candidateId,
                                                  @Valid @RequestBody EligibilityEvaluationWriteRequest request) {
        return EligibilityEvaluationResponse.from(evaluationService.evaluate(studyId, candidateId, request.answers()));
    }
}
