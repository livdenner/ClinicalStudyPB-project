package clinicalstudypb.candidates.domain;

/**
 * Etapa pública da identidade e decisão do candidato.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-13
 * @version 0.0.1
 */
public enum CandidateStatus {
    /** Conta criada por convite aguardando definição de senha. */
    INVITED,
    /** Conta ativada, ainda sem avaliação de elegibilidade concluída. */
    ACTIVE,
    /** Candidato elegível aguardando decisão de consentimento. */
    CONSENT_PENDING,
    /** Consentimento concedido, apto à inclusão. */
    GRANTED,
    /** Consentimento recusado pelo candidato. */
    DECLINED,
    /** Candidato incluído como participante do estudo. */
    INCLUDED,
    /** Candidatura cancelada antes da inclusão. */
    CANCELLED
}
