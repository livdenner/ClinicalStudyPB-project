package clinicalstudypb.consent.application;

import clinicalstudypb.candidates.application.CandidateService;
import clinicalstudypb.consent.domain.ConsentConflictException;
import clinicalstudypb.consent.domain.ConsentDecision;
import clinicalstudypb.consent.domain.SimulatedConsent;
import clinicalstudypb.consent.infrastructure.SimulatedConsentRepository;
import clinicalstudypb.studies.application.StudyService;
import clinicalstudypb.studies.domain.Study;
import clinicalstudypb.studies.domain.StudyStatus;
import java.time.Instant;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Consulta e registra decisões simuladas de consentimento para candidatos.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-07
 * @version 0.0.1
 */
@Service
public class SimulatedConsentService {
    private final CandidateService candidateService;
    private final StudyService studyService;
    private final SimulatedConsentRepository consentRepository;

    /**
     * Recebe os serviços públicos e o repositório do módulo.
     *
     * @param candidateService consulta e bloqueio de candidatos
     * @param studyService consulta de estudos
     * @param consentRepository persistência da decisão
     */
    public SimulatedConsentService(CandidateService candidateService, StudyService studyService,
                                   SimulatedConsentRepository consentRepository) {
        this.candidateService = candidateService;
        this.studyService = studyService;
        this.consentRepository = consentRepository;
    }

    /**
     * Consulta a decisão após conferir que o candidato pertence ao estudo.
     *
     * @param studyId identificador do estudo
     * @param candidateId identificador do candidato
     * @return decisão registrada ou vazio quando ainda está pendente
     */
    @Transactional(readOnly = true)
    public Optional<SimulatedConsent> get(Long studyId, Long candidateId) {
        candidateService.get(studyId, candidateId);
        return consentRepository.findById(candidateId);
    }

    /**
     * Registra ou substitui a decisão enquanto o estudo recruta e o candidato não foi incluído.
     *
     * @param studyId identificador do estudo
     * @param candidateId identificador do candidato
     * @param decision nova decisão simulada
     * @return decisão persistida
     */
    @Transactional
    public SimulatedConsent record(Long studyId, Long candidateId, ConsentDecision decision) {
        Study study = studyService.lockForCandidateRegistration(studyId);
        candidateService.lockForConsentUpdate(studyId, candidateId);
        if (study.getStatus() != StudyStatus.RECRUITMENT) {
            throw new ConsentConflictException("O consentimento só pode mudar durante o recrutamento.");
        }
        Instant now = Instant.now();
        SimulatedConsent consent = consentRepository.findById(candidateId).orElse(null);
        if (consent == null) {
            consent = new SimulatedConsent(candidateId, decision, now);
        } else {
            consent.replace(decision, now);
        }
        return consentRepository.saveAndFlush(consent);
    }

    /**
     * Bloqueia alterações posteriores à inclusão. A futura T15.1 deve chamar este
     * método na mesma transação que grava o participante, antes de confirmar a inclusão.
     *
     * @param studyId identificador do estudo
     * @param candidateId identificador do candidato
     */
    @Transactional
    public void lockAfterInclusion(Long studyId, Long candidateId) {
        studyService.lockForCandidateRegistration(studyId);
        candidateService.lockForConsentUpdate(studyId, candidateId);
        SimulatedConsent consent = consentRepository.findById(candidateId)
                .orElseThrow(() -> new ConsentConflictException("A inclusão exige consentimento concedido."));
        consent.lockAfterInclusion();
        consentRepository.saveAndFlush(consent);
    }
}
