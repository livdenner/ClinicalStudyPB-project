# Guia de Contribuição

Este documento define as convenções de código, commits, branches e revisão do ClinicalStudyPB.
As regras de estilo são verificadas automaticamente pelo CI; o que não é automatizável está descrito aqui.

## 1. Convenções de código

### Geral (`.editorconfig`)
UTF-8, quebra de linha LF, indentação de **4 espaços** (2 em YAML/JSON), newline no fim do arquivo e sem espaços sobrando no fim das linhas.

### Web (TypeScript/React) — Prettier + ESLint
- **Prettier** formata o código ([web/.prettierrc](web/.prettierrc)): 4 espaços, aspas duplas, ponto e vírgula, linha de até 100 colunas.
- **ESLint** ([web/eslint.config.js](web/eslint.config.js)) detecta erros e más práticas: `===` obrigatório, `const`/`let` (sem `var`), sem `console.log`, `import type` para tipos, sem variáveis não usadas (prefixe com `_` quando intencional), regras dos React Hooks.
- Nomes: componentes e tipos em `PascalCase`, funções e variáveis em `camelCase`, arquivos de componente com o nome do componente (`FormField.tsx`), testes ao lado do código (`FormField.test.tsx`).

```bash
cd web
npm run format        # formata o código
npm run format:check  # só verifica (usado no CI)
npm run lint
```

#### Testes E2E (Playwright)
Ficam em [web/e2e](web/e2e) e rodam no navegador contra backend e PostgreSQL reais, numa stack descartável ([compose.e2e.yaml](compose.e2e.yaml)) separada do ambiente de desenvolvimento: outro projeto Docker, banco em memória recriado a cada `up` e backend na porta 18080. Os testes usam as contas de demonstração do seed e criam os próprios dados. A stack também carrega os estudos de demonstração e seus dados de recrutamento (`backend/dev/seed_demo_studies.sql` e `backend/dev/seed_demo_recruitment.sql`). Um teste pode lê-los, mas não deve alterá-los, porque o banco é compartilhado por todos os testes da execução. No CI, o job E2E roda em todos os PRs e pushes para a `development` e a `main`.

```bash
cd web
npx playwright install chromium   # só na primeira vez
npm run e2e:stack:up              # sobe banco + backend de teste e carrega as contas de demonstração
npm run test:e2e                  # compila a web e roda os testes (relatório: npm run test:e2e:report)
npm run e2e:stack:down            # remove a stack (e os dados de teste)
```

### Backend (Java 21 / Spring Boot) — Checkstyle
Regras em [backend/checkstyle.xml](backend/checkstyle.xml), executadas na fase `validate` do Maven; qualquer violação falha o build.
- Nomes: pacotes em minúsculas, classes em `PascalCase`, métodos/variáveis em `camelCase`, constantes em `UPPER_SNAKE_CASE`.
- Métodos de teste podem terminar com o ID do critério de aceite separado por `_`, como no plano de testes: `deveRetornar409QuandoEmailDuplicado_CA01_2`.
- Linhas de até 120 colunas, chaves obrigatórias em `if`/`for`/`while`, sem `import *`, sem imports não usados, sem tabs.
- Classes e interfaces públicas devem ter Javadoc (em português, como no restante do projeto).
- Organização em pacotes por módulo e camada: `<modulo>/{api,application,domain,infrastructure}`.

```bash
cd backend
./mvnw checkstyle:check@checkstyle
./mvnw verify   # Checkstyle + testes + cobertura mínima de 80%
```

## 2. Commits

Seguimos o **Conventional Commits**, em português, no imperativo/presente:

```
tipo(escopo opcional): descrição curta em minúsculas, sem ponto final
```

| Tipo | Uso |
|---|---|
| `feat` | nova funcionalidade |
| `fix` | correção de bug |
| `docs` | documentação |
| `test` | criação/ajuste de testes |
| `refactor` | mudança de código sem alterar comportamento |
| `chore` | configuração, dependências, tarefas de manutenção |
| `ci` | pipeline e GitHub Actions |
| `build` | build, Docker, Maven, Vite |

Escopos usuais: `web`, `backend`, `mobile`. Exemplos reais do projeto: `feat: implementa API de usuários`, `feat(web): adiciona componentes base e configuração de testes`.

Regras: um commit por mudança lógica; descrição de até ~72 caracteres; use o corpo do commit para explicar o *porquê* quando não for óbvio; nunca inclua segredos.

## 3. Branches e Pull Requests

