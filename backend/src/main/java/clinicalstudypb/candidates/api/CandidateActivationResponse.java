package clinicalstudypb.candidates.api;

import clinicalstudypb.candidates.application.CandidateInvitationService;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

/**
 * Metadados do convite; o código só é devolvido quando foi recém-gerado.
 *
 * @param expiresAt instante de expiração do convite atual
 * @param expired indica se o prazo do convite já venceu
 * @param activationCode código em texto claro retornado somente na emissão
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CandidateActivationResponse(Instant expiresAt, boolean expired, String activationCode) {

    /**
     * Constrói a resposta pública a partir do código recém-emitido.
     *
     * @param issued código e expiração gerados pelo serviço de convites
     * @return representação de ativação com código visível uma única vez
     */
    public static CandidateActivationResponse from(CandidateInvitationService.IssuedCode issued) {
        return new CandidateActivationResponse(issued.expiresAt(), false, issued.value());
    }
}
