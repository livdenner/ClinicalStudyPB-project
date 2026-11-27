package clinicalstudypb.studies.application;

/**
 * Consulta pré-condições providas pelos módulos de critérios e participantes.
 * Enquanto eles não estiverem integrados, a ausência desta implementação
 * impede abrir o recrutamento e iniciar a execução.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
public interface StudyReadiness {

    /**
     * Verifica a presença de critério de inclusão e exclusão.
     *
     * @param studyId identificador do estudo
     * @return verdadeiro quando ambos existem
     */
    boolean hasInclusionAndExclusionCriteria(Long studyId);

    /**
     * Verifica se há ao menos um participante ativo incluído no estudo.
     *
     * @param studyId identificador do estudo
     * @return verdadeiro quando há participante ativo incluído
     */
    boolean hasIncludedParticipant(Long studyId);
}
