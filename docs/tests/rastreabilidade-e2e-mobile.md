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

| Execução | Ambiente | Resultado |
| --- | --- | --- |
| A registrar | CI (GitHub Actions), emulador Android API 34 | Aguarda a primeira execução do workflow `mobile-e2e.yml` no PR da T23.5. |
