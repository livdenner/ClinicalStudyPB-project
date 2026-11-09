# Release 1 — Estrutura e recrutamento

**Período previsto:** 13/10 a 09/11/2026  
**Sprints:** Sprint 1 e Sprint 2  
**Status:** em andamento

## Objetivo

Entregar a primeira versão operacional do ClinicalStudyPB para a aplicação web: gestão de usuários, autenticação e controle de acesso, cadastro de estudos e início do recrutamento. A release também prepara a base técnica compartilhada com o aplicativo mobile.

## Escopo planejado

| Sprint   | Requisitos e entregas planejadas                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sprint 1 | Base técnica; protótipos; RF01 (usuários); recorte web/API de RF02 (autenticação) e RF03 (permissões); RF04 (estudos); estrutura inicial mobile. |
| Sprint 2 | RF05 a RF11: critérios, visitas previstas, estados, candidatos, elegibilidade, consentimento e inclusão de participantes.                        |

## Funcionalidades e situação

| Item                                                                | Situação     | Evidência                                                                                                                                                                                                        |
| ------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Componentes base da web                                             | Em andamento | Formulários, mensagens de erro e layout compartilhado em `web/src/components`.                                                                                                                                   |
| Gestão de usuários (RF01)                                           | Em andamento | Rota `/usuarios` com listagem, busca, filtros, cadastro, edição e ativação/desativação integrados a `/api/users`. Acesso restrito ao Administrador. Alterações persistidas no backend.                           |
| Autenticação web (RF02)                                             | Em andamento | Tela `/login` e gestão de sessão integradas a `/api/auth/login` e `/api/auth/logout`, conforme a development atual. Testes em `web/src/pages/login/login.test.tsx`.                                              |
| Controle de acesso web/API (RF03)                                   | Em andamento | Autorização por perfil no backend com `@PreAuthorize` e proteção de rotas e menu na web com `ProtectedRoute`, `ForbiddenPage` e configuração de navegação.                                                       |
| Gestão de estudos (RF04)                                            | Em andamento | Listagem, busca por título, cadastro, edição e visualização por ID integrados a `/api/studies`, com JWT e persistência no banco. Cadastro utiliza o pesquisador logado; edição preserva o responsável existente. |
| Protótipos web de painel, recrutamento, visitas e relatórios (T7.2) | Em andamento | Telas navegáveis com dados mock locais e modais interativos em `/dashboard`, `/recrutamento`, `/visitas` e `/relatorios`, com testes em `web/src/pages/prototipos.test.tsx`.                                     |
| Recrutamento e inclusão (RF05 a RF11)                               | Pendente     | Planejado para a Sprint 2.                                                                                                                                                                                       |

## Cliente HTTP da web

A base web possui rotas com React Router, layout compartilhado e um cliente HTTP em `web/src/services/api/apiClient.ts`. Em desenvolvimento, o proxy do Vite encaminha chamadas `/api` para o backend em `http://localhost:8080`; se necessário, configure `VITE_API_BASE_URL` em `web/.env.local` para apontar para outro servidor. A tela de estudos utiliza `web/src/services/estudos.ts` para listar (`GET /api/studies`), cadastrar (`POST /api/studies`) e editar (`PUT /api/studies/{id}`); as operações exigem JWT.

O login e o logout utilizam o mesmo cliente HTTP compartilhado, preservando a gestão de sessão existente. `VITE_API_BASE_URL` representa somente a origem do servidor, sem `/api` (por exemplo, `https://api.exemplo.com`). Os caminhos são informados nas chamadas: autenticação em `/api/auth` e estudos em `/api/studies`, conforme os controllers atuais. O proxy do Vite funciona apenas no desenvolvimento; na implantação, o servidor web precisa encaminhar `/api` ao backend, ou a API em outra origem precisa permitir CORS.

## Testes de componentes de usuários (Task 3191)

