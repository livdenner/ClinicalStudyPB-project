package clinicalstudypb.me.api;

import clinicalstudypb.me.application.ParticipantVisitsView;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Visitas da conta autenticada separadas em próximas e histórico de desfechos (RF18).
 *
 * @param upcoming visitas ainda agendadas (SCHEDULED), da mais antiga para a mais nova
 * @param history visitas realizadas, ausentes ou canceladas, da mais recente para a mais antiga
 * @author Allan Guilherme
 * @since 2026-11-17
 * @version 0.0.1
 */
@Schema(name = "ParticipantVisits", requiredProperties = {"upcoming", "history"})
public record ParticipantVisitsResponse(List<ParticipantVisitResponse> upcoming,
                                        List<ParticipantVisitResponse> history) {

    /**
     * Converte as duas listas no payload do contrato, mantendo a ordem do serviço.
     *
     * @param view visitas separadas e ordenadas
     * @return resposta da rota GET /api/me/visits
     */
    public static ParticipantVisitsResponse from(ParticipantVisitsView view) {
        return new ParticipantVisitsResponse(
                view.upcoming().stream().map(ParticipantVisitResponse::from).toList(),
                view.history().stream().map(ParticipantVisitResponse::from).toList());
    }
}
