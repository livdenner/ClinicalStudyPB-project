package clinicalstudypb.results.api;

import clinicalstudypb.results.application.ActivityResultService;
import clinicalstudypb.results.application.ActivityResultService.WriteResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Rotas RF14 de consulta e registro de resultados de atividades. */
@RestController
@RequestMapping("/api/studies/{studyId}/participants/{participantId}/visits/{visitId}/results")
@Tag(name = "Resultados")
@SecurityRequirement(name = "bearerAuth")
public class ActivityResultController {

    private final ActivityResultService service;

    /** Cria o controlador. */
    public ActivityResultController(ActivityResultService service) {
        this.service = service;
    }

    /** Consulta atividades e resultados de uma visita. */
    @GetMapping
    @PreAuthorize("hasAnyRole('RESEARCHER', 'COORDINATOR')")
    @Operation(summary = "Consulta resultados de atividades (RF14)")
    public VisitResultsResponse get(@PathVariable Long studyId,
                                    @PathVariable Long participantId,
                                    @PathVariable Long visitId) {
        return service.get(studyId, participantId, visitId);
    }

    /** Registra ou substitui o resultado de uma atividade. */
    @PutMapping("/{activityId}")
    @PreAuthorize("hasRole('RESEARCHER')")
    @Operation(summary = "Registra resultado de atividade (RF14)")
    public ResponseEntity<ActivityResultResponse> put(@PathVariable Long studyId,
                                                       @PathVariable Long participantId,
                                                       @PathVariable Long visitId,
                                                       @PathVariable Long activityId,
                                                       @Valid @RequestBody ActivityResultWriteRequest request) {
        WriteResult written = service.put(studyId, participantId, visitId, activityId,
                request.value(), request.note());
        return ResponseEntity.status(written.created() ? 201 : 200).body(written.result());
    }
}
