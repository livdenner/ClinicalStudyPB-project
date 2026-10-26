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

| Item                                  | Situação     | Evidência                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Componentes base da web               | Em andamento | Formulários, mensagens de erro e layout compartilhado em `web/src/components`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Gestão de usuários (RF01)             | Em andamento | Task 3192: rota `/usuarios` com listagem, busca por nome/e-mail, filtros por perfil e situação, cadastro e edição integrados a `/api/users` pelo cliente HTTP compartilhado. Requer sessão de administrador. Senha informada somente no cadastro; edição atualiza nome, e-mail e perfil. O modal de edição possui um interruptor Ativo/Inativo local: a situação só é enviada após salvar e confirmar. Dados são atualizados por `PUT` e situação por `PATCH`; falhas parciais são informadas e permitem tentar novamente. Sessões já emitidas não são revogadas por essa operação. |
| Autenticação web (RF02)               | Em andamento | Tela `/login` e gestão de sessão (`AuthContext` e `web/src/services/auth.ts`) integradas a `/api/v1/auth/login` e `/api/v1/auth/logout`, com testes em `web/src/pages/login/login.test.tsx`.                                                                                                                                                                                                                                                                                                                                                                                        |
| Controle de acesso web/API (RF03)     | Pendente     | A registrar após definição da matriz de permissões.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Gestão de estudos (RF04)              | Em andamento | Interface web com listagem, busca, filtro por status, indicadores, cadastro e edição usando dados mock locais. Build validada com `npm --prefix web run build`; integração REST pendente.                                                                                                                                                                                                                                                                                                                                                                                           |
| Recrutamento e inclusão (RF05 a RF11) | Pendente     | Planejado para a Sprint 2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Cliente HTTP da web

A base web possui rotas com React Router, layout compartilhado e um cliente HTTP em `web/src/services/api/apiClient.ts`. Em desenvolvimento, o proxy do Vite encaminha chamadas `/api` para o backend em `http://localhost:8080`; se necessário, configure `VITE_API_BASE_URL` em `web/.env.local` para apontar para outro servidor. Por exemplo, a listagem atual do backend pode ser chamada com `apiRequest('/api/studies', { token })`; operações protegidas exigem JWT. A tela de estudos continua usando dados mock e ainda não está conectada à API.

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
