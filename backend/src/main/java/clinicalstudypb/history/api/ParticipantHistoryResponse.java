package clinicalstudypb.history.api;

import clinicalstudypb.history.application.ParticipantHistoryView;
import clinicalstudypb.participants.api.ParticipantResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Histórico do participante (schema {@code ParticipantHistory} do contrato, RF15).
 *
 * @param participant participante com situação, inclusão e retirada (quando houver)
 * @param visits visitas em ordem cronológica de {@code scheduledAt}; vazio quando não há
 * @author Allan Guilherme
 * @since 2026-11-19
 * @version 0.0.1
 */
@Schema(name = "ParticipantHistory", requiredProperties = {"participant", "visits"})
public record ParticipantHistoryResponse(ParticipantResponse participant,
                                         List<ParticipantHistoryVisitResponse> visits) {

    /**
     * Converte o histórico montado pela aplicação no payload do contrato.
     *
     * @param view participante e visitas com resultados
     * @return representação HTTP do histórico
     */
    public static ParticipantHistoryResponse from(ParticipantHistoryView view) {
        return new ParticipantHistoryResponse(
                ParticipantResponse.from(view.participant()),
                view.visits().stream().map(ParticipantHistoryVisitResponse::from).toList());
    }
}
