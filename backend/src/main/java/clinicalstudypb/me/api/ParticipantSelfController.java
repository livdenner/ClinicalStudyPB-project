package clinicalstudypb.me.api;

import clinicalstudypb.me.application.ParticipantSelfService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Expõe ao app os estudos e as visitas do participante autenticado (RF17 e RF18, T23.1).
 * Só o perfil PARTICIPANT acessa; a conta vem do token, nunca de parâmetro.
 *
 * @author Allan Guilherme
 * @since 2026-11-17
 * @version 0.0.1
 */
@RestController
@RequestMapping("/api/me")
@Tag(name = "Dados do participante", description = "Estudos e visitas do participante autenticado (app)")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('PARTICIPANT')")
public class ParticipantSelfController {

    private final ParticipantSelfService participantSelfService;

    /**
     * Recebe o serviço de consulta da conta autenticada.
     *
     * @param participantSelfService estudos e visitas da conta
     */
    public ParticipantSelfController(ParticipantSelfService participantSelfService) {
        this.participantSelfService = participantSelfService;
    }

    /**
     * Lista os estudos em que a conta autenticada participa.
     *
     * @return participações ativas ou retiradas, da inclusão mais recente para a mais antiga
     */
    @GetMapping("/studies")
    @Operation(summary = "Lista os estudos do participante autenticado (RF17, T23.1)",
            description = "Somente PARTICIPANT. Participações ativas ou retiradas da própria conta "
                    + "com visitas previstas do protocolo; retorna [] sem inclusão.",
            responses = {
                @ApiResponse(responseCode = "200", description = "Estudos do participante",
                        content = @Content(array = @ArraySchema(
                                schema = @Schema(implementation = ParticipantStudyResponse.class)))),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão ou troca de senha pendente")
            })
    public List<ParticipantStudyResponse> listStudies() {
        return participantSelfService.listStudies().stream().map(ParticipantStudyResponse::from).toList();
    }

    /**
     * Lista as próximas visitas e o histórico de desfechos da conta autenticada.
     *
     * @return visitas separadas em próximas e histórico
     */
    @GetMapping("/visits")
    @Operation(summary = "Lista as visitas do participante autenticado (RF18, T23.1)",
            description = "Somente PARTICIPANT. Próximas visitas (SCHEDULED) e histórico de desfechos "
                    + "(DONE, ABSENT, CANCELLED) de todos os estudos da própria conta.",
            responses = {
                @ApiResponse(responseCode = "200", description = "Visitas do participante",
                        content = @Content(schema = @Schema(implementation = ParticipantVisitsResponse.class))),
                @ApiResponse(responseCode = "401", description = "Token ausente ou inválido"),
                @ApiResponse(responseCode = "403", description = "Perfil sem permissão ou troca de senha pendente")
            })
    public ParticipantVisitsResponse listVisits() {
        return ParticipantVisitsResponse.from(participantSelfService.listVisits());
    }
}
