# Release 2 — Acompanhamento de participantes e aplicativo

Entrega das Sprints **3 (11–23/11/2026)** e **4 (24/11–07/12/2026)**. Documento em construção: nesta versão registra as alterações de escopo aprovadas pela PO e a linha de base da Sprint 3; escopo completo, rastreabilidade, testes e processo entram no registro da sprint (T26.4). O projeto usa dados fictícios e consentimento estritamente simulado.

[Instalação e execução](../../README.md#5-instalação-e-execução) · [OpenAPI](../../backend/openapi.yaml) · [Release 1](../release1/README.md) · [Azure DevOps TEAM5](https://dev.azure.com/engsw2/TEAM5)

## Alterações de escopo aprovadas pela PO

### Identidade do candidato e decisão de consentimento no aplicativo (PBI-17)

**Origem:** observação da professora sobre a Release 1, pedindo candidato com mais dados, conta mínima, primeiro login no aplicativo com troca de senha e decisão de consentimento pelo próprio candidato. A mudança foi aprovada pela PO no planejamento da Sprint 3 e altera a interface de RF10 prevista no enunciado: a decisão sai da web do coordenador e passa ao aplicativo do candidato.

| Aspecto | Release 1 | Release 2 |
| --- | --- | --- |
| Dados do candidato | Nome e idade. | Nome, idade, e-mail e telefone; o e-mail identifica a conta do candidato. |
| Conta do candidato | Não existia. | Conta `PARTICIPANT` criada no cadastro, ou vinculada se o e-mail já tiver conta de participante. |
| Primeiro acesso | — | No aplicativo, com e-mail e código de ativação de uso único (72 horas), seguido de troca obrigatória de senha. |
| Decisão de consentimento (RF10) | Registrada pelo coordenador na web, com possibilidade de troca até a inclusão. | Registrada pelo próprio candidato no aplicativo, uma única vez; o coordenador só consulta e recebe 403 se tentar registrar. |
| Inclusão (RF11) | Coordenador, com elegibilidade `ELIGIBLE` e consentimento `GRANTED`. | Sem mudança de regra: continua com o coordenador e exige o aceite do candidato. |

Sem envio de e-mail nesta sprint: o código de ativação é exibido ao coordenador na web, como recurso de demonstração, e repassado ao candidato. Notificações e caixa de mensagens ficaram para a Sprint 4.

O contrato está definido no [`openapi.yaml`](../../backend/openapi.yaml) (T17.1); a implementação no backend, na web e no aplicativo é feita nas tarefas T17.2 a T17.10.

## Linha de base da Sprint 3 (T26.2)

Verificação feita em 12/11/2026 para garantir que a Sprint 3 parte da versão publicada da Release 1, sem PRs pendentes nem migrações inconsistentes.

| Item | Resultado |
| --- | --- |
| Commit base | `development` **72bfdd4** (merge do PR #68). `main` **8e88d15**, com a tag `release1` (PR #70). |
| Divergência entre `development` e `main` | Nenhuma além do merge: `development` não tem commits fora de `main`; `main` tem só o commit de merge do PR #70. |
| CI no GitHub | [Execução do push em 72bfdd4](https://github.com/livdenner/ClinicalStudyPB-project/actions/runs/42756752300) (10/11/2026): Backend, Web, E2E e Mobile com sucesso. |
| Migrações | Flyway V1–V10; a Release 1 termina em `V10__create_participants.sql`. A próxima livre é V11, a combinar entre as frentes antes de criar. |
| PRs da Sprint 2 | Nenhum aberto em 12/11/2026. O único PR aberto é o #71, da Sprint 3. |
| Bloqueios | Nenhum. |

### Execução local dos quatro jobs da CI

Mesmos comandos de [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), executados sobre uma cópia limpa de 72bfdd4 em 12/11/2026 (Windows 11, Node.js 24, Java 21, Docker 29.9.2, Compose 5.6.1).

| Job | Comandos | Resultado |
| --- | --- | --- |
| Backend | `./mvnw -B -ntp verify` | 487 testes, 0 falhas; Checkstyle sem violações; JaCoCo 97,27% de linhas (891/916), regras de cobertura atendidas. |
| Web | `npm ci`, `format:check`, `lint`, `test:coverage`, `build` | Formatação, lint e build sem erros; Vitest com 25 arquivos e 200 testes aprovados; 86,75% de linhas. |
| Mobile | `npm ci`, `npm test -- --ci --coverage` | 2 suítes e 2 testes aprovados. |
| E2E | `npx playwright install chromium`, `e2e:stack:up`, `test:e2e`, `e2e:stack:down` | 8 testes aprovados contra backend e PostgreSQL reais. |

Na primeira execução local, o `test:coverage` da web falhou por sobrecarga da máquina, que rodava os outros jobs e o Docker ao mesmo tempo: três arquivos de teste não iniciaram (timeout do worker do Vitest) e um teste de login excedeu o tempo de espera. Repetido isoladamente, passou por completo. A CI do GitHub aprovou o mesmo commit.

### Compose do zero e migrações (apenas testes)

Os dois cenários cobrem as duas situações de quem instala ou atualiza o projeto: começar com um banco vazio ou continuar com o banco que já tem. Ambos foram testados com o `compose.yaml` da raiz, em projetos Docker temporários e separados do ambiente de desenvolvimento, com credenciais fictícias; os contêineres, volumes e imagens de teste foram removidos ao final.

| Cenário | O que comprova | Resultado |
| --- | --- | --- |
| Banco novo (instalação limpa) | Uma instalação do zero chega ao esquema atual e aceita os seeds. | Imagem do backend construída; Flyway aplicou as 10 migrações (V1–V10); `/v3/api-docs` respondeu 200; os três seeds de `backend/dev/` foram carregados sem erro, como no README principal; login do coordenador de demonstração respondeu 200. |
| Banco existente (atualização) | Quem já tem um banco da Release 1 continua usando o mesmo banco, sem recriá-lo. | Sobre uma cópia de um banco local já em V10, o Flyway validou as 10 migrações, sem nenhuma pendente, e o backend iniciou normalmente. |

As migrações novas da Sprint 3 (a partir de V11) devem passar pelos mesmos dois cenários antes da integração.

### Branches antigas

Em 12/11/2026 o repositório tinha, além de `main`, `development` e da branch do PR #71, uma única branch antiga:

| Branch | Situação | Destino |
| --- | --- | --- |
| `test/3458-study-transitions` | Sem PR; um commit de 07/11/2026 com dois testes de estados do estudo na web, em conflito com a `development`. | Encerrada por decisão do Gerente em 12/11/2026. Os dois casos (estudo encerrado sem botões de edição ou transição; cancelar a confirmação sem enviar transição) passam para os testes do PBI-24, que reorganiza os botões dos estudos. |

## Correção documental da Release 1 (T26.1)

Em 18/11/2026, o [README da Release 1](../release1/README.md) foi corrigido para refletir a versão realmente publicada. 

| Item | Correção |
| --- | --- |
| Versão | Tag `release1` e [GitHub Release](https://github.com/livdenner/ClinicalStudyPB-project/releases/tag/release1) publicadas em 10/11/2026, sobre `main` **8e88d15** (PR #70). |
| Matriz RF09–RF11 | Testes de componentes de elegibilidade, consentimento, modal de inclusão e painel de vagas (PRs #68 e #69); consentimento consultado na API pela lista de candidatos (PR #67); E2E do fluxo completo (PR #65). |
| Testes | Números de uma execução nova na tag, em [tests/tag-release1](../release1/tests/tag-release1/); os da consolidação anterior ficam como histórico. |
| Pendências | Ficaram só o login e os fluxos mobile e os rótulos do consentimento; E2E completo, testes de componentes e publicação da tag foram retirados por estarem concluídos. |
| Processo e galeria | Registram o fechamento da release depois do corte da Sprint 2 e que as capturas são anteriores à tag. |

Alteração apenas documental, integrada pela `development`: o conteúdo da tag `release1` não mudou.

## Rastreabilidade e testes do aplicativo mobile (T23.4)

Em **21/11/2026** (commit `3b2f7b0`), a suíte Jest do aplicativo mobile atingiu **23 suítes e 260 testes aprovados (0 falhas)** usando Jest + React Native Testing Library com HTTP inteiramente simulado e **zero chamadas reais de rede**, além de validação de tipos via `npx.cmd tsc --noEmit`. A meta mínima global de **80% de linhas** está configurada em [`mobile/package.json`](../../mobile/package.json) (`coverageThreshold.global.lines`), e todos os casos executados estão registrados em [`2026-11-21_22-15_T23-4_mobile-jest.md`](../../docs/test-runs/2026-11-21_22-15_T23-4_mobile-jest.md).

### Matriz de rastreabilidade mobile por RF

| RF | Requisito e telas cobertas | Cenários verificados (sucesso, vazio/validação e erro) | Suítes de teste |
| --- | --- | --- | --- |
| RF02 | Login, primeiro acesso por código, troca de senha e expiração de sessão (`login.tsx`, `activation.tsx`, `change-password.tsx`, `index.tsx`, `AuthProvider`) | **Sucesso:** login via `POST /api/auth/login` sem alterar a senha digitada, ativação via `POST /api/auth/activation`, definição de senha inicial (`PUT /api/auth/password` sem `currentPassword`), troca em conta ativa e logout local resiliente. **Validação/vazio:** campos obrigatórios, formato de e-mail, política de senha (8–72 caracteres, letra e número) e divergência de confirmação. **Erro e expiração:** erro `401` genérico no login/sessão, `503` e falha de rede (`TypeError`), código expirado/inválido, `CURRENT_PASSWORD_INVALID`, `PASSWORD_POLICY`, descarte de sessão vencida/corrompida, deduplicação de `401` concorrente e vencimento por timer/retorno ao primeiro plano. | [`authScreens.test.tsx`](../../mobile/src/__tests__/authScreens.test.tsx), [`navigation.test.tsx`](../../mobile/src/__tests__/navigation.test.tsx), [`authProvider.test.tsx`](../../mobile/src/__tests__/authProvider.test.tsx), [`authApi.test.ts`](../../mobile/src/__tests__/authApi.test.ts), [`authErrors.test.ts`](../../mobile/src/__tests__/authErrors.test.ts), [`loginForm.test.ts`](../../mobile/src/__tests__/loginForm.test.ts), [`activationForm.test.ts`](../../mobile/src/__tests__/activationForm.test.ts), [`passwordPolicy.test.ts`](../../mobile/src/__tests__/passwordPolicy.test.ts), [`session.test.ts`](../../mobile/src/__tests__/session.test.ts), [`secureSessionStorage.test.ts`](../../mobile/src/__tests__/secureSessionStorage.test.ts), [`authenticatedSession.test.ts`](../../mobile/src/__tests__/authenticatedSession.test.ts), [`apiClient.test.ts`](../../mobile/src/__tests__/apiClient.test.ts) |
| RF03 | Bloqueio de acesso, restrição por perfil e fluxo bloqueado antes da troca de senha obrigatória (`_layout.tsx`, `Stack.Protected` e rotas privadas) | **Bloqueio pré-troca (CA):** contas com `mustChangePassword = true` ou respostas `403 PASSWORD_CHANGE_REQUIRED` permanecem bloqueadas em todo o fluxo privado (`/`, `/invitations`, `/invitations/[candidateId]`, `/studies`, `/studies/[participantId]`, `/visits`, `/visits/[visitId]`), com redirecionamento contínuo para `/change-password` até a conclusão de `PUT /api/auth/password`. **Perfil e isolamento:** recusa imediata de perfis não participantes (ex.: `COORDINATOR`) no login, na ativação e no armazenamento persistido; bloqueio de rotas privadas sem sessão; descarte de dados da conta anterior após logout/troca de conta. | [`authScreens.test.tsx`](../../mobile/src/__tests__/authScreens.test.tsx), [`navigation.test.tsx`](../../mobile/src/__tests__/navigation.test.tsx), [`authProvider.test.tsx`](../../mobile/src/__tests__/authProvider.test.tsx), [`authenticatedSession.test.ts`](../../mobile/src/__tests__/authenticatedSession.test.ts), [`invitations.test.tsx`](../../mobile/src/__tests__/invitations.test.tsx), [`studies.test.tsx`](../../mobile/src/__tests__/studies.test.tsx), [`visits.test.tsx`](../../mobile/src/__tests__/visits.test.tsx) |
| RF10 | Convites e decisão de consentimento simulado pelo candidato (`invitations/index.tsx`, `invitations/[candidateId].tsx`, `PlannedVisitCard`) | **Sucesso:** listagem separando pendentes e decisões registradas, detalhe por `candidateId` com protocolo, datas civis e termo simulado, confirmação única de aceite (`GRANTED`) e recusa (`DECLINED`) com exibição somente leitura após decisão e atualização ao retornar à lista. **Vazio/validação:** lista vazia sem conteúdo falso, recusa de ID inválido na rota antes de chamar a API e cancelamento na confirmação sem envio. **Erro:** falha na listagem com recuperação, proteção contra duplo envio, `CANDIDATE_CANCELLED`, `STUDY_NOT_RECRUITING`, `CONSENT_ALREADY_DECIDED`, recuperação de resposta incerta por reconsulta, `401`, `403 PASSWORD_CHANGE_REQUIRED` e descarte de resposta tardia. | [`invitations.test.tsx`](../../mobile/src/__tests__/invitations.test.tsx), [`plannedVisitCard.test.tsx`](../../mobile/src/__tests__/plannedVisitCard.test.tsx), [`invitationApi.test.ts`](../../mobile/src/__tests__/invitationApi.test.ts), [`invitationErrors.test.ts`](../../mobile/src/__tests__/invitationErrors.test.ts), [`invitationPresentation.test.ts`](../../mobile/src/__tests__/invitationPresentation.test.ts) |
| RF17 | Consulta de estudos e protocolo pelo participante (`studies/index.tsx`, `studies/[participantId].tsx`, `PlannedVisitCard`) | **Sucesso:** listagem de `/api/me/studies` com separação semântica de `studyStatus` e `participationStatus` (incluindo `WITHDRAWN` e `CLOSED`), navegação para detalhe direto por rota com objetivo, período civil e visitas previstas (**Data prevista** e atividades). **Vazio/validação:** lista vazia orientando acesso aos convites, protocolo sem visitas previstas, estado desconhecido neutro e recusa de identificador inválido sem chamar a API. **Erro:** falha inicial com **Tentar novamente** sem mascarar como lista vazia, indisponibilidade de participação alheia (`404`), preservação de dados anteriores em erro ao voltar ao foco, abortamento via `AbortController`, `401`, `403 PASSWORD_CHANGE_REQUIRED` e limpeza na troca de conta. | [`studies.test.tsx`](../../mobile/src/__tests__/studies.test.tsx), [`navigation.test.tsx`](../../mobile/src/__tests__/navigation.test.tsx), [`plannedVisitCard.test.tsx`](../../mobile/src/__tests__/plannedVisitCard.test.tsx), [`studyApi.test.ts`](../../mobile/src/__tests__/studyApi.test.ts), [`studyPresentation.test.ts`](../../mobile/src/__tests__/studyPresentation.test.ts) |
| RF18 | Próximas visitas, histórico de comparecimento e detalhe (`visits/index.tsx`, `visits/[visitId].tsx`) | **Sucesso:** listagem de `/api/me/visits` em abas **Próximas** (`SCHEDULED`) e **Histórico** (`DONE`, `ABSENT`, `CANCELLED` com motivo exibido apenas em cancelada), migração de **Próximas** para **Histórico** após desfecho e detalhe com atividades previstas e bloco reservado para RF19 (sem botões ativos). **Vazio/validação:** estados vazios independentes para **Próximas** e **Histórico**, visita sem atividades previstas e rejeição de ID de texto ou zero sem chamar a API. **Erro:** falha inicial com recuperação, tradução segura de payload inválido e `403` sem vazar detalhes, visita ausente no detalhe, aviso de consulta anterior ao falhar no foco, `401`, `403 PASSWORD_CHANGE_REQUIRED` e descarte após logout. | [`visits.test.tsx`](../../mobile/src/__tests__/visits.test.tsx), [`navigation.test.tsx`](../../mobile/src/__tests__/navigation.test.tsx), [`visitApi.test.ts`](../../mobile/src/__tests__/visitApi.test.ts), [`visitPresentation.test.ts`](../../mobile/src/__tests__/visitPresentation.test.ts) |

### Cobertura mobile (`npm.cmd run test:report -- --runInBand --coverage`)

| Escopo | Instruções | Branches | Funções | Linhas |
| --- | --- | --- | --- | --- |
| **Global (`All files`)** | **92,67%** (1177/1270) | **89,07%** (987/1108) | **97,00%** (292/301) | **92,66%** (1163/1255) |
| Telas iniciais e autenticação (`app`) | 90,71% (127/140) | 81,15% (56/69) | 92,30% (36/39) | **90,71%** (127/140) |
| Telas de convites (`app/invitations`) | 85,64% (179/209) | 84,57% (148/175) | 91,30% (42/46) | **85,85%** (176/205) |
| Telas de estudos (`app/studies`) | 95,61% (109/114) | 91,66% (121/132) | 100,00% (28/28) | **95,53%** (107/112) |
| Telas de visitas (`app/visits`) | 94,95% (113/119) | 90,69% (156/172) | 96,55% (28/29) | **94,87%** (111/117) |
| Autenticação e sessão (`auth`) | 92,47% (332/359) | 85,84% (182/212) | 100,00% (70/70) | **92,37%** (327/354) |
| Formulário de senha (`components/auth`) | 96,87% (31/32) | 90,00% (9/10) | 100,00% (9/9) | **96,77%** (30/31) |
