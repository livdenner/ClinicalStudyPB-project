package clinicalstudypb.studies.api;

import clinicalstudypb.studies.application.StudyService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Expõe as operações HTTP de cadastro, consulta e edição de estudos.
 *
 * @author Lucas N. de Araújo
 * @since 2026-10-22
 * @version 0.0.1
 */
@RestController
@RequestMapping("/api/studies")
@PreAuthorize("hasRole('RESEARCHER')")
public class StudyController {

    private final StudyService studyService;

    /**
     * Recebe o serviço que executa as regras de estudos.
     *
     * @param studyService serviço de estudos
     */
    public StudyController(StudyService studyService) {
        this.studyService = studyService;
    }

    /**
     * Lista os estudos cadastrados.
     *
     * @return estudos encontrados
     */
    @GetMapping
    public List<StudyResponse> listStudies() {
        return studyService.listStudies().stream()
                .map(StudyResponse::from)
                .toList();
    }

    /**
     * Consulta um estudo pelo identificador.
     *
     * @param id identificador do estudo
     * @return estudo encontrado
     */
    @GetMapping("/{id}")
    public StudyResponse getStudy(@PathVariable Long id) {
        return StudyResponse.from(studyService.getStudy(id));
    }

    /**
     * Cadastra um estudo e informa a localização do novo recurso.
     *
     * @param request dados validados do estudo
     * @return resposta 201 com o estudo e o cabeçalho Location
     */
    @PostMapping
    public ResponseEntity<StudyResponse> createStudy(@Valid @RequestBody StudyRequest request) {
        var study = studyService.createStudy(
                request.title(),
                request.objective(),
                request.responsibleUserId(),
                request.startDate(),
                request.endDate(),
                request.participantLimit()
        );
        return ResponseEntity.created(URI.create("/api/studies/" + study.getId()))
                .body(StudyResponse.from(study));
    }

    /**
     * Atualiza um estudo existente.
     *
     * @param id identificador do estudo
     * @param request novos dados validados
     * @return estudo atualizado
     */
    @PutMapping("/{id}")
    public StudyResponse updateStudy(@PathVariable Long id, @Valid @RequestBody StudyRequest request) {
        return StudyResponse.from(studyService.updateStudy(
                id,
                request.title(),
                request.objective(),
                request.responsibleUserId(),
                request.startDate(),
                request.endDate(),
                request.participantLimit()
        ));
    }
}
