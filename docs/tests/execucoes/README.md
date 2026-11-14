# Execuções de testes

Registro automático, teste a teste, de cada execução da CI. Cada arquivo reúne backend (JUnit), web (Vitest), E2E (Playwright) e mobile (Jest), com **uma linha por teste**: suíte, teste, resultado, duração e origem. Falhas, testes ignorados e instáveis aparecem destacados no início.

| Histórico | O que registra | Última execução |
| --- | --- | --- |
| [Integrações na `development`](development/README.md) | Uma execução por merge de PR na `development`, com o PR integrado (número, branch e título) | Indicada no topo do índice |
| [Versões na `main`](main/README.md) | Uma execução por push na `main` | Indicada no topo do índice |

O nome de cada arquivo segue `AAAA-MM-DD_HH-mm_<commit>.md`, com data e hora em America/Fortaleza. Os relatórios de PRs ainda em revisão não são versionados. Eles ficam no artefato `relatorio-execucao-testes` e no resumo da execução da CI. Para gerar um relatório localmente, veja o [guia de contribuição](../../../CONTRIBUTING.md#relatório-de-execução-dos-testes).

As rodadas registradas à mão durante o desenvolvimento de cada tarefa ficam em [docs/test-runs](../../test-runs/README.md).
