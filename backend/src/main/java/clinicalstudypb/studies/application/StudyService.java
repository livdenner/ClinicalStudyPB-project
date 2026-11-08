package clinicalstudypb.studies.application;

import clinicalstudypb.shared.ResourceNotFoundException;
import clinicalstudypb.shared.CurrentActor;
import clinicalstudypb.studies.domain.InvalidStudyException;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import clinicalstudypb.studies.infrastructure.StudyRepository;
import clinicalstudypb.studies.infrastructure.StudyStatusHistoryRepository;
import clinicalstudypb.studies.domain.StudyStatusHistory;
import clinicalstudypb.visits.domain.ProtocolConflictException;
import java.time.Instant;
import clinicalstudypb.users.application.UserService;
import clinicalstudypb.users.domain.User;
import clinicalstudypb.users.domain.UserRole;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coordena o cadastro, a edição, a consulta e a transição de estudos clínicos.
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
    private final StudyStatusHistoryRepository historyRepository;
    private final CurrentActor currentActor;
    private final JdbcTemplate jdbc;
    private final ObjectProvider<StudyReadiness> readinessProvider;

    /**
     * Recebe as dependências de persistência e consulta de usuários.
     *
     * @param studyRepository repositório de estudos
     * @param userService serviço que consulta o usuário responsável
     * @param historyRepository repositório do histórico de estados
     * @param currentActor usuário autenticado
     * @param jdbc acesso às visitas previstas para validar o protocolo
     * @param readinessProvider verificação de critérios e participantes quando integrada
     */
    public StudyService(StudyRepository studyRepository, UserService userService,
                        StudyStatusHistoryRepository historyRepository, CurrentActor currentActor,
                        JdbcTemplate jdbc, ObjectProvider<StudyReadiness> readinessProvider) {
        this.studyRepository = studyRepository;
        this.userService = userService;
        this.historyRepository = historyRepository;
        this.currentActor = currentActor;
        this.jdbc = jdbc;
        this.readinessProvider = readinessProvider;
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
     * Verifica se o usuário autenticado é o pesquisador responsável pelo estudo.
     *
     * @param id identificador do estudo
     * @return verdadeiro quando o usuário autenticado é responsável
     * @throws ResourceNotFoundException se o estudo não existir
     */
    @Transactional(readOnly = true)
    public boolean isResponsible(Long id) {
        Study study = getStudy(id);
        return study.getResponsibleUserId().equals(currentActor.userId());
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
     * O bloqueio da linha impede que a edição sobrescreva uma transição simultânea.
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
        Study study = getStudyForUpdate(id);
        requireResponsible(study);
        requireEditable(study);
        validateStudy(title, objective, responsibleUserId, startDate, endDate, participantLimit);
        Integer visitsOutsidePeriod = jdbc.queryForObject(
                "SELECT COUNT(*) FROM planned_visits WHERE study_id = ? "
                        + "AND (planned_date < ? OR planned_date > ?)",
                Integer.class, id, startDate, endDate);
        if (visitsOutsidePeriod != null && visitsOutsidePeriod > 0) {
            throw new ProtocolConflictException("O novo período precisa conter todas as visitas previstas.");
        }
        study.updateDetails(title.strip(), objective.strip(), responsibleUserId,
                startDate, endDate, participantLimit);
        return study;
    }

    /**
     * Avança o estado de um estudo em uma transação com bloqueio da linha.
     * A JPA persiste a alteração na entidade gerenciada ao encerrar a transação.
     *
     * @param id identificador do estudo
     * @param nextStatus estado solicitado
     * @param expectedStatus estado que o cliente consultou
     * @param reason justificativa obrigatória do cancelamento
     * @return estudo com o novo estado
     * @throws ResourceNotFoundException se o estudo não existir
     * @throws clinicalstudypb.studies.domain.InvalidStudyException se o estado não for informado
     * @throws clinicalstudypb.studies.domain.StudyStatusConflictException se a transição não for permitida
     */
    @Transactional
    public Study advanceStatus(Long id, StudyStatus nextStatus, StudyStatus expectedStatus, String reason) {
        Study study = getStudyForUpdate(id);
        requireResponsible(study);
        if (expectedStatus == null || study.getStatus() != expectedStatus) {
            throw new clinicalstudypb.studies.domain.StudyStatusConflictException(
                    "O estado do estudo mudou. Atualize os dados antes de tentar novamente.");
        }
        if (nextStatus == null) {
            throw new InvalidStudyException("Informe o novo estado do estudo.");
        }
        String normalizedReason = reason == null ? null : reason.strip();
        if (nextStatus == StudyStatus.CANCELLED
                && (normalizedReason == null || normalizedReason.isBlank()
                || normalizedReason.length() > 1000)) {
            throw new InvalidStudyException("Informe uma justificativa de até 1000 caracteres para cancelar.");
        }
        StudyStatus previous = study.getStatus();
        if (previous == StudyStatus.PLANNING && nextStatus == StudyStatus.RECRUITMENT) {
            Integer visits = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM planned_visits v "
                            + "WHERE v.study_id = ? AND EXISTS "
                            + "(SELECT 1 FROM planned_activities a WHERE a.planned_visit_id = v.id)",
                    Integer.class, id);
            if (visits == null || visits == 0) {
                throw new ProtocolConflictException(
                        "Cadastre uma visita prevista com atividade antes de abrir o recrutamento.");
            }
            StudyReadiness readiness = readinessProvider.getIfAvailable();
            if (readiness == null || !readiness.hasInclusionAndExclusionCriteria(id)) {
                throw new ProtocolConflictException(
                        "Cadastre critérios de inclusão e exclusão antes de abrir o recrutamento.");
            }
        }
        if (previous == StudyStatus.RECRUITMENT && nextStatus == StudyStatus.EXECUTION) {
            StudyReadiness readiness = readinessProvider.getIfAvailable();
            if (readiness == null || !readiness.hasIncludedParticipant(id)) {
                throw new ProtocolConflictException(
                        "Inclua ao menos um participante antes de iniciar a execução.");
            }
        }
        if (previous == StudyStatus.CANCELLED) {
            StudyStatus origin = historyRepository.findFirstByStudyIdOrderByIdDesc(id)
                    .filter(history -> history.getToStatus() == StudyStatus.CANCELLED)
                    .map(StudyStatusHistory::getFromStatus)
                    .orElseThrow(() -> new clinicalstudypb.studies.domain.StudyStatusConflictException(
                            previous, nextStatus));
            if (nextStatus != origin) {
                throw new clinicalstudypb.studies.domain.StudyStatusConflictException(previous, nextStatus);
            }
            study.restoreCancelled(origin);
        } else {
            study.advanceStatus(nextStatus);
        }
        historyRepository.save(new StudyStatusHistory(id, currentActor.userId(), Instant.now(),
                previous, nextStatus, nextStatus == StudyStatus.CANCELLED ? normalizedReason : null));
        return study;
    }

    /**
     * Consulta o histórico imutável de transições de um estudo.
     *
     * @param id identificador do estudo
     * @return mudanças ordenadas
     */
    @Transactional(readOnly = true)
    public List<StudyStatusHistory> listStatusHistory(Long id) {
        getStudy(id);
        return historyRepository.findByStudyIdOrderByIdAsc(id);
    }

    /**
     * Exige que o usuário autenticado seja o pesquisador responsável.
     *
     * @param study estudo que será alterado
     */
    public void requireResponsible(Study study) {
        if (!study.getResponsibleUserId().equals(currentActor.userId())) {
            throw new AccessDeniedException("Somente o pesquisador responsável pode alterar este estudo.");
        }
    }

    /**
     * Exige que o protocolo ainda possa ser editado.
     *
     * @param study estudo que será alterado
     */
    public void requireEditable(Study study) {
        if (study.getStatus() != StudyStatus.PLANNING && study.getStatus() != StudyStatus.RECRUITMENT) {
            throw new ProtocolConflictException(
                    "O protocolo só pode ser alterado em PLANNING ou RECRUITMENT.");
        }
    }

    /**
     * Busca um estudo com bloqueio de escrita para uma alteração de protocolo.
     *
     * @param id identificador do estudo
     * @return estudo bloqueado
     */
    @Transactional
    public Study lockForProtocolEdit(Long id) {
        Study study = getStudyForUpdate(id);
        requireResponsible(study);
        requireEditable(study);
        return study;
    }

    /**
     * Busca um estudo com bloqueio de escrita antes de cadastrar um candidato.
     * O serviço de candidatos valida o estado enquanto este bloqueio permanece
     * ativo na transação externa de cadastro.
     *
     * @param id identificador do estudo
     * @return estudo bloqueado
     */
    @Transactional
    public Study lockForCandidateRegistration(Long id) {
        return getStudyForUpdate(id);
    }

    /**
     * Confere a versão apresentada pelo cliente antes de alterar o protocolo.
     * Ao marcar a entidade como modificada, a JPA incrementa a versão no commit.
     *
     * @param study estudo bloqueado
     * @param expectedVersion versão da última consulta do cliente
     */
    public void touchProtocol(Study study, Long expectedVersion) {
        if (expectedVersion == null || !expectedVersion.equals(study.getVersion())) {
            throw new ProtocolConflictException(
                    "O protocolo mudou. Atualize o estudo antes de tentar novamente.");
        }
        study.touchProtocol();
    }

    private Study getStudyForUpdate(Long id) {
        return studyRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Estudo não encontrado: " + id));
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
