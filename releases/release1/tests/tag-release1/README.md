# Execução na tag `release1`

[Voltar aos testes da Release 1](../README.md)

Execução feita em 18/11/2026 (America/Fortaleza) para a T26.1, sobre uma cópia limpa do commit da tag: `main` **8e88d15d04da4113d7dd7cdd901278b8467b6300**. Ambiente: Windows 11, Java 21.0.7, Node.js 24.19.0, npm 11.17.0, Docker 29.9.2. Cada camada rodou sozinha, uma depois da outra. Os caminhos locais da máquina foram trocados por `<worktree>`, `<maven-repo>` e `<home>` nos logs.

| Camada | Comandos | Resultado | Cobertura de linhas | Evidência |
| --- | --- | --- | --- | --- |
| Backend | `./mvnw -ntp clean verify` | **487 testes**, 0 falhas, 0 erros, 0 ignorados; Checkstyle sem violações; regras JaCoCo atendidas | **97,27% (891/916)**; ramos 81,07% (227/280) | [Log](backend-verify.txt), [suítes](backend-suites.csv), [CSV JaCoCo](backend-coverage.csv) |
| Web | `npm ci`, `npm run test:coverage -- --maxWorkers=1` | **25 arquivos, 200 testes** aprovados | **86,75% (1421/1638)**; ramos 78,28% (1215/1552) | [Log](web-tests.txt) |
| Web — qualidade e build | `npm run format:check`, `npm run lint`, `npm run build` | Aprovados | Não se aplica | [Log](web-quality-build.txt) |
| E2E | `npx playwright install chromium`, `npm run e2e:stack:up`, `npm run test:e2e`, `npm run e2e:stack:down` | **8 testes** aprovados contra backend e PostgreSQL reais, incluindo o fluxo completo | Não se aplica | [Log](e2e-tests.txt) |
| Mobile | `npm ci`, `npm test -- --ci --coverage` | **2 suítes, 2 testes** aprovados | **76,47%**; ramos 58,06% | [Log](mobile-tests.txt) |

A [CI do commit da tag](https://github.com/livdenner/ClinicalStudyPB-project/actions/runs/42758428358), de 10/11/2026, também aprovou os quatro jobs. A CI usa Node.js 22; esta execução local usou Node.js 24.