Nos testes foram usados Vitest, React Testing Library e jsdom. Os componentes do HeroUI são renderizados de verdade; as requisições HTTP e as notificações de sucesso são simuladas. A execução local depende apenas das dependências da web, sem precisar iniciar Docker ou o backend.

| Arquivo                                                    | Cenários cobertos                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/src/components/usuarios/BuscaFiltroUsuarios.test.tsx` | Busca, seleção dos quatro perfis, situações Ativo/Inativo e limpeza dos filtros.                                                                                                                                                                   |
| `web/src/components/usuarios/TabelaUsuarios.test.tsx`      | Dados, perfis e situações nas linhas, usuário correto no callback de edição e estado vazio.                                                                                                                                                        |
| `web/src/components/usuarios/ModalUsuario.test.tsx`        | Campos obrigatórios, rejeição de espaços em branco, mostrar/ocultar senha, perfil no cadastro, senha somente no cadastro, cancelamento, bloqueio durante salvamento e sessão expirada.                                                             |
| `web/src/pages/usuarios/listagem.test.tsx`                 | Carregamento, lista vazia, filtros combinados, cadastro e edição com JWT, validações e erros por campo, ativação/desativação com confirmação, falha parcial com nova tentativa, falha de conexão, respostas 401/403 e restrição por perfil/sessão. |

Para executar somente os testes de usuários:

```powershell
npm --prefix web test -- src/components/usuarios src/pages/usuarios/listagem.test.tsx
```

## Integração de estudos

O contrato implementado pelo backend recebe e devolve `title`, `objective`, `responsibleUserId`, `startDate`, `endDate` e `participantLimit`; a resposta também inclui o `id` gerado pelo banco. O nome aceita até 200 caracteres, o objetivo é obrigatório, o limite deve ser um inteiro positivo e o término não pode ser anterior ao início. O backend verifica se o responsável existe, está ativo e possui perfil pesquisador.

A interface usa o pesquisador logado como responsável por novos estudos. Ao editar, mantém o `responsibleUserId` retornado pela API, mesmo quando pertence a outro pesquisador. Essa é uma decisão da interface, não uma restrição adicional do contrato. O nome do usuário logado é exibido quando seu ID corresponde ao responsável; nos demais casos, aparece `Pesquisador #ID`, pois a API de estudos não retorna o nome e a consulta de usuários é restrita a administradores.

A ação Visualizar da tabela abre `/estudos/{id}`, que consulta `GET /api/studies/{id}` com JWT. O endereço também pode ser acessado diretamente e mostra nome, objetivo, responsável, período e limite de participantes. A página permite editar pelo mesmo modal e atualiza os detalhes com a resposta do backend. Identificadores inválidos e respostas 404 exibem estudo não encontrado; falhas de conexão permitem tentar novamente.

A integração RF07 da task 3457 prepara a web para o campo `status` previsto no OpenAPI, com selo, filtro e transição dedicada. Esse campo depende da implementação RF07 do backend; quando ausente ou desconhecido, a interface apresenta "Estado indisponível" e não presume uma transição. A quantidade atual de participantes continua fora dessa resposta: a tabela mostra somente o limite, sem calcular ocupação nem assumir contagem zero. A validação do limite contra participantes já alocados depende de suporte do backend. O formulário só fecha e a tabela só é atualizada após sucesso da API; erros mantêm os dados digitados disponíveis para correção.

## Testes de componentes de estudos (Task 3148)

Os testes usam Vitest, React Testing Library e jsdom, com requisições HTTP e notificações de sucesso simuladas. Os componentes de busca, tabela, modal e calendário do HeroUI são exercitados diretamente.

