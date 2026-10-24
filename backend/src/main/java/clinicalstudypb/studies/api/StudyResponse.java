package clinicalstudypb.studies.api;

import clinicalstudypb.studies.domain.Study;
import java.time.LocalDate;

/**
 * Dados de um estudo devolvidos pela API.
 *
 * @param id identificador do estudo
 * @param title título
 * @param objective objetivo
 * @param responsibleUserId identificador do pesquisador responsável
 * @param startDate data de início
 * @param endDate data de término
 * @param participantLimit número máximo de participantes
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-22
 * @version 0.0.1
 */
public record StudyResponse(
        Long id,
        String title,
        String objective,
        Long responsibleUserId,
        LocalDate startDate,
        LocalDate endDate,
        Integer participantLimit
) {
    /**
     * Converte a entidade JPA em dados para a resposta HTTP.
     *
     * @param study estudo consultado
     * @return representação do estudo
     */
    public static StudyResponse from(Study study) {
        return new StudyResponse(
                study.getId(),
                study.getTitle(),
                study.getObjective(),
                study.getResponsibleUserId(),
                study.getStartDate(),
                study.getEndDate(),
                study.getParticipantLimit()
        );
    }
}