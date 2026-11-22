# Rastreabilidade dos testes Web — T17.8, T19.4 e T20.5

Testes com Vitest e Testing Library, fixtures exclusivamente fictícias e HTTP simulado. Os testes que integram telas e serviços interceptam `fetch`; uma rota não declarada falha no mock, sem acessar a rede. Formulários isolados também usam callbacks simulados. Nenhum cenário depende de API real, Docker ou envio de e-mail. Autoria: Lívia.

As três tasks partem da `development` com T17.7, T19.3 e T20.4 integradas. As regras seguem o contrato atual em [`backend/openapi.yaml`](../../backend/openapi.yaml). Esta matriz complementa o relatório de execução do PBI-25; a existência de um caso não significa que sua execução já passou.

## T17.8 — Cadastro, convite e andamento do candidato

Suítes de cadastro: [`ModalNovoCandidato.test.tsx`](../../web/src/components/candidatos/ModalNovoCandidato.test.tsx) e [`ResultadoCadastroCandidato.test.tsx`](../../web/src/components/candidatos/ResultadoCadastroCandidato.test.tsx).

| Identificador | Regra verificada                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------- |
| RF08-C01      | Campos obrigatórios destacados; foco no primeiro inválido; nenhum POST.                           |
| RF08-C02      | E-mail e telefone inválidos, idade fora de 1–130 ou fracionária e limites de texto impedem envio. |
| RF08-C03      | Idades 1 e 130 aceitas; máscara do telefone; normalização e autenticação do payload.              |
| RF08-C04      | Conta existente apresenta vínculo, sem código; permite concluir.                                  |
| RF08-C05      | Mensagens gerais e de campo literais, com dados preservados.                                      |
| RF08-C06      | Cadastro pendente bloqueia envio repetido e fechamento.                                           |
| RF08-C07      | Cancelar ou fechar antes de enviar não cadastra.                                                  |
| RF08-R01      | Código, validade e aviso demonstrativo, sem persistência no navegador.                            |
| RF08-R02      | Cópia exata do código e confirmação.                                                              |
| RF08-R03      | Falha na cópia orienta seleção manual e preserva o código.                                        |
| RF08-R04      | Conta vinculada não apresenta convite nem ação de copiar.                                         |

O consumo de uso único do código no aplicativo é regra do backend/mobile. Os testes de componente Web verificam a apresentação, sem simular uma garantia de ativação real.

Suítes de andamento: [`CardCandidato.test.tsx`](../../web/src/components/candidatos/CardCandidato.test.tsx), [`ConsentimentoSimulado.test.tsx`](../../web/src/components/candidatos/ConsentimentoSimulado.test.tsx), [`AvaliacaoElegibilidade.test.tsx`](../../web/src/components/candidatos/AvaliacaoElegibilidade.test.tsx) e [`recrutamento.test.tsx`](../../web/src/pages/recrutamento/recrutamento.test.tsx).

| Identificador   | Regra verificada                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| RF11-CARD01     | Inclusão bloqueada fora de recrutamento, sem vagas ou com vagas desconhecidas.                       |
| RF08-CARD02     | Todos os sete estados da API têm selo e ações correspondentes.                                       |
| RF11-CARD03     | Elegibilidade pendente/inelegível ou consentimento pendente/recusado não permitem inclusão.          |
| RF08-CARD04     | Ações recebem o candidato correto, sem alterar os dados da API.                                      |
| RF08-CARD05     | Consulta mantém selos sem ações de escrita.                                                          |
| RF10-CARD06     | Recusa final e motivo do cancelamento permanecem visíveis.                                           |
| RF11-CARD07     | Contexto incompleto não presume recrutamento.                                                        |
| RF11-CARD08     | Aceite e elegibilidade isolados não sobrescrevem a situação canônica da candidatura.                 |
| RF10-CS01       | Pendente, aceitou e recusou vêm da API; não há registro/reversão Web nem chamada de consentimento.   |
| RF10-CS02       | Atualizar consulta o aceite registrado no app e só então libera a inclusão.                          |
| RF10-CS03       | Pesquisador consulta a decisão sem controles de escrita.                                             |
| RF09-E01        | Respostas locais completas não antecipam parecer; elegibilidade não registra consentimento.          |
| RF08-P01        | Concluir o convite remove o código da tela e não o persiste em storage.                              |
| RF08-P02        | Filtro de cancelados permanece após atualizar e pode voltar à lista padrão.                          |
| RF08-P03        | Os três conflitos de cancelamento consultam candidato/estudo e bloqueiam nova confirmação.           |
| RF09-P04        | Avaliação elegível recarrega a candidatura sem antecipar o aceite.                                   |
| RF08-P05        | Cancelamento mantém filtro ativo e apresenta o histórico confirmado pela API.                        |
| RF11-IN01       | Confirmação de inclusão também fica desabilitada sem aceite, elegibilidade ou vaga.                  |
| T24.3 existente | Cancelar preserva histórico, remove da lista padrão e permite consultar com `includeCancelled=true`. |

