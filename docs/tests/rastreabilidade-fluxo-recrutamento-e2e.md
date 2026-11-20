# Rastreabilidade do E2E de recrutamento: RF09, RF10 e RF11 (T17.11)

A suíte [`full-recruitment.spec.ts`](../../web/e2e/flows/full-recruitment.spec.ts) mantém válido o E2E completo da Release 1 (T16.7, PR #65) depois que o consentimento passou a ser decidido pelo próprio candidato (T17.4). Os testes rodam no Chromium contra o backend e o PostgreSQL reais da stack descartável [`compose.e2e.yaml`](../../compose.e2e.yaml) e não interceptam respostas.

## Dados e dependências

- **Contas:** pesquisador e coordenador são as contas fictícias do seed (`backend/dev/seed_demo_users.sql`).
- **Dados criados pelo teste:** estudo, candidato e e-mail são fictícios e levam um sufixo único por execução (`candidata.e2e.<cenário>.<sufixo>@exemplo.test`). Assim o teste pode ser repetido no mesmo banco, e os dados de demonstração não são alterados.
- **E-mail real:** não é usado. O código de ativação é lido da resposta `201` de `POST /api/studies/{studyId}/candidates`, a mesma que a tela do coordenador exibe como recurso de demonstração. O teste também confere que a tela mostra esse mesmo código. Por isso não foi preciso ler o banco nem criar um endpoint de teste.
- **Ações do candidato:** feitas pela API, em [`e2e/support/candidate-api.ts`](../../web/e2e/support/candidate-api.ts):
  1. `POST /api/auth/activation`;
  2. `PUT /api/auth/password`;
  3. `GET /api/me/invitations?status=CONSENT_PENDING`;
  4. `POST /api/me/invitations/{candidateId}/decision`.

## Cenários

| Identificador | Cenário | Etapas (cada uma é um `test.step` no relatório) | Requisitos |
| --- | --- | --- | --- |
| E2E-REC-01 | `protocolo, candidato, elegibilidade, aceite do candidato e inclusão` | Pesquisador cadastra o estudo, os critérios e a visita prevista e abre o recrutamento. Coordenador cadastra o candidato com e-mail novo, recebe o convite com o código e avalia a elegibilidade. O candidato ativa a conta e aceita o termo; uma segunda decisão responde `409 CONSENT_ALREADY_DECIDED`. O coordenador vê o aceite, inclui o participante e o contador de vagas é atualizado. Os dados persistem num contexto novo. | RF04–RF06, RF08–RF11 |
| E2E-REC-02 | `recusa do candidato impede a inclusão` | Mesmo protocolo, cadastro e elegibilidade. O candidato ativa a conta e recusa o termo; a recusa é definitiva (`409 CONSENT_ALREADY_DECIDED`). A tela mostra a recusa e não oferece a inclusão habilitada. Uma inclusão direta pela API responde `409` e o estudo continua sem participantes. | RF10, RF11 |

O fluxo **protocolo → candidato → elegibilidade → consentimento → inclusão** fica coberto pelo E2E-REC-01. O E2E-REC-02 cobre a regra negativa de que a recusa bloqueia a inclusão, na tela e na API.

Os seletores da tabela de candidatos aceitam tanto a versão atual da `development` quanto a do PR #96 (T17.7):

- **Aceite e recusa:** as asserções usam `/Aceit/` e `/Recus/`, que aceitam os dois rótulos ("Aceito"/"Aceitou" e "Recusado"/"Recusou").
- **Botão de inclusão:** a ausência é conferida como "nenhum botão `Incluir participante` habilitado". A asserção passa tanto com o botão desabilitado quanto sem o botão.

## Execução e relatório

```powershell
cd web
npm run e2e:stack:up
npm run test:e2e -- e2e/flows/full-recruitment.spec.ts
npm run e2e:stack:down
```

Na CI, o job **E2E Web (Playwright)** roda em todos os PRs e pushes para a `development` e a `main`:

- **Relatório HTML:** `web/playwright-report`, com capturas e traces de `web/test-results`. Fica anexado como artefato `playwright-report`.
- **JSON:** `web/test-reports/playwright.json`, artefato `resultados-e2e`. Alimenta o registro por teste em [docs/test-ci](../test-ci/README.md).

O limite da tarefa é manter o E2E completo abaixo de 5 minutos. Antes desta alteração, `npm run test:e2e` levava cerca de 18 s na CI.

## Ajustes ao reativar o teste

O teste estava em `test.fixme` desde o PBI-17. Enquanto isso, a tela de estudo mudou, e a montagem do protocolo foi atualizada:

- **Critérios:** o botão passou a ser "Cadastrar critério".
- **Visitas previstas:** o botão passou a ser "Cadastrar visita".
- **Abertura do recrutamento:** passa pelo menu "Alterar estado". A confirmação do recrutamento agora é feita pelo próximo passo que o menu oferece, "Iniciar execução".

O spec usa `expect` com 15 s, em vez dos 5 s padrão, porque o fluxo tem várias gravações e animações de modal.

## Resultado local

| Execução | Resultado |
| --- | --- |
| [Suíte completa](../test-runs/2026-11-19_23-12_T17-11_e2e-completa.md) | 10 de 11 testes passaram em 1,9 min com `--workers=1`, sem novas tentativas. Os dois cenários desta suíte passaram (33,7 s e 22,0 s). |
| [Re-rodada do `tab-session.spec.ts`](../test-runs/2026-11-19_23-13_T17-11_tab-session-rerodada.md) | O único teste que falhou na suíte completa passou sem alteração. A falha foi lentidão do login na máquina local. |

Os dois cenários também passaram com o `web/src` do PR #96 aplicado localmente. Isso confirma os seletores compatíveis descritos acima.
