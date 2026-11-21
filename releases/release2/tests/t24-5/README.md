# T24.5 — Regressão web de ações, cores e sessões

Task 4033. Branch `test/4033-ux-session-regression-web`, criada da `development` em `574125d`. Os resultados locais foram obtidos em 21/11/2026, após integrar a `development` em `21e5c2f` (PRs #99 e #100). A CI precisa ser confirmada na PR.

## Observações verificadas

| Observação | Cobertura | Resultado local |
| --- | --- | --- |
| Botões dentro dos estudos | [Cabeçalho](../../../../web/src/components/estudos/CabecalhoEstudo.test.tsx) e [quatro abas](../../../../web/src/pages/estudos/visualizar.test.tsx): cinco estados, permissões, no máximo uma ação primária, motivo de bloqueio e Voltar sem enviar transição. | Passou |
| Excesso de verde e cores sem significado | [Estados dos estudos](../../../../web/src/components/estudos/SeloEstadoEstudo.test.tsx), [situação e elegibilidade do candidato](../../../../web/src/components/candidatos/CardCandidato.test.tsx), [participantes](../../../../web/src/components/estudos/EstadosParticipantes.test.tsx) e [telas de protótipos acessíveis](../../../../web/src/context/PrototiposContext.test.tsx): rótulos e tokens da tabela do CONTRIBUTING. | Passou |
| Cards desalinhados | [Layout](../../../../web/e2e/layout/cards-layout.spec.ts): seis casos existentes em 1366px e 375px, com alturas, rodapés e ausência de rolagem horizontal. | Passou |
| Perfis diferentes em abas distintas | [Sessões](../../../../web/e2e/auth/tab-session.spec.ts): login/logout e expiração em duas páginas do mesmo contexto, mais administrador e coordenador em dois contextos. O coordenador recebe HTTP 200 ao consultar estudos após o logout do administrador. | Passou |

Os testes de cor verificam os tokens e o rótulo exibido; não são uma medição visual de contraste no navegador. Os testes de componente usam callbacks ou HTTP simulados. Os testes de sessão usam login pela interface contra a API e o PostgreSQL descartáveis, com contas fictícias.

## Rastreabilidade RF04–RF11

| RF | Tela ou regra | Testes de regressão | Resultado local |
| --- | --- | --- | --- |
| RF04 | Cadastro, consulta e edição de estudos | [Listagem](../../../../web/src/pages/estudos/listagem.test.tsx), [detalhes e permissões](../../../../web/src/pages/estudos/visualizar.test.tsx) e [cadastro E2E](../../../../web/e2e/studies/create-study.spec.ts). | Passou |
| RF05 | Critérios de inclusão e exclusão | [Critérios](../../../../web/src/pages/estudos/criterios.test.tsx). | Passou |
| RF06 | Visitas previstas e atividades | [Visitas previstas](../../../../web/src/pages/estudos/visitas-previstas.test.tsx). | Passou |
| RF07 | Estados e requisitos de transição | [Cabeçalho](../../../../web/src/components/estudos/CabecalhoEstudo.test.tsx), [detalhes](../../../../web/src/pages/estudos/visualizar.test.tsx) e [requisitos](../../../../web/src/pages/estudos/useRequisitosTransicao.test.tsx). | Passou |
| RF08 | Cadastro e listagem de candidatos | [Recrutamento](../../../../web/src/pages/recrutamento/recrutamento.test.tsx). | Passou |
| RF09 | Avaliação de elegibilidade | [Elegibilidade](../../../../web/src/components/candidatos/AvaliacaoElegibilidade.test.tsx). | Passou |
| RF10 | Consulta da decisão do candidato | [Recrutamento](../../../../web/src/pages/recrutamento/recrutamento.test.tsx) e [situação do candidato](../../../../web/src/components/candidatos/CardCandidato.test.tsx). Consentimento é decidido pelo participante no aplicativo; o coordenador só consulta. | Passou |
| RF11 | Inclusão, confirmação e vagas | [Modal de inclusão](../../../../web/src/components/candidatos/ModalConfirmarInclusao.test.tsx), [painel de vagas](../../../../web/src/components/candidatos/PainelParticipantesVagas.test.tsx) e [recrutamento](../../../../web/src/pages/recrutamento/recrutamento.test.tsx). | Passou |

## Validação local

| Verificação | Resultado |
| --- | --- |
| Vitest: suíte e reexecução do arquivo que não iniciou | 349 passaram (298 + 51); 0 falhas de asserção. A execução completa teve um timeout de inicialização do worker. |
| Playwright completo, Chromium | 16 passaram; 0 falhas; 1 ignorado. Os três cenários de sessão passaram. |
| Lint, TypeScript e build | Passaram. |
| Formatação | Os sete arquivos de teste da task passaram no Prettier. Nos arquivos antigos com CRLF, a conferência em memória, normalizando para LF, passou. |

O Vitest foi executado com `npm run test:coverage -- --pool=forks --maxWorkers=1`: 35 arquivos passaram e o worker de `visualizar.test.tsx` não iniciou por timeout. Os 51 testes desse arquivo passaram ao repetir `npm run test -- src/pages/estudos/visualizar.test.tsx --pool=forks --maxWorkers=1`. A cobertura dessa tentativa ficou parcial, por isso não é apresentada como cobertura da suíte completa. O Playwright foi executado com `npm run test:e2e -- --workers=1`, usando a stack descartável `compose.e2e.yaml`.

## Relatório automático da CI

O bot registra os resultados de cada teste nos [relatórios automáticos da CI](../../../../docs/test-ci/README.md). Após a execução da PR, o relatório específico desta task ficará em `docs/test-ci/pull-requests/<número>/`, com o índice correspondente. A confirmação dos jobs Web e E2E na CI ainda está pendente.

## Limite da validação E2E

O [fluxo completo da Release 1](../../../../web/e2e/flows/full-recruitment.spec.ts) já estava marcado como fixme, aguardando a T17.11 adaptar o cadastro e a decisão de consentimento ao contrato atual. Ele permanece ignorado e não foi contado como aprovado. A regressão de RF05–RF11 desta task é comprovada pelos componentes e telas com HTTP simulado; não há comprovação nova do fluxo completo contra a API real.

