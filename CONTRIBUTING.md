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

### Backend (Java 21 / Spring Boot) — Checkstyle
Regras em [backend/checkstyle.xml](backend/checkstyle.xml), executadas na fase `validate` do Maven; qualquer violação falha o build.
- Nomes: pacotes em minúsculas, classes em `PascalCase`, métodos/variáveis em `camelCase`, constantes em `UPPER_SNAKE_CASE`.
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
