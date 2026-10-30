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

| Item                                                                | Situação     | Evidência                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Componentes base da web                                             | Em andamento | Formulários, mensagens de erro e layout compartilhado em `web/src/components`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Gestão de usuários (RF01)                                           | Em andamento | Task 3192: rota `/usuarios` com listagem, busca por nome/e-mail, filtros por perfil e situação, cadastro e edição integrados a `/api/users` pelo cliente HTTP compartilhado. Requer sessão de administrador. Senha informada somente no cadastro; edição atualiza nome, e-mail e perfil. O modal de edição possui um interruptor Ativo/Inativo local: a situação só é enviada após salvar e confirmar. Dados são atualizados por `PUT` e situação por `PATCH`; falhas parciais são informadas e permitem tentar novamente. Sessões já emitidas não são revogadas por essa operação. |
| Autenticação web (RF02)                                             | Em andamento | Tela `/login` e gestão de sessão (`AuthContext` e `web/src/services/auth.ts`) integradas a `/api/v1/auth/login` e `/api/v1/auth/logout`, com testes em `web/src/pages/login/login.test.tsx`.                                                                                                                                                                                                                                                                                                                                                                                        |
| Controle de acesso web/API (RF03)                                   | Em andamento | Autorização por perfil no backend (`@PreAuthorize` em `StudyController` e `UserController`) e proteção de rotas/menu por perfil na web (`ProtectedRoute`, `ForbiddenPage` e filtro de navegação em `web/src/config/navigation.tsx`).                                                                                                                                                                                                                                                                                                                                                |
| Gestão de estudos (RF04)                                            | Em andamento | Interface web com listagem, busca, filtro por status, indicadores, cadastro e edição usando dados mock locais. Build validada com `npm --prefix web run build`; integração REST pendente.                                                                                                                                                                                                                                                                                                                                                                                           |
| Protótipos web de painel, recrutamento, visitas e relatórios (T7.2) | Em andamento | Telas navegáveis com dados mock locais e modais interativos em `/dashboard`, `/recrutamento`, `/visitas` e `/relatorios`, com testes em `web/src/pages/prototipos.test.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                        |
| Recrutamento e inclusão (RF05 a RF11)                               | Pendente     | Planejado para a Sprint 2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Cliente HTTP da web

A base web possui rotas com React Router, layout compartilhado e um cliente HTTP em `web/src/services/api/apiClient.ts`. Em desenvolvimento, o proxy do Vite encaminha chamadas `/api` para o backend em `http://localhost:8080`; se necessário, configure `VITE_API_BASE_URL` em `web/.env.local` para apontar para outro servidor. A tela de estudos utiliza `web/src/services/estudos.ts` para listar (`GET /api/studies`), cadastrar (`POST /api/studies`) e editar (`PUT /api/studies/{id}`); as operações exigem JWT.

O login e o logout utilizam o mesmo cliente HTTP compartilhado, preservando a gestão de sessão existente. `VITE_API_BASE_URL` representa somente a origem do servidor, sem `/api` ou `/api/v1` (por exemplo, `https://api.exemplo.com`). Os caminhos são informados nas chamadas: autenticação em `/api/v1/auth` e estudos em `/api/studies`, conforme os controllers atuais. O proxy do Vite funciona apenas no desenvolvimento; na implantação, o servidor web precisa encaminhar `/api` ao backend, ou a API em outra origem precisa permitir CORS.

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

Status e quantidade atual de participantes ainda não fazem parte dessa resposta. Por isso, os indicadores, o filtro e a coluna de status estão ocultos, e a tabela mostra somente o limite de participantes, sem calcular ocupação nem assumir uma contagem igual a zero. A validação do limite contra participantes já alocados depende de suporte do backend. O formulário só fecha e a tabela só é atualizada após sucesso da API; erros mantêm os dados digitados disponíveis para correção.

## Testes de componentes de estudos (Task 3148)

Os testes usam Vitest, React Testing Library e jsdom, com requisições HTTP e notificações de sucesso simuladas. Os componentes de busca, tabela, modal e calendário do HeroUI são exercitados diretamente.

| Arquivo                                                  | Cenários cobertos                                                                                                                                                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/src/components/estudos/BuscaFiltroEstudos.test.tsx` | Busca controlada, digitação e limpeza pelo callback.                                                                                                                                                            |
| `web/src/components/estudos/TabelaEstudos.test.tsx`      | Responsáveis, limites e períodos, inclusive entre anos diferentes, callback de edição e estado vazio.                                                                                                           |
| `web/src/components/estudos/CampoData.test.tsx`          | Segmentos acessíveis, alteração pelo teclado, bloqueio durante salvamento e erro de validação.                                                                                                                  |
| `web/src/components/estudos/ModalEstudo.test.tsx`        | Campos obrigatórios, normalização dos dados, limites válidos e inválidos, datas iguais, preservação do responsável, cancelamento, bloqueio de envios repetidos, foco nos erros e respostas 401/403.             |
| `web/src/components/estudos/ModalEditarEstudo.test.tsx`  | Contrato REST e preservação do responsável ao editar como o próprio pesquisador ou como outro pesquisador.                                                                                                      |
| `web/src/pages/estudos/listagem.test.tsx`                | Carregamento, estado vazio, busca, cadastro e edição via API com JWT, responsável logado no cadastro, preservação do responsável na edição, cancelamento, falhas de conexão, validações e restrições de acesso. |
| `web/src/pages/estudos/visualizar.test.tsx`              | Navegação da tabela para os detalhes, consulta por ID, retorno à listagem, edição, cancelamento de consultas pendentes, identificadores inválidos, respostas 401/403/404 e novas tentativas.                    |

O teste de listagem substitui o campo de data por um campo ISO simples para concentrar os cenários no fluxo da página. O calendário real é verificado nos testes de `CampoData`, `ModalEstudo` e visualização. A execução depende apenas das dependências da web, sem precisar iniciar Docker ou o backend.

Para executar os 54 testes de telas e componentes de estudos:

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

RF01 a RF04 foram verificados com o contrato disponível nesta versão. Entretanto, `StudyRequest`, `StudyResponse` e as migrações atuais ainda não oferecem estado do estudo nem endpoint de transição. **A compatibilidade com RF07 permanece pendente** até essa implementação ser integrada à `development`.

Após a integração de RF07, repetir o cadastro e a edição de estudos, conferindo o estado inicial retornado pela API e que a alteração de título, objetivo, datas e limite preserve o estado existente, conforme o contrato acordado. Também repetir a suíte automatizada. Não criar um estado apenas na memória da interface para antecipar essa entrega.

- [x] Fluxos web de RF01 a RF04 verificados com API e banco reais.
- [x] Suítes automatizadas existentes passando e build aprovado.
- [ ] Compatibilidade de cadastro e edição com RF07 validada após integração do contrato de estados.

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
