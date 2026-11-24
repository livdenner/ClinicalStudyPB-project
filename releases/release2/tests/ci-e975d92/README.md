# CI do commit final da Sprint 3 (`e975d92`)

[Voltar aos testes da Release 2](../README.md)

Evidências exportadas em 23/11/2026 para a T25.2. O commit avaliado é `development` **e975d92f6866acaa97690c9c7964ead2d7db8bee** (merge do PR #113), a última integração da Sprint 3: em 23/11/2026 não havia PR aberto. A [execução 45287852924](https://github.com/livdenner/ClinicalStudyPB-project/actions/runs/45287852924) da CI, disparada pelo push desse commit, aprovou os quatro jobs e o relatório de execução. Os arquivos desta pasta são cópias dos logs e artefatos dessa execução; os códigos de cor ANSI e o prefixo de job dos logs foram removidos, e os segredos aparecem mascarados (`***`) pelo próprio GitHub Actions.

| Job | Resultado | Testes | Cobertura | Evidência |
| --- | --- | --- | --- | --- |
| Backend (Maven, Checkstyle, JUnit, JaCoCo) | Aprovado; Checkstyle sem violações; "All coverage checks have been met" | **940**, 0 falhas, 0 erros, 0 ignorados, em 48 classes | **97,96% das linhas (1972/2013)**; ramos 87,15% (556/638); instruções 97,22% | [Log](backend-ci.txt), [suítes](backend-suites.csv), [JaCoCo CSV](backend-coverage.csv) |
| Web (ESLint, Vitest, build) | Aprovado | **513** em 47 arquivos | 89,69% das linhas; statements 87,2%; ramos 82,17%; funções 86,12% | [Log](web-ci.txt) |
| E2E Web (Playwright) | Aprovado | **24** contra backend e PostgreSQL reais | Não se aplica | [Log](e2e-ci.txt) |
| Mobile (Jest) | Aprovado | **260** em 23 suítes | 92,66% das linhas; statements 92,67%; ramos 89,07%; funções 97% | [Log](mobile-ci.txt) |
| Relatório de execução dos testes (T25.1) | Aprovado | **1737** no total, todos aprovados, nenhum instável | — | [Relatório teste a teste](relatorio-execucao.md) |

## Cobertura do backend (JaCoCo)

A meta da disciplina é de 80% das linhas do backend. O [`pom.xml`](../../../../backend/pom.xml) faz a CI reprovar o build se a cobertura de linhas ficar abaixo de 80% em qualquer classe, em qualquer pacote ou no conjunto. Ficam fora da medição apenas `ClinicalStudyPBApplication` e as classes `*Configuration` e `*Config`.

| Módulo | Linhas | Ramos |
| --- | --- | --- |
| `auth` | 100,00% (155/155) | 92,86% (39/42) |
| `candidates` | 98,09% (359/366) | 92,06% (116/126) |
| `consent` | 100,00% (158/158) | 92,86% (26/28) |
| `criteria` | 100,00% (46/46) | 100,00% (6/6) |
| `history` | 100,00% (42/42) | Sem ramos |
| `me` | 100,00% (108/108) | 90,00% (18/20) |
| `participants` | 100,00% (147/147) | 100,00% (34/34) |
| `results` | 100,00% (89/89) | 100,00% (22/22) |
| `scheduling` | 99,19% (244/246) | 94,19% (81/86) |
| `shared` | 96,08% (49/51) | 87,50% (14/16) |
| `studies` | 97,14% (238/245) | 86,36% (114/132) |
| `users` | 95,76% (158/165) | 77,78% (28/36) |
| `visits` | 91,79% (179/195) | 64,44% (58/90) |
| **Total** | **97,96% (1972/2013)** | **87,15% (556/638)** |

O [CSV do JaCoCo](backend-coverage.csv) traz os contadores por classe. O relatório HTML completo está no artefato `jacoco-report` da [execução da CI](https://github.com/livdenner/ClinicalStudyPB-project/actions/runs/45287852924), disponível por 90 dias.

## E2E mobile no emulador Android

O workflow [E2E Mobile](../../../../.github/workflows/mobile-e2e.yml) só roda quando `mobile/`, `backend/`, `compose.e2e.yaml` ou o próprio workflow mudam. A última execução na `development` é a [45259947332](https://github.com/livdenner/ClinicalStudyPB-project/actions/runs/45259947332), de 23/11/2026, no commit `90e03b6`: o fluxo "Login do participante e próximas visitas" passou no emulador Android, contra a stack de `compose.e2e.yaml` com a carga padrão. Entre `90e03b6` e `e975d92` não houve alteração nesses caminhos (`git diff 90e03b6 e975d92 -- mobile backend compose.e2e.yaml .github/workflows/mobile-e2e.yml` vazio), então o resultado vale para o commit avaliado. Evidências: [log do job](mobile-e2e-ci.txt) e [JUnit do Maestro](mobile-e2e-maestro.xml). As duas capturas do emulador estão na [galeria](../../images/README.md) como RF18.

## Ambiente da CI

GitHub Actions com Ubuntu, Java 21 (Temurin), Node.js 22 e Docker. O E2E web usa a web compilada (`vite preview`) e a stack de `compose.e2e.yaml`, com banco em memória e credenciais fictícias que só existem nessa stack.
