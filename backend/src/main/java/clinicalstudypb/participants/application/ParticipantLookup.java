package clinicalstudypb.participants.application;

/**
 * Consulta pública de inclusão sem expor a persistência interna de participantes.
 *
 * @author Lívia
 * @since 2026-11-08
 * @version 0.0.1
 */
public interface ParticipantLookup {

    /**
     * Consulta o vínculo persistido entre candidato e participante.
     *
     * @param studyId estudo do candidato
     * @param candidateId candidato consultado
     * @return verdadeiro se o candidato já foi incluído no estudo
     */
    boolean isIncluded(Long studyId, Long candidateId);
}
