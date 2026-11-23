# Evidências do fluxo de referência (T19.5)

Capturas geradas pelo E2E [`reference-flow.spec.ts`](../../../../web/e2e/flows/reference-flow.spec.ts) em 23/11/2026, já com candidatos e participantes em cards, na execução local registrada em [`2026-11-23_01-11_T19-5_e2e-fluxo-referencia.md`](../../../../docs/test-runs/2026-11-23_01-11_T19-5_e2e-fluxo-referencia.md). A base é a `development` atual.

- **Ambiente:** backend e PostgreSQL reais da stack [`compose.e2e.yaml`](../../../../compose.e2e.yaml) e Chromium.
- **Dados:** fictícios, criados pelo próprio teste.

A [rastreabilidade](../../../../docs/tests/rastreabilidade-fluxo-referencia-e2e.md) descreve os cenários e como gerar as capturas de novo.

| Captura | Passo | Requisito |
| --- | --- | --- |
| [01-candidato-aceitou.png](01-candidato-aceitou.png) | Em **Recrutamento**, o candidato que aceitou o termo aparece como "Aceitou", com a inclusão disponível. | RF10 e RF11 |
| [02-participante-incluido.png](02-participante-incluido.png) | Inclusão confirmada; o card do participante aparece no painel de vagas. | RF11 |
| [03-agendamento-preenchido.png](03-agendamento-preenchido.png) | Modal **Agendar visita** com a visita prevista e a data no horário de Fortaleza. | RF12 |
| [04-visita-agendada.png](04-visita-agendada.png) | Agenda do participante com a visita "Agendada". | RF12 |
| [05-confirmacao-realizada.png](05-confirmacao-realizada.png) | Confirmação do desfecho **Realizada** em **Visitas**. | RF13 |
| [06-visita-realizada.png](06-visita-realizada.png) | Desfecho registrado; a visita fica "Realizada", sem novas ações. | RF13 |
| [07-agendamento-duplicado.png](07-agendamento-duplicado.png) | Cenário negativo: nova tentativa de agendar a mesma visita mostra o erro da API e mantém o formulário. | RF12 |
