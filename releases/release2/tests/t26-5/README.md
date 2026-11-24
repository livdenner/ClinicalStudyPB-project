# T26.5 — Regressão RF01–RF11 e instalação limpa

[Voltar à Release 2](../../README.md) · [Rastreabilidade da regressão](../../../../docs/tests/rastreabilidade-regressao-release1.md)

Validação feita em 24/11/2026 (America/Fortaleza) sobre o commit final da Sprint 3, `development` **e975d92f6866acaa97690c9c7964ead2d7db8bee** (merge do PR #113), com o mesmo procedimento da [T16.13](../../../release1/tests/t16-13/README.md). Os dois critérios de aceitação foram atendidos: RF01 a RF11 aprovados na regressão, e a instalação limpa concluída seguindo o README, com as correções do guia registradas abaixo.

## Método

O código foi obtido com `git clone` do GitHub numa pasta nova e vazia, seguido de `git checkout e975d92`. Não foram copiados `node_modules`, `.env`, builds nem bancos de outra instalação. O `.env` foi criado a partir de `.env.example`, com senha do banco e chave JWT aleatórias geradas pelo comando Node.js do README. A instalação usou os nomes de contêiner, as portas (`15432` e `8080`) e o projeto Compose padrão.

Antes de começar, a máquina tinha os contêineres `clinicalstudypb-db` e `clinicalstudypb-backend` de uma tentativa anterior e incompleta desta task (cópia de 23/11, anterior ao PR #108, sem registro no repositório). Como o `compose.yaml` fixa esses nomes, os contêineres antigos foram removidos com `docker compose down`, com autorização do responsável; o volume e a pasta da tentativa anterior foram preservados.

Cada camada rodou pelos comandos do README, uma depois da outra. Os caminhos locais foram trocados por `<clone>`, `<logs>`, `<home>` e `<maven-repo>` nos logs, e o usuário do sistema por `<usuário>`. Segredos do `.env` não aparecem nas evidências.

## Ambiente

| Ferramenta | Versão observada |
| --- | --- |
| Sistema | Windows 11, PowerShell 5.1 e Git Bash |
| Docker Engine / Compose | 29.9.3 / 5.7.0 |
| Java | JDK 21.0.12 (`JAVA_HOME` configurado como o README pede; o `java` do PATH é o 24) |
| PostgreSQL | Imagem `postgres:18` |
| Node.js / npm | 22.22.0 / 10.9.4 |

## Instalação limpa

| Verificação | Comando ou procedimento do README | Resultado |
| --- | --- | --- |
| Configuração | `Copy-Item .env.example .env`, preenchimento de `DB_PASSWORD` e `JWT_SECRET_BASE64`, `docker compose config` | Aprovado |
| Stack | `docker compose up -d --build`, `docker compose ps`, `docker compose logs backend` | Aprovado: banco saudável, backend iniciado em 58 s, nenhum reinício |
| Migrações | Log do Flyway e `flyway_schema_history` | Aprovado: **V1–V15** aplicadas com sucesso, incluindo as cinco da Sprint 3 (V11–V15) |
| Swagger UI e OpenAPI | `Invoke-WebRequest` nos dois endereços | Aprovado: HTTP 200 em ambos |
| Carga fictícia | `docker compose cp` e o `psql` com os quatro scripts, **duas vezes** | Aprovado: saída 0 nas duas; 6 estudos, 26 usuários, 24 candidatos, 11 participantes, 9 agendamentos e 6 resultados; **contagens idênticas** nas 14 tabelas depois da 2ª carga |
| Recriação do banco | `docker compose down -v` e `docker compose up -d` | Aprovado: migrações reaplicadas e carga repetida com o mesmo resultado |
| Web | `npm ci` e `npm run dev` | Aprovado: 309 pacotes; login real pelo proxy `/api` |
| Mobile | `npm ci` | Aprovado |
| Android real | `npm start` e Expo Go, com `EXPO_PUBLIC_API_BASE_URL` apontando para a máquina | Aprovado: aplicativo aberto em Android físico, com login e listas de estudos e visitas, **confirmado pelo responsável pelo dispositivo** |

## Suítes existentes

| Camada | Comando | Resultado | Evidência |
| --- | --- | --- | --- |
| Backend | `.\mvnw.cmd -B -ntp verify` | **940 testes**, 0 falhas, 0 erros, 0 ignorados, em 48 classes; Checkstyle sem violações; JaCoCo **97,96% das linhas** (1972/2013), ramos 87,15% | [Log](backend-verify.txt), [suítes](backend-suites.csv), [JaCoCo](backend-coverage.csv) |
| Web — qualidade | `npm run lint`, `npm run build` | Aprovados | [Lint](web-lint.txt), [build](web-build.txt) |
| Web — formatação | `npm run format:check` | **Falhou no clone do Windows** por final de linha (achado A2); com `--end-of-line auto`, todos os arquivos estão formatados | [Log](web-format-check.txt), [sem final de linha](web-format-check-eol-auto.txt) |
| Web — testes | `npm run test:coverage`, repetido com `--maxWorkers=1` como o README orienta | **513 testes** em 47 arquivos, 0 falhas; 89,69% das linhas. A primeira tentativa não iniciou os workers do Vitest por tempo esgotado, sem falha de teste | [Log](web-tests.txt), [tentativa inicial](web-tests-inicial.txt) |
| E2E | `npx playwright install chromium`, `npm run e2e:stack:up`, `npm run test:e2e`, `npm run e2e:stack:down` | **24 de 24 aprovados** com um worker, como na CI. Com o paralelismo padrão, logins passaram do limite de 5 s (achado A3) | Ver tabela abaixo |
| Mobile | `npm test -- --ci --runInBand --coverage`, `npx tsc --noEmit`, `npx expo install --check` | **260 testes** em 23 suítes; 92,66% das linhas; TypeScript sem erros; "Dependencies are up to date" | [Testes](mobile-tests.txt), [tsc](mobile-tsc.txt), [Expo](mobile-expo-check.txt) |

### Execuções do E2E

| Execução | Stack | Workers | Resultado | Evidência |
| --- | --- | --- | --- | --- |
| 1 | Nova | Padrão (paralelo) | 20 aprovados, 4 falhas: os primeiros logins não concluíram em 5 s | [Log](e2e-1-paralelo.txt) |
| 2 | Nova | Padrão (paralelo) | 16 aprovados, 8 falhas, todas aguardando a resposta do login | [Log](e2e-2-paralelo.txt) |
| 3 | Já aquecida | 1 | **24 aprovados** | [Log](e2e-3-um-worker-stack-aquecida.txt) |
| 4 | Nova | 1 | 23 aprovados; falhou só o primeiro login da execução | [Log](e2e-4-um-worker-stack-nova.txt) |

Medição feita entre as execuções: o primeiro login depois de subir a stack E2E levou **12,8 s** (JVM fria); os seguintes levaram cerca de 0,7 s, diretamente e pelo proxy do `vite preview`. As falhas mostram o formulário ainda em "Entrando" quando o `expect` de 5 s expira. Não há regressão de RF02: o mesmo cenário passou nas execuções 3 e 4 (exceto o primeiro login da 4) e na conferência manual. A [CI do mesmo commit](https://github.com/livdenner/ClinicalStudyPB-project/actions/runs/45287852924) aprovou os 24 testes; ela usa `workers: 1` e até duas novas tentativas.

## Conferência manual das telas

Feita na web de `npm run dev`, contra a stack instalada e com a carga completa, conduzindo o navegador pelos fluxos e conferindo cada tela nas capturas.

| RF | Verificação | Resultado | Captura |
| --- | --- | --- | --- |
| RF02 | Senha errada mostra a mensagem genérica e mantém o login | Aprovado | [Captura](conferencia/rf02-a-senha-invalida.png) |
| RF02 | Pesquisador entra em **Estudos clínicos**; **Sair** volta ao login | Aprovado | [Captura](conferencia/rf02-b-login-logout.png) |
| RF03 | Coordenador em `/usuarios` recebe a página 403 | Aprovado | [Captura](conferencia/rf03-coordenador-usuarios-403.png) |
| RF01 | Formulário de usuário vazio mostra os campos obrigatórios | Aprovado | [Captura](conferencia/rf01-a-usuario-validacao.png) |
| RF01 | Administrador cadastra um coordenador, que aparece na lista | Aprovado | [Captura](conferencia/rf01-b-usuario-cadastrado.png) |
| RF04 | Pesquisador cadastra estudo (API responde 201), que abre em Planejamento | Aprovado | [Captura](conferencia/rf04-a-estudo-cadastrado.png) |
| RF04 | Listagem mostra os estudos da carga e o novo | Aprovado | [Captura](conferencia/rf04-b-listagem-estudos.png) |
| RF07 | Sem protocolo completo, **Abrir recrutamento** fica desabilitado e lista as três pendências | Aprovado | [Captura](conferencia/rf07-a-recrutamento-bloqueado.png) |
| RF05 | Critério sem tipo e descrição mostra os erros obrigatórios | Aprovado | [Captura](conferencia/rf05-a-criterio-validacao.png) |
| RF05 | Critérios de inclusão e de exclusão cadastrados e listados | Aprovado | [Captura](conferencia/rf05-b-criterios-cadastrados.png) |
| RF06 | Visita prevista com atividade cadastrada | Aprovado | [Captura](conferencia/rf06-visita-cadastrada.png) |
| RF07 | Com protocolo completo, o recrutamento abre e o próximo passo passa a ser **Iniciar execução** | Aprovado | [Captura](conferencia/rf07-b-recrutamento-aberto.png) |

RF08 a RF11 foram conferidos pelas suítes e pelo E2E (fluxo completo de recrutamento e fluxo de referência) e pelas telas registradas na T25.2 ([PR #124](https://github.com/livdenner/ClinicalStudyPB-project/pull/124)), feitas no mesmo commit.

## Achados

| ID | Achado | Tratamento |
| --- | --- | --- |
| A1 | No Git Bash do Windows, o comando de carga do README falha: o shell converte `/tmp/seed/...` em caminho do Windows e o `psql` não encontra os arquivos. O README dizia que o comando funcionava em bash e PowerShell. | README corrigido: usar PowerShell ou `MSYS_NO_PATHCONV=1`. A alternativa foi conferida na stack instalada. |
| A2 | O Git para Windows vem com `core.autocrlf=true`; o clone sai com CRLF e o `format:check` da web falha em todos os arquivos, porque o Prettier exige LF. O repositório guarda os arquivos em LF e a CI, em Linux, passa. | README corrigido: clonar com `-c core.autocrlf=false`. Recomendado também `* text=auto eol=lf` no `.gitattributes`, em task própria, por alterar a normalização do repositório. |
| A3 | O E2E local com o paralelismo padrão é instável no login: o primeiro login após subir a stack leva cerca de 13 s e os `expect` de login usam o limite padrão de 5 s. | README orienta `--workers=1`, como na CI. **Task prioritária recomendada:** aquecer o backend no `e2e:stack:up` ou aumentar o tempo de espera dos logins em `e2e/support/auth.ts` e `e2e/auth/*.spec.ts`. |
| A4 | O README da raiz descrevia o aplicativo como "sem login" e dizia que a URL da API não era necessária; o roteiro mandava usar o Swagger para telas que já existem; o histórico (PR #119) aparecia "em revisão"; a tabela citava Expo 58.0.19 e React Native 0.88.0. | README corrigido: seção do aplicativo, variável `EXPO_PUBLIC_API_BASE_URL`, roteiro, histórico e versões (58.0.26 e 0.88.1). |
| A5 | A pasta do Temurin 21 na máquina está incompleta (só `lib`); foi usado o JDK 21.0.12 da Oracle. | Ambiente local, sem impacto no projeto. |

Nenhum achado é regressão de RF01 a RF11. A3 é fragilidade do teste, não do sistema, mas pode esconder uma regressão real de login; por isso é recomendado como próxima task antes de novo desenvolvimento, conforme a regra da T26.5.

## Critérios de aceitação

- [x] RF01 a RF11 aprovados na regressão: suítes de backend, web e mobile sem falhas, E2E com 24/24 nas condições da CI e conferência manual de RF01–RF07.
- [x] Instalação limpa concluída pelo README; os passos que precisaram de ajuste (A1, A2 e A4) foram incorporados ao README nesta task.
- [x] Seeds executadas duas vezes sem duplicar.
