# T17.11: re-rodada do E2E de sessão por aba

- **Terminou em:** 2026-11-19 23:13
- **Re-rodada de:** `2026-11-19_23-12_T17-11_e2e-completa.md`
- **Comando:** `npx playwright test e2e/auth/tab-session.spec.ts --workers=1` em `web/`, com a mesma stack e o mesmo build

| Teste | Resultado | Observação |
|---|---|---|
| `auth/tab-session.spec.ts › T24.4: admin e coordenador operam em abas do mesmo navegador; logout é isolado` | Passou | Sem alteração: a falha anterior foi lentidão da máquina local no login; o spec não foi modificado pela T17.11 |
| `auth/tab-session.spec.ts › T24.4: expiração e redirecionamento de uma aba preservam a outra` | Passou | |
| **Total de testes: 2** | **Passaram: 2 (100,0%); falharam: 0 (0,0%)** | |
