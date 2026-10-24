package clinicalstudypb.studies.domain;

/**
 * Indica que os dados de um estudo violam uma regra de cadastro ou edição.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-22
 * @version 0.0.1
 */
public class InvalidStudyException extends IllegalArgumentException {

    /**
     * Cria o erro com a regra que foi violada.
     *
     * @param message explicação do erro
     */
    public InvalidStudyException(String message) {
        super(message);
    }
}