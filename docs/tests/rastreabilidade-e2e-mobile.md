# Rastreabilidade do E2E mobile: login e próximas visitas (T23.5)

O fluxo [`login-proximas-visitas.yaml`](../../mobile/e2e/maestro/login-proximas-visitas.yaml) é o primeiro E2E do aplicativo. Ele roda com o [Maestro](../../mobile/README.md#decisão-de-ferramenta-maestro) num emulador Android, com o APK de release instalado, contra o backend e o PostgreSQL reais da stack [`compose.e2e.yaml`](../../compose.e2e.yaml). Não há HTTP simulado.

## Dados e dependências

- **Conta:** `participante@clinicalstudypb.test`, senha `Demo@Clinical2026`, criada por `backend/dev/seed_demo_users.sql`.
- **Visitas:** vêm de `backend/dev/seed_demo_followup.sql` (T26.6), no estudo "Controle glicêmico no diabetes tipo 2":
  - "Acompanhamento de 3 meses", agendada (`SCHEDULED`) para 05/01/2027;
  - "Avaliação inicial", realizada (`DONE`) em 05/10/2026.
- **Seed padrão:** o serviço `seed` de `compose.e2e.yaml` roda os quatro scripts de `backend/dev/`. O fluxo só lê dados, então pode ser repetido no mesmo banco.
- **Rede:** o app usa `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:18080/api`. O build de E2E (`CLINICALSTUDYPB_E2E=1`) libera HTTP sem TLS pelo plugin `mobile/plugins/withE2eCleartextTraffic.js`; os demais builds não mudam.

## Cenário

| Identificador | Fluxo | Etapas | Requisitos |
| --- | --- | --- | --- |
| E2E-MOB-01 | `Login do participante e próximas visitas` | Abre o app sem sessão (`clearState`) e espera a tela de login. Preenche e-mail e senha (`testID` `login-email` e `login-password`) e toca em **Entrar**. Confere a saudação "Olá, Participante!" e o e-mail da conta. Abre **Ver visitas** e confere, em **Próximas**, a visita "Acompanhamento de 3 meses" do estudo de diabetes, sem a "Avaliação inicial". Abre **Histórico** e confere a "Avaliação inicial", sem a visita agendada. Guarda uma captura de cada aba. | RF02, RF18 |

## Execução

Os passos para rodar na máquina local estão no [README mobile](../../mobile/README.md#rodar-localmente). Na CI, o workflow [`mobile-e2e.yml`](../../.github/workflows/mobile-e2e.yml) roda o mesmo fluxo num emulador Android (API 34, x86_64) e publica o JUnit e as capturas no artefato `maestro-report`.

## Resultado

| Execução | Commit | Ambiente | Resultado |
| --- | --- | --- | --- |
| [45101299867](https://github.com/livdenner/ClinicalStudyPB-project/actions/runs/45101299867) | `2cd5fbe` | CI, emulador Android API 34 (x86_64, `google_apis`, perfil `pixel_6`) | **Não passou.** O APK compilou e instalou, e o app abriu no login. O launcher do Android travou e o diálogo "Pixel Launcher isn't responding" cobriu a tela, então a primeira asserção expirou em 30 s. Corrigido em `c2e2c22`: o workflow desliga os diálogos de erro do sistema (`hide_error_dialogs`) e o fluxo toca em **Wait** se o diálogo aparecer. |
| [45102859416](https://github.com/livdenner/ClinicalStudyPB-project/actions/runs/45102859416) | `c2e2c22` | CI | Cancelada antes do fim. O commit automático do relatório de testes chegou ao PR e reiniciou o workflow. Corrigido em `d867a1e`, com `cancel-in-progress: false`. |
| [45103422414](https://github.com/livdenner/ClinicalStudyPB-project/actions/runs/45103422414) | `d20ac74` (código de `c2e2c22`) | CI, emulador Android API 34 | **Passou.** `1/1 Flow Passed in 1m 4s`. JUnit: `Login do participante e próximas visitas`, `status="SUCCESS"`, 64,0 s. Capturas `proximas-visitas.png` e `historico-visitas.png` no artefato `maestro-report`. Job completo: 19 min, incluindo a stack, o build nativo e o emulador. |

Nas capturas, a visita agendada aparece como "05/01/2027 14:00" e a realizada como "05/10/2026 14:00". O emulador da CI usa UTC, e a seed grava 11:00 no horário de Brasília (UTC−3). O fluxo não confere horários, só nomes, abas e estudo.

O Maestro ainda não entra no relatório automático de execução (`scripts/relatorio-testes`, histórico em `docs/test-ci`); o resultado fica neste documento e no artefato `maestro-report` de cada execução.
