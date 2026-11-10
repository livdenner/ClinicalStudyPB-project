# Testes e cobertura da Release 1

[Voltar à Release 1](../README.md) · [Resumo em JSON](consolidacao/resumo.json)

## Versão e ambiente

Consolidação de 09/11/2026 (America/Fortaleza) sobre `development` **6ab8cba28d852f7938fa3bdd886a0912fb7acedf**, incluindo as integrações de inclusão, protocolo e carga de recrutamento. A execução local usou a branch documental em `ba4bfa4`, cujo backend/web/mobile são iguais aos dessa base. Java 21.0.7, Node.js 22.23.4, npm 10.9.9, Docker e PostgreSQL Testcontainers.

A [CI 42728167544](https://github.com/livdenner/ClinicalStudyPB-project/actions/runs/42728167544), do mesmo commit, concluiu os quatro jobs com sucesso. Timestamps dos trechos da CI estão em UTC; o dia local da validação é 09/11.

| Camada | Execução | Resultado | Cobertura de linhas | Evidência permanente |
| --- | --- | --- | --- | --- |
| Backend | `mvnw verify` local | **487 testes**, 0 falhas, 0 erros, 0 ignorados; Checkstyle e JaCoCo aprovados | **97,27% (891/916)** | [Log](consolidacao/backend-verify.txt), [suítes JUnit](consolidacao/backend-suites.csv), [CSV JaCoCo](consolidacao/backend-coverage.csv) |
| Web | `npm run test:coverage -- --maxWorkers=1` local | **21 arquivos, 166 testes**, saída 0 | **74,60% (1134/1520)** | [Log completo](consolidacao/web-tests.txt) |
| Web — qualidade e build | `format:check`, `lint`, `build` | Aprovados | Não se aplica | [Log](consolidacao/web-quality-build.txt) |
| E2E web | Playwright na CI com API e PostgreSQL reais | **7 testes aprovados** | Não se aplica | [Trecho real da CI](consolidacao/ci-e2e.txt) |
| Mobile | Jest com cobertura na CI | **2 suítes, 2 testes aprovados** | **76,47%** | [Trecho real da CI](consolidacao/ci-mobile.txt) |
| Mobile — dispositivo | Expo Go em Android físico | Abertura e navegação nos dois sentidos confirmadas | Não se aplica | [Registro T16.13](t16-13/README.md) |

A meta de **80%** aplica-se às linhas do backend verificadas pelo JaCoCo. O relatório exclui a classe principal e classes `*Configuration`/`*Config`, conforme o [POM](../../../backend/pom.xml); não exclui módulos de negócio. São 25 linhas não cobertas. Ramos: backend **81,07% (227/280)**; web **66,24%**; mobile **58,06%**. Web/mobile não têm um limite mínimo equivalente configurado.

Os valores da tabela não são combinados com execuções anteriores: a nova tela de consentimento e os critérios ampliaram o conjunto instrumentado da web. Cobertura mede execução automatizada; uma captura manual não aumenta a métrica.

## Comandos e relatórios

Siga os [pré-requisitos e comandos do README](../../../README.md#6-testes-cobertura-e-qualidade). `mvnw verify` gera JaCoCo em `backend/target/site/jacoco/` e JUnit em `backend/target/surefire-reports/`; a web gera `web/coverage/`, o mobile gera `mobile/coverage/` e o Playwright gera `web/playwright-report/`.

Na CI, os artefatos são `jacoco-report`, `junit-report`, `web-coverage`, `mobile-coverage` e `playwright-report`. Os logs, CSVs e o resumo desta pasta preservam a evidência essencial no próprio Git, independentemente da retenção dos artefatos do Actions.

A primeira execução web desta consolidação concluiu 144 testes, mas falhou ao iniciar um worker de `usuarios/listagem.test.tsx`; o [log inicial](consolidacao/web-tests-inicial.txt) foi preservado. Após encerrar os servidores de demonstração já utilizados, a suíte completa passou com um worker, sem ampliar timeouts ou remover testes. Formatação, lint e build foram verificados em uma exportação dos arquivos do Git com `core.autocrlf=false`, reutilizando as dependências instaladas: isso preserva LF como no CI e evita conversão CRLF do checkout Windows.

## Integração, concorrência e limites da evidência

| Área | Testes no repositório | O que demonstram |
| --- | --- | --- |
| Autenticação e autorização | [AuthIntegrationTest](../../../backend/src/test/java/clinicalstudypb/auth/AuthIntegrationTest.java), [AuthorizationIntegrationTest](../../../backend/src/test/java/clinicalstudypb/auth/AuthorizationIntegrationTest.java) | Login/logout, credenciais e matriz de acesso HTTP com PostgreSQL. |
| Protocolo | [StudyProtocolFlowIntegrationTest](../../../backend/src/test/java/clinicalstudypb/studies/StudyProtocolFlowIntegrationTest.java) | Critérios, visitas, abertura de recrutamento, perfis e conflitos sem gravação parcial. |
| Elegibilidade | [EligibilityEvaluationIntegrationTest](../../../backend/src/test/java/clinicalstudypb/candidates/EligibilityEvaluationIntegrationTest.java), [EligibilityConcurrencyIntegrationTest](../../../backend/src/test/java/clinicalstudypb/candidates/EligibilityConcurrencyIntegrationTest.java) | Respostas, resultado, autoria/instante e serialização com operações concorrentes. |
| Inclusão | [ParticipantIntegrationTest](../../../backend/src/test/java/clinicalstudypb/participants/ParticipantIntegrationTest.java), [ParticipantConcurrencyIntegrationTest](../../../backend/src/test/java/clinicalstudypb/participants/ParticipantConcurrencyIntegrationTest.java) | Elegibilidade, consentimento, duplicidade, capacidade, rollback e disputa da última vaga. |
| Carga fictícia | [DemoSeedIntegrationTest](../../../backend/src/test/java/clinicalstudypb/support/DemoSeedIntegrationTest.java) | Três scripts, repetição sem duplicação, consistência de vínculos, cenários de recrutamento e última vaga. |
| Web | [Testes em src](../../../web/src), [E2E](../../../web/e2e) | Componentes usam HTTP simulado; os sete E2E existentes exercitam login, proteção sem sessão, cadastro/validação de estudo e carregamento. |

Os sete E2E atuais **não representam** o fluxo completo de recrutamento até inclusão. A evidência desse fluxo combina integração de backend, [capturas reais de RF05–RF10](../images/README.md) e a [sessão HTTP de inclusão](rf11-api.json).

## Sessão real da API RF11

O [JSON de evidências](rf11-api.json) registra método, rota, corpo e resposta desserializada, sem token ou cabeçalho de autorização. Depois da avaliação/consentimento demonstrados nas imagens:

1. Consulta do candidato: `200`, `ELIGIBLE`.
2. Inclusão sem corpo: `201`, participante criado.
3. Repetição da inclusão: `409`, candidato já incluído.
4. Consulta dos participantes: `200`, mesmo vínculo persistido.
5. Envio de campo `decision` em vez de `status`: `400`, conteúdo inválido.
6. Envio do corpo correto `{"status":"DECLINED"}` depois da inclusão: `409`, consentimento bloqueado.

O passo 5 foi corrigido no passo 6; foi preservado para não ocultar a requisição divergente. Os dados são fictícios e a sessão não modifica dados pessoais ou de produção.

## Histórico e instalação limpa

- [T16.13: instalação, migrações, seeds, Swagger e Android](t16-13/README.md): base `2c6e854`, 450 testes backend e 157 web naquele recorte; não confundir com as contagens atuais.
- [Registro anterior da release](historico-antes-t16-12.md): preserva regressões e CI em `548164d`, incluindo suas pendências da época. Os resultados mais recentes estão na tabela desta página.
- O plano de testes fornecido pela equipe define cenários e critérios; o documento **Testes-Implementados-Development.pdf** é uma auditoria histórica de 03/11/2026 (`01e78e8`), sem substituir a execução atual.
