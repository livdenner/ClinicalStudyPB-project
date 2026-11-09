package clinicalstudypb.consent.api;

import clinicalstudypb.consent.application.SimulatedConsentService;
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
 * Expõe consulta e registro de consentimento simulado por candidato.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-07
 * @version 0.0.1
 */
@RestController
@RequestMapping("/api/studies/{studyId}/candidates/{candidateId}/consent")
@Tag(name = "Consentimento", description = "Decisão simulada, sem assinatura real")
public class SimulatedConsentController {
    private final SimulatedConsentService consentService;

    /**
     * Recebe as operações de consentimento.
     *
     * @param consentService serviço do módulo
     */
    public SimulatedConsentController(SimulatedConsentService consentService) {
        this.consentService = consentService;
    }

    /**
     * Consulta a situação simulada, inclusive antes de existir decisão.
     *
     * @param studyId identificador do estudo
     * @param candidateId identificador do candidato
     * @return situação atual
     */
    @GetMapping
    @PreAuthorize("hasRole('COORDINATOR')")
    @Operation(summary = "Consulta o consentimento simulado",
            security = @SecurityRequirement(name = "bearerAuth"),
            responses = {
                @ApiResponse(responseCode = "200", description = "Situação atual",
                        content = @Content(schema = @Schema(implementation = SimulatedConsentResponse.class))),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo ou candidato não encontrado")
            })
    public SimulatedConsentResponse get(@PathVariable Long studyId, @PathVariable Long candidateId) {
        return consentService.get(studyId, candidateId)
                .map(consent -> SimulatedConsentResponse.from(studyId, consent))
                .orElseGet(() -> SimulatedConsentResponse.pending(studyId, candidateId));
    }

    /**
     * Registra uma decisão simulada e devolve o horário atribuído pelo servidor.
     *
     * @param studyId identificador do estudo
     * @param candidateId identificador do candidato
     * @param request decisão a registrar
     * @return situação atualizada
     */
    @PutMapping
    @PreAuthorize("hasRole('COORDINATOR')")
    @Operation(summary = "Registra a decisão simulada do candidato",
            security = @SecurityRequirement(name = "bearerAuth"),
            responses = {
                @ApiResponse(responseCode = "200", description = "Decisão registrada",
                        content = @Content(schema = @Schema(implementation = SimulatedConsentResponse.class))),
                @ApiResponse(responseCode = "400", description = "Decisão inválida"),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão"),
                @ApiResponse(responseCode = "404", description = "Estudo ou candidato não encontrado"),
                @ApiResponse(responseCode = "409", description = "Estado impede alterar a decisão")
            })
    public SimulatedConsentResponse record(@PathVariable Long studyId, @PathVariable Long candidateId,
                                           @Valid @RequestBody SimulatedConsentWriteRequest request) {
        return SimulatedConsentResponse.from(studyId,
                consentService.record(studyId, candidateId, request.status()));
    }
}
