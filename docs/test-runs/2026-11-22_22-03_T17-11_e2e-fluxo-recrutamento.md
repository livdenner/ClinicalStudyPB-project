# T17.11: E2E do fluxo completo de recrutamento (Playwright)

- **Terminou em:** 2026-11-22 22:03
- **Re-rodada de:** `2026-11-22_21-59_T17-11_e2e-completa.md`
- **Comando:** `npx playwright test e2e/flows/full-recruitment.spec.ts --workers=1` em `web/`, com a stack de [`compose.e2e.yaml`](../../compose.e2e.yaml) e a web compilada servida por `vite preview` com `API_PROXY_TARGET=http://localhost:18080`
- **Base:** branch `test/t17-11-e2e-fluxo-candidato` atualizada com a `development` (`50e5efd`), com o `candidateCard` da lista em cards (T24.3)
- **Duração:** 2,5 min (`stats.duration` do `test-reports/playwright.json`); sem novas tentativas

| Teste | Resultado | Observação |
|---|---|---|
| `flows/full-recruitment.spec.ts › fluxo completo de recrutamento › protocolo, candidato, elegibilidade, aceite do candidato e inclusão` | Passou | 71,7 s. Sem alteração no login: a falha anterior foi lentidão da máquina local |
| `flows/full-recruitment.spec.ts › fluxo completo de recrutamento › recusa do candidato impede a inclusão` | Passou | 63,8 s. Sem alteração no login: a falha anterior foi lentidão da máquina local |
| **Total de testes: 2** | **Passaram: 2 (100,0%); falharam: 0 (0,0%)** | |
