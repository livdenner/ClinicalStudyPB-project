package clinicalstudypb.studies.application;

import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.studies.domain.InvalidStudyException;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.infrastructure.StudyRepository;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coordena o cadastro, a edição e a consulta de estudos clínicos.
 * Confere os dados do estudo e o perfil e estado do pesquisador responsável.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-22
 * @version 0.0.1
 */
@Service
public class StudyService {

    private final StudyRepository studyRepository;
    private final UserService userService;

    /**
     * Recebe as dependências de persistência e consulta de usuários.
     *
     * @param studyRepository repositório de estudos
     * @param userService serviço que consulta o usuário responsável
     */
    public StudyService(StudyRepository studyRepository, UserService userService) {
        this.studyRepository = studyRepository;
        this.userService = userService;
    }

    /**
     * Lista os estudos cadastrados.
     *
     * @return estudos encontrados
     */
    @Transactional(readOnly = true)
    public List<Study> listStudies() {
        return studyRepository.findAll();
    }

    /**
     * Busca um estudo pelo identificador.
     *
     * @param id identificador do estudo
     * @return estudo encontrado
     * @throws ResourceNotFoundException se o estudo não existir
     */
    @Transactional(readOnly = true)
    public Study getStudy(Long id) {
        return studyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Estudo não encontrado: " + id));
    }

    /**
     * Cadastra um estudo após validar os dados e o pesquisador responsável.
     *
     * @param title título do estudo
     * @param objective objetivo do estudo
     * @param responsibleUserId identificador do pesquisador responsável
     * @param startDate data de início
     * @param endDate data de término
     * @param participantLimit limite de participantes
     * @return estudo persistido
     * @throws InvalidStudyException se algum dado violar as regras do estudo
     * @throws ResourceNotFoundException se o usuário responsável não existir
     */
    @Transactional
    public Study createStudy(String title, String objective, Long responsibleUserId,
                             LocalDate startDate, LocalDate endDate, Integer participantLimit) {
        validateStudy(title, objective, responsibleUserId, startDate, endDate, participantLimit);
        Study study = new Study(title.strip(), objective.strip(), responsibleUserId,
                startDate, endDate, participantLimit);
        return studyRepository.save(study);
    }

    /**
     * Atualiza os dados de um estudo existente.
     * A transação grava as mudanças feitas na entidade gerenciada pela JPA.
     *
     * @param id identificador do estudo
     * @param title novo título
     * @param objective novo objetivo
     * @param responsibleUserId identificador do pesquisador responsável
     * @param startDate nova data de início
     * @param endDate nova data de término
     * @param participantLimit novo limite de participantes
     * @return estudo atualizado
     * @throws ResourceNotFoundException se o estudo ou o usuário não existir
     * @throws InvalidStudyException se algum dado violar as regras do estudo
     */
    @Transactional
    public Study updateStudy(Long id, String title, String objective, Long responsibleUserId,
                             LocalDate startDate, LocalDate endDate, Integer participantLimit) {
        Study study = getStudy(id);
        validateStudy(title, objective, responsibleUserId, startDate, endDate, participantLimit);
        study.updateDetails(title.strip(), objective.strip(), responsibleUserId,
                startDate, endDate, participantLimit);
        return study;
    }

    private void validateStudy(String title, String objective, Long responsibleUserId,
                               LocalDate startDate, LocalDate endDate, Integer participantLimit) {
        if (title == null || title.isBlank() || title.strip().length() > 200) {
            throw new InvalidStudyException("O título deve ter entre 1 e 200 caracteres.");
        }
        if (objective == null || objective.isBlank()) {
            throw new InvalidStudyException("O objetivo é obrigatório.");
        }
        if (startDate == null || endDate == null || endDate.isBefore(startDate)) {
            throw new InvalidStudyException("A data de término não pode ser anterior à de início.");
        }
        if (participantLimit == null || participantLimit <= 0) {
            throw new InvalidStudyException("O limite de participantes deve ser maior que zero.");
        }
        if (responsibleUserId == null || responsibleUserId <= 0) {
            throw new InvalidStudyException("Informe um usuário responsável válido.");
        }
        User responsible = userService.getUser(responsibleUserId);
        if (responsible.getRole() != UserRole.RESEARCHER) {
            throw new InvalidStudyException("O responsável pelo estudo deve ser um pesquisador.");
        }
        if (!responsible.isActive()) {
            throw new InvalidStudyException("O pesquisador responsável pelo estudo deve estar ativo.");
        }
    }
}