| Arquivo                                                  | Cenários cobertos                                                                                                                                                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/src/components/estudos/BuscaFiltroEstudos.test.tsx` | Busca controlada, digitação e limpeza pelo callback.                                                                                                                                                            |
| `web/src/components/estudos/TabelaEstudos.test.tsx`      | Responsáveis, limites e períodos, inclusive entre anos diferentes, callback de edição e estado vazio.                                                                                                           |
| `web/src/components/estudos/CampoData.test.tsx`          | Segmentos acessíveis, alteração pelo teclado, bloqueio durante salvamento e erro de validação.                                                                                                                  |
| `web/src/components/estudos/ModalEstudo.test.tsx`        | Campos obrigatórios, normalização dos dados, limites válidos e inválidos, datas iguais, preservação do responsável, cancelamento, bloqueio de envios repetidos, foco nos erros e respostas 401/403.             |
| `web/src/components/estudos/ModalEditarEstudo.test.tsx`  | Edição pelo responsável, identificação do responsável original e bloqueio de edição por outro pesquisador ou pelo estado do estudo.                                                                             |
| `web/src/pages/estudos/listagem.test.tsx`                | Carregamento, estado vazio, busca, cadastro e edição via API com JWT, responsável logado no cadastro, preservação do responsável na edição, cancelamento, falhas de conexão, validações e restrições de acesso. |
| `web/src/pages/estudos/visualizar.test.tsx`              | Navegação da tabela para os detalhes, consulta por ID, retorno à listagem, edição, cancelamento de consultas pendentes, identificadores inválidos, respostas 401/403/404 e novas tentativas.                    |

O teste de listagem substitui o campo de data por um campo ISO simples para concentrar os cenários no fluxo da página. O calendário real é verificado nos testes de `CampoData`, `ModalEstudo` e visualização. A execução depende apenas das dependências da web, sem precisar iniciar Docker ou o backend.

Para executar os testes de telas e componentes de estudos:

```powershell
npm --prefix web test -- src/components/estudos src/pages/estudos
```

Os testes do serviço HTTP em `web/src/services/estudos.test.ts` acompanham a integração da task 3146.

## Regressão de usuários e estudos (Task 3479)

Verificação realizada sobre a `development` em `cf77b0d`, com as correções de regressão da branch `fix/3479-regression-users-studies`.

### Escopo e correções

- Atualizado o teste antigo de `ModalEditarEstudo`, que ainda dependia do modelo mockado removido e impedia o build. O teste agora usa `EstudoApi`, fornece o pesquisador e verifica a preservação do responsável.
- Atualizadas as expectativas de bloqueio na visualização de estudos para a página 403 de `ProtectedRoute`, mantendo a verificação de que nenhuma consulta de estudo é enviada para perfis sem permissão.
- Acrescentados cenários de acesso direto do Coordenador a `/usuarios`, `/estudos` e `/estudos/3`, verificando bloqueio, menu e ausência de chamadas à API.
- Corrigido o README principal, que ainda descrevia a gestão de estudos como mockada.

Não houve alteração dos contratos REST, das permissões ou do comportamento dos componentes de produção. Os mocks HTTP dos testes de componente continuam restritos aos testes; a verificação integrada abaixo usou a API e o PostgreSQL reais.

### Resultados automatizados

| Verificação                | Resultado                                                   |
| -------------------------- | ----------------------------------------------------------- |
| Vitest: suíte web completa | 18 arquivos, 127 testes passando, nenhum ignorado           |
| Maven: testes do backend   | 33 testes passando, nenhum ignorado                         |
| TypeScript e build Vite    | Aprovados; permanece o aviso existente de tamanho do bundle |

Comandos executados a partir da raiz, com Java 21 configurado no terminal do backend:

```powershell
npm --prefix web test -- --maxWorkers=2
npm --prefix web run build
Push-Location backend
.\mvnw.cmd test
Pop-Location
```

O limite de dois workers foi usado nesta máquina após uma execução paralela apresentar timeouts ao iniciar processos do Vitest. Não foram ampliados timeouts dos testes nem desabilitadas verificações.

### Verificação integrada com persistência real

Ambiente: Edge headless, web Vite em `http://127.0.0.1:5173`, proxy `/api` para o Spring Boot em `http://localhost:8080`, Java 21 e PostgreSQL 18.6 no container local `clinicalstudypb-db-dev`. As interações foram automatizadas no navegador sem interceptar ou simular as respostas HTTP. A validação não adiciona um runner E2E ou dependências ao repositório.

