package clinicalstudypb.studies.domain;

/**
 * Estados do ciclo de vida de um estudo clínico.
 * Cada estado permite avançar somente para o próximo.
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
    CLOSED;

    /**
     * Verifica se o destino é o próximo estado permitido.
     *
     * @param destination estado solicitado
     * @return {@code true} quando a transição é permitida
     */
    public boolean canAdvanceTo(StudyStatus destination) {
        return switch (this) {
            case PLANNING -> destination == RECRUITMENT;
            case RECRUITMENT -> destination == EXECUTION;
            case EXECUTION -> destination == CLOSED;
            case CLOSED -> false;
        };
    }
}
