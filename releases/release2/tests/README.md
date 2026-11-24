# Testes da Release 2

[Voltar à Release 2](../README.md) · [Capturas](../images/README.md)

As evidências ficam separadas por execução, como na [Release 1](../../release1/tests/README.md), para não misturar números de versões diferentes.

| Execução | Commit | O que registra |
| --- | --- | --- |
| [CI do commit final da Sprint 3](ci-e975d92/README.md) | `development` **e975d92** (23/11/2026) | Logs dos quatro jobs da CI, cobertura JaCoCo do backend, suítes JUnit, relatório teste a teste (T25.1) e E2E mobile no emulador Android. |
| [Regressão web de UX e sessão (T24.5)](t24-5/README.md) | `development` até `92b2f4f` | Matriz das observações sobre ações, cores, cards e sessão, com os testes executados. |
| [Fluxo de referência E2E (T19.5)](../evidencias/t19-5-fluxo-referencia/README.md) | Ver o README da evidência | Capturas do E2E Playwright: inclusão, agendamento, desfecho e agendamento duplicado. |

## Resumo da Sprint 3 (`e975d92`)

| Camada | Testes | Cobertura |
| --- | --- | --- |
| Backend: Checkstyle, JUnit, integração PostgreSQL e JaCoCo | **940 aprovados** | **97,96% das linhas (1972/2013)**; meta de 80% atendida |
| Web: Vitest | **513 aprovados** em 47 arquivos | 89,69% das linhas |
| E2E web: navegador, API e PostgreSQL | **24 aprovados** | Não se aplica |
| Mobile: Jest | **260 aprovados** em 23 suítes | 92,66% das linhas |
| E2E mobile: Maestro no emulador Android | **1 fluxo aprovado** (RF02 e RF18) | Não se aplica |

A meta de 80% vale para as linhas do backend e é verificada pela própria CI. O histórico automático de cada execução da CI fica em [docs/test-ci](../../../docs/test-ci/README.md).
