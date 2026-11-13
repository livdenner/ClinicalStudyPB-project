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
