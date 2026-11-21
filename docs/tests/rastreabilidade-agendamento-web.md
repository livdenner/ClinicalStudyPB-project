# Rastreabilidade dos testes Web de agendamento — RF12 / T18.5

Os cenários usam Vitest e Testing Library, com `fetch` simulado e fixtures fictícias. Nenhum teste desta matriz chama API real ou depende de Docker. A tarefa T18.5 complementa a implementação T18.4 na mesma branch e PR. Autoria: Lívia.

## Formulário de agendamento

Suíte: [`ModalAgendarVisita.test.tsx`](../../web/src/components/visitas/ModalAgendarVisita.test.tsx).

| Identificador         | Regra de interface verificada                                                             |
| --------------------- | ----------------------------------------------------------------------------------------- |
| RF12-AG01             | Campos obrigatórios impedem envio e identificam os controles inválidos.                   |
| RF12-AG02             | O envio contém a visita prevista e o instante ISO correspondente ao horário de Fortaleza. |
| RF12-AG03 (400 e 409) | A mensagem da API é apresentada literalmente.                                             |
| RF12-AG04             | Conflito preserva o formulário, a visita selecionada e a data/hora.                       |
| RF12-AG05             | Erros de campo recebidos da API ficam associados aos respectivos controles.               |
| RF12-AG06             | A consulta de visitas previstas pode ser repetida após uma falha.                         |
| RF12-AG07             | Ausência de visitas previstas bloqueia o envio.                                           |
| RF12-AG08             | Condição de agendamento indisponível bloqueia o formulário.                               |
| RF12-AG09             | Confirmação pendente bloqueia envio duplicado e fechamento.                               |
| RF12-AG10             | Cancelar fecha sem enviar o agendamento.                                                  |
| RF12-AG11             | Falha inesperada mantém os dados e permite nova tentativa.                                |

## Agenda do participante

Suíte: [`VisitasParticipante.test.tsx`](../../web/src/components/visitas/VisitasParticipante.test.tsx).

| Identificador                             | Regra de interface verificada                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| RF12-AP01                                 | O POST usa estudo e participante corretos, JSON de agendamento e token.               |
| RF12-AP02                                 | O registro criado aparece na lista existente em ordem cronológica, sem nova consulta. |
| RF12-AP03                                 | O filtro apresenta somente visitas da situação selecionada.                           |
| RF12-AP04                                 | Um filtro anterior não esconde o agendamento recém-criado.                            |
| RF12-AP05 (409 / VISIT_ALREADY_SCHEDULED) | Duplicidade exibe a mensagem literal, mantém os campos e não insere registro.         |
| RF12-AP05 (400 / VISIT_DATE_NOT_FUTURE)   | Data passada exibe a mensagem literal, mantém os campos e não insere registro.        |
| RF12-AP06                                 | Participante retirado mantém consulta, sem ação nem formulário de agendamento.        |
| RF12-AP07                                 | Pesquisador consulta a agenda sem ação de criação.                                    |
| RF12-AP08 (PLANNING, CLOSED e CANCELLED)  | O estudo não oferece agendamento nesses estados.                                      |
| RF12-AP09                                 | Coordenador também pode agendar durante EXECUTION.                                    |
| RF12-AP10                                 | Erro da consulta é literal e permite nova tentativa.                                  |
| RF12-AP11                                 | Atualizar apresenta a nova situação recebida da API.                                  |
| RF12-AP12                                 | Carregamento da agenda bloqueia o início de agendamento.                              |
| RF12-AP13                                 | Voltar retorna ao painel de participantes.                                            |

## Lista e painel de participantes

Suítes: [`ListaVisitasAgendadas.test.tsx`](../../web/src/components/visitas/ListaVisitasAgendadas.test.tsx) e [`PainelParticipantesVagas.test.tsx`](../../web/src/components/candidatos/PainelParticipantesVagas.test.tsx). Os cenários RF11 existentes do painel foram preservados.

| Identificador                                   | Regra de interface verificada                                       |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| RF12-LS01                                       | Lista vazia apresenta orientação.                                   |
| RF12-LS02 (SCHEDULED, DONE, ABSENT e CANCELLED) | O selo corresponde à situação retornada pela API.                   |
| RF12-LS03                                       | Instante UTC é exibido no horário de Fortaleza.                     |
| RF12-PV01                                       | A ação de agendamento seleciona o participante ativo correto.       |
| RF12-PV02                                       | Retirado não recebe ação de agendar e mantém consulta do histórico. |
| RF12-PV03                                       | Ausência de autorização deixa somente a consulta.                   |

## Cobertura e execução

`web/vite.config.ts` exige **81% de linhas por arquivo** para `ModalAgendarVisita.tsx`, `VisitasParticipante.tsx` e `ListaVisitasAgendadas.tsx`. Essa verificação é executada pelo comando da CI, `npm run test:coverage`; a meta individual não depende da média global. As fixtures de `src/test/` são suporte exclusivo dos testes e ficam fora da instrumentação.

```powershell
cd web
npm run test:coverage -- --maxWorkers=2
```

O JSON de resultados em `web/test-reports/vitest.json` alimenta os relatórios do [PBI-25](../test-ci/README.md). A cobertura resumida fica em `web/coverage/coverage-summary.json` e o HTML em `web/coverage/index.html`. As execuções locais são registradas em [docs/test-runs](../test-runs/README.md).

### Resultado local da T18.5

A [execução completa final](../test-runs/2026-11-18_23-47_T18-5_web-completa-rerodada.md), sobre a base `7278938` com as alterações locais da T18.5, aprovou **301 testes em 31 arquivos**, incluindo **37 novos casos**. A cobertura foi lida de `coverage-summary.json`:

| Componente                  | Linhas cobertas / total | Cobertura de linhas |
| --------------------------- | ----------------------- | ------------------- |
| `ModalAgendarVisita.tsx`    | 61 / 63                 | 96,82%              |
| `VisitasParticipante.tsx`   | 41 / 44                 | 93,18%              |
| `ListaVisitasAgendadas.tsx` | 6 / 6                   | 100%                |

A [primeira execução completa](../test-runs/2026-11-18_23-39_T18-5_web-completa.md) foi preservada com a falha de sincronização do teste RF12-AP04. O teste passou a aguardar a grade e a linha acessíveis após o fechamento do modal; a [re-rodada da agenda](../test-runs/2026-11-18_23-40_T18-5_agenda-rerodada.md) e a execução completa final confirmaram a correção. O fluxo da aplicação e os timeouts permaneceram iguais.
