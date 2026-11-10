package clinicalstudypb.studies.domain;

/**
 * Indica que o estado atual do estudo impede a transição solicitada.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-03
 * @version 0.0.1
 */
public class StudyStatusConflictException extends RuntimeException {

    /**
     * Descreve a transição recusada.
     *
     * @param current estado atual
     * @param requested estado solicitado
     */
    public StudyStatusConflictException(StudyStatus current, StudyStatus requested) {
        super("Transição de estado não permitida: " + current + " -> " + requested + ".");
    }

    /**
     * Descreve um conflito de concorrência na mudança de estado.
     *
     * @param message motivo do conflito
     */
    public StudyStatusConflictException(String message) {
        super(message);
    }
}
