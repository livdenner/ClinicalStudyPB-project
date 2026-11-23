# T19.5: E2E do fluxo de referência após atualizar com a development (Playwright)

- **Terminou em:** 2026-11-23 01:11
- **Comando:** `npx playwright test e2e/flows/reference-flow.spec.ts --workers=1` em `web/`, com `E2E_EVIDENCE_DIR` apontando para `releases/release2/evidencias/t19-5-fluxo-referencia`. A stack é a de [`compose.e2e.yaml`](../../compose.e2e.yaml), reconstruída com esta base e com a seed padrão, e a web compilada é servida por `vite preview` com `API_PROXY_TARGET=http://localhost:18080`.
- **Base:** branch `test/t19-5-e2e-fluxo-referencia` atualizada com a `development` (`008dabb`, já com os PRs #99, #100 e #101), commit `ea5c423`, com os seletores de cards
- **Duração:** 1,5 min (`stats.duration` do `test-reports/playwright.json`); execução local, sem novas tentativas

| Teste | Resultado | Observação |
|---|---|---|
| `flows/reference-flow.spec.ts › fluxo de referência: incluir, agendar e registrar desfecho › coordenador inclui o participante, agenda a visita e registra que foi realizada` | Passou | 65,6 s. Candidato localizado pelo card em "Lista de candidatos" e participante pelo card em "Lista de participantes incluídos" |
| `flows/reference-flow.spec.ts › fluxo de referência: incluir, agendar e registrar desfecho › agendar a mesma visita duas vezes mostra o erro da API` | Passou | 13,0 s |
| **Total de testes: 2** | **Passaram: 2 (100,0%); falharam: 0 (0,0%)** | |