Os demais cenários das suítes existentes foram preservados: inclusão atualiza lista e vagas; recusa/pendência e dados antigos em storage não concedem consentimento; perfis, carregamento, erros e concorrência de cliques continuam cobertos. `ModalConfirmarInclusao.test.tsx` também permanece na suíte e no controle de cobertura.

### Adaptação da suíte legada de consentimento

O arquivo `ConsentimentoSimulado.test.tsx`, removido junto do formulário na T17.7, foi recuperado como suíte adaptada. A implementação antiga e seus endpoints de escrita não foram restaurados.

| Intenção da suíte antiga                              | Cobertura no fluxo atual                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Mostrar pendência e decisão existente                 | RF10-CS01 e estados RF08-CARD02.                                                                                       |
| Registrar aceite/recusa na Web                        | Substituído por ausência de controles e chamadas de consentimento (RF10-CS01); decisão atualizada por GET (RF10-CS02). |
| Restringir escrita por perfil, elegibilidade e estado | RF10-CS03, RF11-CARD01/03/07/08 e testes existentes de recrutamento/inclusão.                                          |
| Tratar falha e permitir voltar                        | Testes existentes de consulta e inclusão preservados; erros de cancelamento na matriz abaixo.                          |
| Atualizar andamento após avaliação                    | RF09-E01 e RF09-P04; consentimento continua independente.                                                              |

Suíte de cancelamento: [`ModalCancelarCandidatura.test.tsx`](../../web/src/components/candidatos/ModalCancelarCandidatura.test.tsx).

| Identificador | Regra verificada                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| OBS-C01       | Motivo vazio, só espaços ou acima de 500 caracteres impede POST.                                                                      |
| OBS-C02       | Limites 1 e 500 aceitos, com remoção de espaços externos.                                                                             |
| OBS-C03       | `CANDIDATE_ALREADY_INCLUDED`, `CANDIDATE_ALREADY_CANCELLED` e `STUDY_NOT_RECRUITING`: mensagem literal, atualização sem repetir POST. |
| OBS-C04       | Recuperação falha bloqueia confirmação; repetir consulta não cancela novamente.                                                       |
| OBS-C05       | Erros de campo literais preservam motivo.                                                                                             |
| OBS-C06       | Candidato incluído/cancelado ou estudo sem permissão bloqueia envio.                                                                  |
| OBS-C07       | Envio pendente impede duplicidade e fechamento.                                                                                       |
| OBS-C08       | Voltar ou fechar não cancela.                                                                                                         |

## T19.4 — Desfechos e lista de visitas

Suítes: [`ModalDesfechoVisita.test.tsx`](../../web/src/components/visitas/ModalDesfechoVisita.test.tsx), [`ListaVisitasAgendadas.test.tsx`](../../web/src/components/visitas/ListaVisitasAgendadas.test.tsx) e [`visitas.test.tsx`](../../web/src/pages/visitas/visitas.test.tsx).

| Identificador | Regra verificada                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------- |
| RF13-D01/02   | Cancelamento exige justificativa não branca de até 500 caracteres.                                |
| RF13-D03      | Cancelamento usa justificativa aparada e `If-Match` da visita.                                    |
| RF13-D04      | Realizada e ausente exigem confirmação explícita.                                                 |
| RF13-D05      | Erros gerais e de campo literais; justificativa preservada.                                       |
| RF13-D06/07   | 409 consulta contexto; falha bloqueia até recuperação, sem repetir gravação.                      |
| RF13-D08      | Visita finalizada passa a consulta e impede novo desfecho.                                        |
| RF13-D09/10   | Envio pendente bloqueia duplicidade; voltar/fechar não grava.                                     |
| RF13-L01      | Ações existem somente em `SCHEDULED`, nunca em `DONE`, `ABSENT` ou `CANCELLED`.                   |
| RF13-L02      | Cada ação encaminha a visita e o desfecho corretos.                                               |
| RF13-P01      | Os três desfechos atualizam selo sem recarga; usa versão da visita diferente da versão do estudo. |
| RF13-P02      | 409 consulta visita e estudo atuais e remove ações quando finalizada.                             |
| RF13-P03      | Filtros de situação/participante chegam à API; item finalizado sai do filtro `SCHEDULED`.         |
| RF13-P04/05   | Estudo encerrado/cancelado e pesquisador mantêm consulta sem ações de desfecho.                   |
| RF13-P06      | Erro literal da listagem permite recuperar consulta.                                              |
| RF13-P07      | Conflito de versão exige confirmação manual e envia a nova versão da visita.                      |

