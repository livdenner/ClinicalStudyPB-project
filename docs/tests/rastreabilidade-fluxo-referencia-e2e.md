# Rastreabilidade do E2E do fluxo de referência: RF11, RF12 e RF13 (T19.5)

A suíte [`reference-flow.spec.ts`](../../web/e2e/flows/reference-flow.spec.ts) automatiza o fluxo citado no enunciado como exemplo de E2E: **incluir participante → agendar visita → registrar desfecho**. Roda no Chromium contra o backend e o PostgreSQL reais da stack descartável [`compose.e2e.yaml`](../../compose.e2e.yaml) e não intercepta respostas.

## Ponto de partida e independência

- **Estado inicial pela API:** o estudo em recrutamento, com um candidato que aceitou o termo, é montado em [`e2e/support/reference-flow-api.ts`](../../web/e2e/support/reference-flow-api.ts).
  1. **Pesquisador:** cadastra o estudo, um critério de inclusão, um de exclusão e a visita prevista "Avaliação inicial" com uma atividade, e abre o recrutamento.
  2. **Coordenador:** cadastra o candidato com e-mail novo e registra a elegibilidade `ELIGIBLE`.
  3. **Candidato:** ativa a conta com o código devolvido pelo cadastro, define a senha e aceita o termo (`GRANTED`).
- **Independência:** o spec não reaproveita o E2E do PBI-17 ([`full-recruitment.spec.ts`](../../web/e2e/flows/full-recruitment.spec.ts)) nem os helpers dele.
- **Dados:** cada execução cria estudo, candidato e e-mail fictícios com sufixo único. Não altera os dados da seed e pode ser repetido no mesmo banco.

## Cenários

| Identificador | Cenário | Etapas pela web (cada uma é um `test.step`) | Requisitos |
| --- | --- | --- | --- |
| E2E-REF-01 | `coordenador inclui o participante, agenda a visita e registra que foi realizada` | Em **Recrutamento**, o card do candidato mostra "Aceitou". O coordenador inclui o participante e o card dele aparece no painel de participantes. Pelo botão **Agendar visita** do painel, agenda a "Avaliação inicial" para 20/02/2027 09:00 (Fortaleza), e a agenda mostra "Agendada". Em **Visitas**, registra **Realizada** com confirmação, e o selo passa a "Realizada". Depois de recarregar a página, a situação continua "Realizada" e a ação de desfecho não aparece mais. | RF11, RF12 e RF13 |
| E2E-REF-02 | `agendar a mesma visita duas vezes mostra o erro da API` | O participante foi incluído e a visita foi agendada pela API. Pela web, a mesma visita prevista é agendada de novo. O modal mostra a mensagem da API ("Já existe um agendamento ativo ou concluído desta visita para o participante.", `409 VISIT_ALREADY_SCHEDULED`), continua aberto com os dados e a API segue com um único agendamento. | RF12 |

O fluxo **cadastrar estudo → incluir → agendar** fica demonstrável assim:

- **Cadastro do estudo pela web:** coberto por [`create-study.spec.ts`](../../web/e2e/studies/create-study.spec.ts) e pelo E2E do PBI-17.
- **Inclusão, agendamento e desfecho pela web:** cobertos por esta suíte.
- **Ligação entre as etapas:** o estado inicial cria o estudo pela mesma API que a tela usa.

## Evidências da release

O spec gera uma captura em cada passo:

- **Relatório:** as capturas sempre ficam anexadas ao relatório HTML do Playwright.
- **Pasta da release:** com a variável `E2E_EVIDENCE_DIR`, as capturas também são gravadas em disco. As da execução local registrada abaixo estão em [`releases/release2/evidencias/t19-5-fluxo-referencia`](../../releases/release2/evidencias/t19-5-fluxo-referencia/README.md).

```powershell
cd web
npm run e2e:stack:up
$env:E2E_EVIDENCE_DIR = "$PWD\..\releases\release2\evidencias\t19-5-fluxo-referencia"
npm run test:e2e -- e2e/flows/reference-flow.spec.ts
npm run e2e:stack:down
```

Na CI, o job **E2E Web (Playwright)** roda em todos os PRs e pushes para a `development` e a `main`:

- **Relatório HTML:** com as capturas anexadas, fica no artefato `playwright-report` (`web/playwright-report` e `web/test-results`).
- **JSON:** artefato `resultados-e2e`. Alimenta o registro por teste em [docs/test-ci](../test-ci/README.md).

## Seletores e layout atual

Desde o PR #101 (T24.3), candidatos e participantes aparecem em cards. O spec localiza:

- **Candidato:** o card em `getByRole("list", { name: "Lista de candidatos" }).getByRole("listitem").filter({ hasText: nome })`.
- **Participante incluído:** o título do card em `getByRole("list", { name: "Lista de participantes incluídos" })`.
- **Visitas:** a agenda do participante e a lista de **Visitas** continuam em tabela, então seguem localizadas por `row`.

## Resultado

| Execução | Base | Resultado |
| --- | --- | --- |
| [Local, 23/11/2026 01:11](../test-runs/2026-11-23_01-11_T19-5_e2e-fluxo-referencia.md) | `development` (`008dabb`) + `ea5c423` | Os dois cenários passaram (65,6 s e 13,0 s). As capturas da release foram geradas de novo nesta execução. |
| [CI, E2E Web (Playwright)](../test-ci/pull-requests/108/2026-11-23_00-50_ea5c423.md) | mesmo commit `ea5c423` | Os dois cenários passaram (3,4 s e 2,6 s); 21 de 22 testes E2E passaram. O ignorado é o do PBI-17 (`full-recruitment.spec.ts`), em `test.fixme` até o PR #106 entrar. |
| [Local, 20/11/2026](../test-runs/2026-11-20_02-48_T19-5_e2e-completa.md) | `feat/visit-outcomes-t19-3` (PR #100), antes dos cards | 11 testes passaram em 46 s com `--workers=1`. Os dois cenários desta suíte levaram 8,4 s e 7,0 s. Substituída pelas execuções acima. |
