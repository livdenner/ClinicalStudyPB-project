package clinicalstudypb.studies.domain;

/**
 * Estados do ciclo de vida de um estudo clínico.
 * Representa planejamento, recrutamento, execução e desfechos do estudo.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-03
 * @version 0.0.1
 */
public enum StudyStatus {
    /** Estudo em preparação. */
    PLANNING,
    /** Estudo aberto ao recrutamento. */
    RECRUITMENT,
    /** Estudo em execução. */
    EXECUTION,
    /** Estudo encerrado. */
    CLOSED,
    /** Estudo interrompido antes do encerramento normal. */
    CANCELLED;

    /**
     * Verifica se o destino é o próximo estado permitido.
     *
     * @param destination estado solicitado
     * @return {@code true} quando a transição é permitida
     */
    public boolean canAdvanceTo(StudyStatus destination) {
        return switch (this) {
            case PLANNING -> destination == RECRUITMENT || destination == CANCELLED;
            case RECRUITMENT -> destination == PLANNING || destination == EXECUTION
                    || destination == CANCELLED;
            case EXECUTION -> destination == CLOSED || destination == CANCELLED;
            case CLOSED, CANCELLED -> false;
        };
    }
}
