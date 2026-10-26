# Release 1 — Estrutura e recrutamento

**Período previsto:** 13/10 a 09/11/2026  
**Sprints:** Sprint 1 e Sprint 2  
**Status:** em andamento

## Objetivo

Entregar a primeira versão operacional do ClinicalStudyPB para a aplicação web: gestão de usuários, autenticação e controle de acesso, cadastro de estudos e início do recrutamento. A release também prepara a base técnica compartilhada com o aplicativo mobile.

## Escopo planejado

| Sprint | Requisitos e entregas planejadas |
| --- | --- |
| Sprint 1 | Base técnica; protótipos; RF01 (usuários); recorte web/API de RF02 (autenticação) e RF03 (permissões); RF04 (estudos); estrutura inicial mobile. |
| Sprint 2 | RF05 a RF11: critérios, visitas previstas, estados, candidatos, elegibilidade, consentimento e inclusão de participantes. |

## Funcionalidades e situação

| Item | Situação | Evidência |
| --- | --- | --- |
| Componentes base da web | Em andamento | Formulários, mensagens de erro e layout compartilhado em `web/src/components`. |
| Gestão de usuários (RF01) | Em andamento | A registrar ao término da Sprint 1. |
| Autenticação web (RF02) | Em andamento | Tela `/login` e gestão de sessão (`AuthContext` e `web/src/services/auth.ts`) integradas a `/api/v1/auth/login` e `/api/v1/auth/logout`, com testes em `web/src/pages/login/login.test.tsx`. |
| Controle de acesso web/API (RF03) | Em andamento | Autorização por perfil no backend (`@PreAuthorize` em `StudyController` e `UserController`) e proteção de rotas/menu por perfil na web (`ProtectedRoute`, `ForbiddenPage` e filtro de navegação em `web/src/config/navigation.tsx`). |
| Gestão de estudos (RF04) | Em andamento | Interface web com listagem, busca, filtro por status, indicadores, cadastro e edição usando dados mock locais. Build validada com `npm --prefix web run build`; integração REST pendente. |
| Recrutamento e inclusão (RF05 a RF11) | Pendente | Planejado para a Sprint 2. |

## Cliente HTTP da web

A base web possui rotas com React Router, layout compartilhado e um cliente HTTP em `web/src/services/api/apiClient.ts`. Em desenvolvimento, o proxy do Vite encaminha chamadas `/api` para o backend em `http://localhost:8080`; se necessário, configure `VITE_API_BASE_URL` em `web/.env.local` para apontar para outro servidor. Por exemplo, a listagem atual do backend pode ser chamada com `apiRequest('/api/studies', { token })`; operações protegidas exigem JWT. A tela de estudos continua usando dados mock e ainda não está conectada à API.

O login e o logout utilizam o mesmo cliente HTTP compartilhado, preservando a gestão de sessão existente. `VITE_API_BASE_URL` representa somente a origem do servidor, sem `/api` ou `/api/v1` (por exemplo, `https://api.exemplo.com`). Os caminhos são informados nas chamadas: autenticação em `/api/v1/auth` e estudos em `/api/studies`, conforme os controllers atuais. O proxy do Vite funciona apenas no desenvolvimento; na implantação, o servidor web precisa encaminhar `/api` ao backend, ou a API em outra origem precisa permitir CORS.

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
