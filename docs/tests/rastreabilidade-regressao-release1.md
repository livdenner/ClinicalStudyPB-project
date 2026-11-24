# Rastreabilidade da regressão RF01–RF11 (T26.5)

Regressão dos requisitos da Release 1 depois das mudanças da Sprint 3, executada em 24/11/2026 sobre `development` **e975d92**, numa instalação limpa feita pelo README. O procedimento, o ambiente, os logs e os achados estão no [relatório da T26.5](../../releases/release2/tests/t26-5/README.md).

## Resultado por requisito

As contagens são as desta execução, por classe ou arquivo de teste principal de cada requisito; uma classe pode cobrir mais de um RF. "Manual" é a conferência das telas na web de `npm run dev`, contra a stack instalada.

| RF | Backend (JUnit) | Web (Vitest) | E2E (Playwright) | Manual | Situação |
| --- | --- | --- | --- | --- | --- |
| RF01 Usuários | `UserIntegrationTest` (23), `UserServiceTest` (14), `UserControllerTest` (9) | `usuarios/listagem` (22), `ModalUsuario` (12), `BuscaFiltroUsuarios` (8), `TabelaUsuarios` (3) | `auth/tab-session` (perfil administrador) | Validação do formulário e cadastro de usuário | Aprovado |
| RF02 Login e logout | `AuthIntegrationTest` (15), `AuthServiceTest` (6), `JwtServiceTest` (6), `AuthControllerValidationTest` (2), `ActivationIntegrationTest` (11), `PasswordChangeServiceTest` (16) | `login` (5), `services/auth` (8), `apiClient` (5) | `auth/login` (4), `auth/tab-session` | Senha errada; login e **Sair** | Aprovado* |
| RF03 Autorização por perfil | `AuthorizationIntegrationTest` (112), `CandidateFlowPermissionMatrixIntegrationTest` (77) | `ProtectedRoute` (6) | `auth/tab-session` | Coordenador recebe 403 em `/usuarios` | Aprovado |
| RF04 Estudos | `StudyIntegrationTest` (29), `StudyServiceTest` (35), `StudyControllerTest` (9) | `estudos/listagem` (13), `ModalEstudo` (14), `ModalEditarEstudo` (3), `ListaEstudos` (3), `CabecalhoEstudo` (12) | `studies/create-study` (2), `flows/full-recruitment` | Cadastro de estudo e listagem | Aprovado |
| RF05 Critérios | `StudyCriterionIntegrationTest` (15), `StudyCriterionServiceTest` (14) | `criterios` (11) | `flows/full-recruitment` | Validação e cadastro de inclusão e exclusão | Aprovado |
| RF06 Visitas previstas | `PlannedVisitIntegrationTest` (12) | `visitas-previstas` (10) | `flows/full-recruitment` | Visita prevista com atividade | Aprovado |
| RF07 Estados do estudo | `StudyStatusIntegrationTest` (15), `StudyLifecycleIntegrationTest` (7), `StudyProtocolFlowIntegrationTest` (15) | `visualizar` (51), `useRequisitosTransicao` (15), `SeloEstadoEstudo` (6) | `flows/full-recruitment` | Bloqueio com as três pendências; abertura do recrutamento | Aprovado |
| RF08 Candidatos | `CandidateIntegrationTest` (20), `CandidateServiceTest` (14), `CandidateConcurrencyIntegrationTest` (4), `CandidateFlowNegativePathsIntegrationTest` (25) | `recrutamento` (33), `ModalNovoCandidato` (15), `CardCandidato` (27), `ResultadoCadastroCandidato` (4) | `flows/full-recruitment`, `layout/cards-layout` | Pelas telas da T25.2 ([PR #124](https://github.com/livdenner/ClinicalStudyPB-project/pull/124)) | Aprovado |
| RF09 Elegibilidade | `EligibilityEvaluationIntegrationTest` (39), `EligibilityEvaluationServiceTest` (29), `EligibilityConcurrencyIntegrationTest` (2) | `AvaliacaoElegibilidade` (8) | `flows/full-recruitment` | — | Aprovado |
| RF10 Consentimento | `SimulatedConsentIntegrationTest` (26), `StudyInvitationServiceTest` (5), `StudyInvitationControllerTest` (4) | `ConsentimentoSimulado` (5) | `flows/full-recruitment` (aceite e recusa) | Pelas telas da T25.2 | Aprovado |
| RF11 Inclusão | `ParticipantIntegrationTest` (25), `ParticipantServiceTest` (35), `ParticipantConcurrencyIntegrationTest` (7) | `ModalConfirmarInclusao` (13), `PainelParticipantesVagas` (9) | `flows/full-recruitment`, `flows/reference-flow` | Pelas telas da T25.2 | Aprovado |

\* RF02 no E2E: aprovado nas condições da CI (um worker, stack aquecida). Com o paralelismo padrão, ou no primeiro login logo após a stack subir, o teste excede o tempo de espera de 5 s; é o achado A3 do relatório, uma fragilidade do teste, não do login.

`DemoSeedIntegrationTest` (22) cobre a repetição das quatro cargas sem duplicar dados, conferida também à mão na instalação limpa.

## Totais da execução

| Camada | Resultado |
| --- | --- |
| Backend | 940 testes, 0 falhas; JaCoCo 97,96% das linhas |
| Web | 513 testes em 47 arquivos, 0 falhas; 89,69% das linhas |
| E2E | 24 de 24 com um worker |
| Mobile | 260 testes em 23 suítes, 0 falhas |
| Manual | 12 verificações de RF01–RF07, todas aprovadas |

Nenhuma regressão de RF01 a RF11 foi encontrada.