| Fluxo verificado                              | Resultado                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| Acesso sem sessão à web e sem JWT à API       | Redirecionamento ao login e HTTP 401                                           |
| Login com senha incorreta                     | HTTP 401 e ausência de sessão local                                            |
| Login de Administrador e recarga              | Sessão preservada e usuários consultados pela API                              |
| Cadastro de usuário pelo modal                | POST real e registro disponível após recarregar                                |
| Edição e desativação de usuário               | Confirmação, PUT/PATCH reais e situação persistida                             |
| Login de conta inativa e posterior reativação | Login negado enquanto inativa; permitido após ativação pelo modal              |
| Administrador acessando estudos               | Bloqueado na rota e HTTP 403 na API                                            |
| Pesquisador acessando usuários                | Bloqueado na rota e HTTP 403 na API                                            |
| Cadastro de estudo                            | Calendário real, POST com JWT e registro disponível após recarregar            |
| Visualização por ID e edição de estudo        | GET/PUT reais, responsável preservado e alterações disponíveis após recarregar |
| Coordenador acessando usuários e estudos      | Rotas bloqueadas e HTTP 403 nos dois endpoints                                 |
| Logout e retorno direto à rota protegida      | Sessão local removida e redirecionamento ao login                              |

Os 12 cenários acima passaram. Também foi feita consulta direta ao PostgreSQL para confirmar os registros fictícios criados nesta execução: usuário ID **10** e estudo ID **2**, identificados pelo prefixo `Regressão 3479`. Esses registros foram mantidos no banco local para conferência; não foram alterados os dados de negócio já existentes.

Para repetir a conferência manual, inicie banco, API e web conforme o README principal, carregue as contas fictícias de demonstração e execute os fluxos da tabela. Use nomes e e-mails novos com o prefixo `Regressão 3479`; confira cadastro e edição após recarregar a página e tente acessar diretamente as rotas com os três perfis.

### Limitação de RF07 e conclusão dos critérios

RF01 a RF04 foram verificados com o contrato disponível na execução original da regressão. Na atualização de 07/11/2026, a base da web incorporou `development` até `ca84219`, incluindo estado, transição, histórico, versão e bloqueios de edição do backend RF07.

A verificação integrada com API e banco deve ser repetida nessa base, conferindo o estado inicial e a preservação do estado ao editar título, objetivo, datas e limite de participantes. Os resultados históricos acima se referem à execução original da task 3479.

- [x] Fluxos web de RF01 a RF04 verificados com API e banco reais.
- [x] Suítes automatizadas existentes passando e build aprovado.
- [ ] Compatibilidade de cadastro e edição com RF07 validada após integração do contrato de estados.

## Estados dos estudos (Task 3457)

A web utiliza o contrato RF07 atualizado de `backend/openapi.yaml`. O estudo retorna `status` e `version`. A alteração de estado é enviada por `PATCH /api/studies/{id}/status`, com JWT e corpo `{"status":"RECRUITMENT","expectedStatus":"PLANNING"}`, por exemplo. `expectedStatus` representa o estado que a tela consultou. Cadastro e edição enviam os campos de `StudyWriteRequest`.

