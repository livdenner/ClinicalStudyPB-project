package clinicalstudypb.candidates.application;

/**
 * Consulta pública de respostas de elegibilidade para proteger alterações de protocolo.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
public interface EligibilityResponseLookup {

    /**
     * Verifica se já existe alguma resposta para candidatos do estudo.
     *
     * @param studyId identificador do estudo
     * @return verdadeiro quando ao menos uma resposta foi registrada
     */
    boolean hasResponses(Long studyId);
}