Os cenários RF12 da lista e os limites de cobertura da T18.5 foram preservados.

## T20.5 — Resultados fictícios das atividades

Suítes: [`FormularioResultadoAtividade.test.tsx`](../../web/src/components/visitas/FormularioResultadoAtividade.test.tsx), [`ModalResultadosVisita.test.tsx`](../../web/src/components/visitas/ModalResultadosVisita.test.tsx), lista e página de visitas acima.

| Identificador  | Regra verificada                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------ |
| RF14-F01/02/03 | Resultado obrigatório, máximo de 200 e observação máxima de 500; erro associado ao campo.        |
| RF14-F04       | Limites de 200/500 aceitos.                                                                      |
| RF14-F05       | Limpar observação omite `note` na substituição completa.                                         |
| RF14-F06       | Erros de campo literais com rascunho preservado.                                                 |
| RF14-F07       | Perda de permissão preserva rascunho e distingue o registro persistido.                          |
| RF14-F08/09/10 | Sem duplicidade durante envio; falha preserva valor; consulta não grava.                         |
| RF14-L01/02    | Somente `DONE` oferece resultados; ação diferencia registro e consulta.                          |
| RF14-P01       | Pesquisador responsável vê registro; coordenador vê consulta.                                    |
| RF14-M01       | Um campo por atividade, na ordem do protocolo.                                                   |
| RF14-M02       | HTTP 201 atualiza só a atividade confirmada, com payload e token corretos.                       |
| RF14-M03       | HTTP 200 edita resultado e remove observação omitida.                                            |
| RF14-M04       | Reabrir consulta novamente o resultado persistido.                                               |
| RF14-M05/06/07 | Visita não realizada, perfil/responsável incorretos e estudo encerrado/cancelado impedem edição. |
| RF14-M08       | HTTP 400 literal preserva campos e não grava outra atividade.                                    |
| RF14-M09       | 403/404/409 atualizam contexto sem repetir PUT nem apagar rascunho.                              |
| RF14-M10       | Falha na recuperação bloqueia gravação até atualizar dados.                                      |
| RF14-M11/12    | Consulta com erro pode ser repetida; visita sem atividades não inventa formulário.               |
| RF14-M13       | Envio bloqueia outras atividades e fechamento.                                                   |
| RF14-M14       | Erro continua visível se atividade desaparecer na recuperação.                                   |
| RF14-M15       | Fechar consulta não grava.                                                                       |
| RF14-M16       | Sessão rejeitada mantém rascunho em consulta, sem novas gravações.                               |

## Cobertura e execução

`web/vite.config.ts` exige **81% de linhas por arquivo**, acima dos 80% solicitados, em cadastro, confirmação de cadastro, cancelamento, card/lista de candidatos, confirmação de inclusão, confirmação de desfecho, modal de resultados e formulário por atividade. Os três limites de componentes de agendamento já existentes continuam ativos, incluindo a lista compartilhada de visitas.

Executar em `web/` do worktree desta branch:

```powershell
npm ci
npm run test:coverage -- --maxWorkers=2
npm run lint
npm run build
```

O relatório detalhado é gerado em `web/test-reports/vitest.json`; a cobertura por arquivo, em `web/coverage/coverage-summary.json` e no HTML de cobertura. Registrar cada execução, inclusive falhas, em [`docs/test-runs/`](../test-runs/README.md), conforme a política do projeto. O PBI-25 consome também o relatório JSON da suíte.

**Validação local:** a segunda execução de Vitest passou com 450 testes e nenhuma falha. Todos os 12 componentes controlados atingiram pelo menos 81% de linhas; o menor percentual foi 84,37%, em `ModalConfirmarInclusao.tsx`. As duas rodadas foram registradas em `docs/test-runs/`. O build encontrou um problema de tipagem na fixture de conta ativa, corrigido preservando a forma exata do objeto com `satisfies CandidatoApi`; a usuária confirmou que a nova execução de `npm run build` passou. O resultado de lint ainda não foi confirmado neste registro.