- Selo de estado na listagem e nos detalhes, usando Chip do HeroUI.
- Filtro local por estado combinado com a busca por título, pois o GET atual retorna a lista completa.
- Nos detalhes, somente o pesquisador responsável vê as ações de avanço `PLANNING` → `RECRUITMENT` → `EXECUTION` → `CLOSED`, retorno de `RECRUITMENT` para `PLANNING` e cancelamento dos estados permitidos pela API.
- Confirmação em Modal do HeroUI, com estado atual e destino, bloqueio de fechamento e envio durante o salvamento.
- Estado e ação disponíveis atualizados somente após sucesso, usando o estudo devolvido pela API. Falhas preservam os dados anteriores.
- Mensagens para 400, 401 e 403. Após HTTP 409, a web consulta o estudo para conferir estado e versão. Se os dados mudaram ou a conferência falhou, oferece "Atualizar estudo". Se continuam iguais, exibe a pendência informada pela API, como cadastrar visitas, critérios ou incluir participantes.

Rótulos, cores e próximos estados ficam centralizados em `web/src/config/estados-estudo.ts`. Tipos ficam em `web/src/types/estudo.ts`, e a chamada REST em `web/src/services/estudos.ts`. Quando o backend ainda não informa um estado reconhecido, a interface mostra "Estado indisponível" e não oferece uma mudança baseada em suposição.

### Permissões e dependências

As decisões de negócio fornecidas pela equipe restringem edição e transição ao pesquisador responsável. A web verifica perfil e identificador do responsável: outro pesquisador consulta os dados, mas não recebe botões de edição ou mudança de estado. A edição dos dados é permitida apenas em `PLANNING` e `RECRUITMENT`; `EXECUTION`, `CLOSED` e `CANCELLED` ficam somente leitura. O modal também bloqueia o envio direto de um formulário em modo de consulta.

O cancelamento exige justificativa de até 1.000 caracteres, enviada em `reason`. Para estudos em `CANCELLED`, a web consulta `GET /api/studies/{id}/status-history` e oferece restauração apenas para a origem `PLANNING` ou `RECRUITMENT`. Cancelamentos originados em `EXECUTION` não oferecem restauração. Se o histórico falhar, os dados do estudo continuam visíveis e a interface oferece uma nova tentativa da consulta ao histórico. A restauração fica indisponível até identificar um destino permitido.

O backend integrado valida o pesquisador responsável e permite editar estudo e protocolo em `PLANNING` e `RECRUITMENT`. Ao abrir recrutamento, verifica visita com atividade e critérios de inclusão/exclusão. Ao iniciar execução, verifica participante incluído. A validação de critérios e inclusão depende do provedor `StudyReadiness`. Os motivos de bloqueio retornados pela API são exibidos pela web.

### Verificações de RF07

A revisão da PR #41 registrou 138 testes Web passando, além de ESLint, Prettier, build e checks da CI. Os testes cobrem avanço, retorno ao planejamento, justificativa obrigatória, restauração conforme histórico e distinção dos conflitos HTTP 409. O cenário de falha e recuperação do histórico foi acrescentado após essa revisão.

A validação dos fluxos com API e banco reais permanece pendente.

## Como executar a web

Pré-requisitos: Git e Node.js 22 LTS.

Na raiz do repositório:

```powershell
npm --prefix web ci
npm --prefix web run dev
```

Para validar os componentes e gerar a build:

```powershell
npm --prefix web run test
npm --prefix web run build
```

## Evidências a registrar no fechamento

- [ ] Link do board e burndown da sprint no Azure DevOps.
- [ ] Capturas ou demonstração dos fluxos concluídos.
- [ ] Resultados da CI, testes e cobertura.
- [ ] Link da documentação OpenAPI/Swagger.
- [ ] Pendências, impedimentos e ações da retrospectiva.
- [ ] Tag e GitHub Release `release1`.

## Pendências conhecidas

- O login mobile integrado pertence à Sprint 3.
- Os resultados deste documento devem ser atualizados com evidências reais; itens planejados não devem ser apresentados como entregues.
- Pré-requisitos e comandos do backend;
- Pré-requisitos e comandos do mobile;
- Resultados reais dos testes, CI, cobertura, capturas e burndown.
