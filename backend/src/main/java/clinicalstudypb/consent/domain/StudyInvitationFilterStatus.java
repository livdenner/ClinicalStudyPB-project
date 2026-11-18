package clinicalstudypb.consent.domain;

import clinicalstudypb.candidates.domain.CandidateStatus;

/**
 * Filtros de situação aceitos na listagem de convites do candidato autenticado.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-17
 * @version 0.0.1
 */
public enum StudyInvitationFilterStatus {
    /** Candidato elegível e ativo aguardando decisão no aplicativo. */
    CONSENT_PENDING,
    /** Decisão favorável registrada pelo candidato. */
    GRANTED,
    /** Decisão contrária registrada pelo candidato. */
    DECLINED;

    /**
     * Converte o filtro para o estado público correspondente da candidatura.
     *
     * @return estado da candidatura equivalente
     */
    public CandidateStatus toCandidateStatus() {
        return CandidateStatus.valueOf(name());
    }
}
