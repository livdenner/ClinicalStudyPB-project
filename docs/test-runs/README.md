# Registro das execuções de testes

Crie **um arquivo Markdown para cada execução**, inclusive quando ela falhar. Use o nome
`AAAA-MM-DD_HH-MM_tarefa_escopo.md`, com a data e a hora em que a execução terminou.
Se repetir o mesmo comando, crie outro arquivo.

Liste cada caso de teste executado em uma linha. Use o nome completo que aparece no
relatório Surefire e marque `Passou` ou `Não passou`. Se a aplicação não iniciar e os
testes não chegarem a executar, marque os casos afetados como `Não passou`.

Ao fim da tabela, informe o total e os percentuais. Conte falhas e erros em
`Não passou`. Calcule cada percentual sobre o total de casos registrados.

Para cada execução, use o seguinte formato:

```md
- **Terminou em:** AAAA-MM-DD HH:MM
- **Re-rodada de:** `AAAA-MM-DD_HH-MM_escopo.md` (se aplicável)

| Teste | Resultado | Observação |
|---|---|---|
| `ClasseTeste.primeiroCaso` | Passou | |
| `ClasseTeste.segundoCaso` | Não passou | Falha: <causa curta> |
| `ClasseTeste.terceiroCaso` | Passou | Corrigido: <o que foi feito> |
| **Total de testes: 3** | **Passaram: 2 (66,7%); falharam: 1 (33,3%)** | |
```

## Regras da coluna Observação

1. Deixe a coluna **vazia** quando é a primeira execução e o teste passou.
2. Quando o teste **falhar**, registre apenas a causa curta (ex.: `Falha: NPE em
   CandidateService.validateAge` ou `Erro: banco fora do ar`). O log e os XMLs do
   Surefire já guardam o detalhe.
3. Quando uma **re-rodada** passar em um teste que havia falhado, anote na linha do
   teste o que foi feito (ex.: `Corrigido: normalizava email depois de consultar o
   repositório`). Como cada arquivo novo traz a data/hora no nome e o campo
   **Re-rodada de**, a cadeia fica rastreável.

Use o log da execução e os arquivos `backend/target/surefire-reports/TEST-*.xml`
para conferir os nomes e resultados antes de registrar a rodada. Esses relatórios
são substituídos em execuções posteriores; registre a tabela antes de rodar novamente.
