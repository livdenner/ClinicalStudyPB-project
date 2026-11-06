package clinicalstudypb.visits.api;

import clinicalstudypb.visits.application.PlannedVisitService;
import clinicalstudypb.studies.domain.InvalidStudyException;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Expõe o protocolo de visitas previstas de cada estudo.
 *
 * @author Lucas N. de Araújo
 * @since 2026-11-05
 * @version 0.0.1
 */
@RestController
@RequestMapping("/api/studies/{studyId}/planned-visits")
public class PlannedVisitController {

    private final PlannedVisitService service;

    /**
     * Recebe o serviço transacional de visitas previstas.
     *
     * @param service serviço de protocolo
     */
    public PlannedVisitController(PlannedVisitService service) {
        this.service = service;
    }

    /**
     * Lista as visitas previstas na ordem do protocolo.
     *
     * @param studyId identificador do estudo
     * @return visitas previstas
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('RESEARCHER', 'COORDINATOR')")
    public List<PlannedVisitResponse> list(@PathVariable Long studyId) {
        return service.list(studyId);
    }

    /**
     * Consulta uma visita com suas atividades.
     *
     * @param studyId identificador do estudo
     * @param visitId identificador da visita
     * @return visita encontrada
     */
    @GetMapping("/{visitId}")
    @PreAuthorize("hasAnyRole('RESEARCHER', 'COORDINATOR')")
    public PlannedVisitResponse get(@PathVariable Long studyId, @PathVariable Long visitId) {
        return service.get(studyId, visitId);
    }

    /**
     * Insere uma visita e suas atividades de modo atômico.
     *
     * @param studyId identificador do estudo
     * @param request dados da visita
     * @param expectedVersion versão do estudo obtida em GET /api/studies/{id}
     * @return visita criada e localização
     */
    @PostMapping
    @PreAuthorize("hasRole('RESEARCHER')")
    public ResponseEntity<PlannedVisitResponse> create(
            @PathVariable Long studyId, @Valid @RequestBody PlannedVisitRequest request,
            @RequestHeader("If-Match") String expectedVersion) {
        PlannedVisitResponse created = service.create(studyId, request, parseVersion(expectedVersion));
        return ResponseEntity.created(URI.create("/api/studies/" + studyId
                + "/planned-visits/" + created.id())).body(created);
    }

    /**
     * Edita visita e atividades; a lista enviada substitui a lista anterior.
     *
     * @param studyId identificador do estudo
     * @param visitId identificador da visita
     * @param request novos dados
     * @param expectedVersion versão do estudo obtida em GET /api/studies/{id}
     * @return visita atualizada
     */
    @PutMapping("/{visitId}")
    @PreAuthorize("hasRole('RESEARCHER')")
    public PlannedVisitResponse update(@PathVariable Long studyId, @PathVariable Long visitId,
                                       @Valid @RequestBody PlannedVisitRequest request,
                                       @RequestHeader("If-Match") String expectedVersion) {
        return service.update(studyId, visitId, request, parseVersion(expectedVersion));
    }

    /**
     * Exclui uma visita e suas atividades.
     *
     * @param studyId identificador do estudo
     * @param visitId identificador da visita
     * @param expectedVersion versão do estudo obtida em GET /api/studies/{id}
     * @return resposta sem conteúdo
     */
    @DeleteMapping("/{visitId}")
    @PreAuthorize("hasRole('RESEARCHER')")
    public ResponseEntity<Void> delete(@PathVariable Long studyId, @PathVariable Long visitId,
                                       @RequestHeader("If-Match") String expectedVersion) {
        service.delete(studyId, visitId, parseVersion(expectedVersion));
        return ResponseEntity.noContent().build();
    }

    /**
     * Define a ordem completa de visitas do estudo.
     *
     * @param studyId identificador do estudo
     * @param request IDs na ordem desejada
     * @param expectedVersion versão do estudo obtida em GET /api/studies/{id}
     * @return visitas reordenadas
     */
    @PutMapping("/order")
    @PreAuthorize("hasRole('RESEARCHER')")
    public List<PlannedVisitResponse> reorder(@PathVariable Long studyId,
                                              @Valid @RequestBody PlannedVisitOrderRequest request,
                                              @RequestHeader("If-Match") String expectedVersion) {
        return service.reorder(studyId, request.ids(), parseVersion(expectedVersion));
    }

    /**
     * Exclui uma atividade sem deixar a visita vazia.
     *
     * @param studyId identificador do estudo
     * @param visitId identificador da visita
     * @param activityId identificador da atividade
     * @param expectedVersion versão do estudo obtida em GET /api/studies/{id}
     * @return resposta sem conteúdo
     */
    @DeleteMapping("/{visitId}/activities/{activityId}")
    @PreAuthorize("hasRole('RESEARCHER')")
    public ResponseEntity<Void> deleteActivity(@PathVariable Long studyId,
                                               @PathVariable Long visitId,
                                               @PathVariable Long activityId,
                                               @RequestHeader("If-Match") String expectedVersion) {
        service.deleteActivity(studyId, visitId, activityId, parseVersion(expectedVersion));
        return ResponseEntity.noContent().build();
    }

    private Long parseVersion(String ifMatch) {
        if (ifMatch == null || !ifMatch.matches("\"[0-9]+\"")) {
            throw new InvalidStudyException("If-Match deve conter a versão do estudo entre aspas.");
        }
        try {
            return Long.valueOf(ifMatch.substring(1, ifMatch.length() - 1));
        } catch (NumberFormatException exception) {
            throw new InvalidStudyException("If-Match contém uma versão inválida.");
        }
    }
}