- Branches de trabalho saem de `development` e usam `tipo/descricao-curta`: `feat/studies-api`, `fix/login-erro`, `chore/docker-compose`, `ci/github-actions`.
- Todo trabalho entra por **Pull Request** para `development`; `main` recebe apenas versões estáveis (releases).
- O PR deve preencher o [template](.github/PULL_REQUEST_TEMPLATE.md) e referenciar o PBI/tarefa da Sprint.
- Mantenha PRs pequenos e focados em uma tarefa (idealmente menos de ~400 linhas alteradas).
- Não faça push direto em `development` nem `main`.

## 4. Revisão de código

**Para integrar um PR é necessário:**
1. CI verde (Checkstyle/ESLint/Prettier, testes e cobertura).
2. Pelo menos **1 aprovação** de outra pessoa da equipe (nunca autoaprovação).
3. Todos os comentários resolvidos.
4. Merge feito pelo autor após a aprovação.

**Checklist do revisor:**
- [ ] O código atende aos critérios de aceite da tarefa?
- [ ] Está legível, com nomes claros e sem duplicação desnecessária?
- [ ] Há testes para o comportamento novo e para os casos de erro?
- [ ] Tratamento de erros e validação de entrada adequados?
- [ ] Sem segredos, credenciais ou dados pessoais reais?
- [ ] Documentação (Javadoc, OpenAPI, README) atualizada quando necessário?

**Boas práticas:** revise em até 1 dia útil; comente o código, não a pessoa; diferencie o que é bloqueante do que é sugestão (prefixo `nit:` para detalhes opcionais); o autor responde a cada comentário.

> Recomendação ao administrador do repositório: ativar *branch protection* em `main` e `development` exigindo PR, 1 aprovação e os checks do CI.

## Cores da interface

Na web, use os tokens de `web/src/styles.css`, sem repetir valores de cor nas telas. Tokens terminados em `-soft` são fundos; combine-os com o token principal de texto da mesma família.

| Significado | Token de texto | Fundo | Exemplos |
|---|---|---|---|
| Sucesso ou etapa concluída | `--color-success` | `--color-success-soft` | Salvo com sucesso, Elegível, Aceito, Incluído, visita realizada |
| Erro ou cancelamento | `--color-error` | `--color-error-soft` | Falha ao salvar, Cancelado |
| Atenção ou pendência | `--color-warning` | `--color-warning-soft` | Avaliação pendente, consentimento pendente, limite de vagas atingido |
| Informação | `--color-info` | `--color-info-soft` | Ativo, vagas disponíveis, acompanhamento |
| Neutro | `--color-neutral` | `--color-neutral-soft` | Perfis de acesso, Inativo, Recusado, Inelegível, Agendado, Retirado |

### Estados dos estudos

Reutilize `ESTADOS_ESTUDO` e `SeloEstadoEstudo`, inclusive no recrutamento e nos resumos. Não mantenha uma tabela paralela de cores por tela. Os protótipos acessíveis seguem a mesma tabela, com correspondência explícita de rótulos; um rótulo desconhecido recebe estilo neutro.

| Estado | Aparência | Ícone |
|---|---|---|
| Planejamento | Branco com contorno cinza; texto neutro | Lápis |
| Recrutamento | Roxo: `--color-study-recruitment` e `-soft` | Pessoa com sinal de adicionar |
| Em execução | Azul: `--color-study-execution` e `-soft` | Reprodução em círculo |
| Encerrado | Cinza: `--color-study-closed` e `-soft` | Cadeado |
| Cancelado | Vermelho de erro/cancelamento | X em círculo |

Encerrado não significa que o sistema comprovou a conclusão de todas as atividades; por isso permanece cinza. As cores não alteram regras de negócio.

### Ações e identidade

Botões comuns usam a primária escura (`--color-primary`) ou estilos neutros. Botões de criação usam `button--create`: fundo branco, contorno e texto azuis, hover azul suave e foco visível. Não use verde de sucesso para destacar uma ação comum.

O verde-petróleo da marca (`--color-brand`) é usado na navegação selecionada, edição e foco, separado dos tokens de sucesso. Botões de criação usam contorno azul; verde de sucesso fica reservado a resultados e etapas concluídas.

### Contraste e outras plataformas

Texto comum exige contraste mínimo de 4,5:1 com o fundo; confira também hover, foco, mensagens e texto secundário. Mantenha o nome do estado visível e use ícones como apoio, sem depender apenas da cor. Disponibilidade de vagas não é sucesso; atingir a capacidade é atenção, não erro.

Esta entrega cobre a web e este guia. A frente Mobile é responsável por criar tokens nativos equivalentes e aplicar a mesma tabela nas telas do aplicativo. O guia é a referência de alinhamento; esta task não modifica nem declara validada a implementação mobile.
