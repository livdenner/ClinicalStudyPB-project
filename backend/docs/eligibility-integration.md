# Elegibilidade e integração com participantes

A T13.1 implementa `GET` e `PUT /api/studies/{studyId}/candidates/{candidateId}/eligibility`,
exclusivos de `COORDINATOR`, conforme `backend/openapi.yaml`.

O PUT substitui o conjunto completo de respostas, exige pelo menos uma e rejeita critérios
duplicados ou de outro estudo. Enquanto existir critério sem resposta, o resultado é `PENDING`.
Com todos respondidos, exige `matches=true` para inclusões e `matches=false` para exclusões.
O autor vem do JWT; `evaluatedAt` usa um relógio UTC injetável. A API retorna somente o instante,
como previsto no contrato; o identificador do autor fica persistido internamente.

## Migrações

- V7, já integrada pela T9.1: respostas por candidato e critério; deve permanecer inalterada.
- V8, publicada na branch `feat/consent-rf10-t14-1-t14-2`: consentimento simulado.
- V9: autor e instante da última avaliação. O resultado continua em `candidates.eligibility_status`.
- V10: estrutura compartilhada de participantes, consultada pela elegibilidade e reutilizada na T15.1.

**Ordem de integração:** integrar a V8 de consentimento antes da PR com V9/V10.
Se a ordem das PRs precisar mudar, alinhar as versões com o responsável pelo consentimento antes
de aplicar novas migrações em bancos persistentes. Não alterar migrações já aplicadas nem habilitar
`outOfOrder` para contornar a ordem. Em banco novo, a branch da T13.1 aplica suas migrações sem
depender de tabelas do consentimento.

## Protocolo transacional para T15.1

1. A inclusão deve chamar `StudyService.lockForCandidateOperations(studyId)` dentro de sua transação.
2. Após obter o bloqueio, validar candidato, estudo em recrutamento, elegibilidade, consentimento,
   ausência de inclusão anterior e disponibilidade de vaga.
3. Persistir `Participant`, incluindo `includedBy` e `includedAt`, na mesma transação dessas validações.

A avaliação já usa esse bloqueio antes de consultar os critérios e `ParticipantLookup`.
A criação de critérios também bloqueia a mesma linha do estudo. Assim, inclusão, avaliação,
mudança de estado e alteração do protocolo são serializadas para o mesmo estudo.
A consulta retorna uma visão consistente com isolamento `REPEATABLE_READ`.

A T13.1 consulta inclusões reais pela existência do vínculo em `participants`. Não há um indicador
de inclusão duplicado no candidato. A chave estrangeira composta impede vincular o candidato a
outro estudo, e a unicidade impede duas inclusões do mesmo candidato.

Endpoints, regras de consentimento/capacidade e a integração da prontidão para `EXECUTION`
continuam sendo responsabilidade da T15.1. Esta preparação não expõe uma API de inclusão.

## Validação e testes

Os novos testes automatizados de elegibilidade ficam na task própria, em branch separada.
Executar `./mvnw clean verify` para verificar a suíte existente, Checkstyle e o mínimo de 80%
de cobertura. A expansão do código de negócio pode exigir a integração da task de testes para
atender novamente ao mínimo; a configuração de cobertura não deve ser reduzida ou ignorada.
