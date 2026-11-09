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
- V8, já integrada à `development`: consentimento simulado.
- V9: autor e instante da última avaliação. O resultado continua em `candidates.eligibility_status`.
- V10: estrutura compartilhada de participantes, consultada pela elegibilidade e reutilizada na T15.1.

**Ordem de integração:** a atualização da T13.1 com a `development` inclui a V8 antes das V9/V10.
O Flyway aplica a sequência V1 a V10 em banco novo e somente as versões pendentes em bancos
atualizados pela sequência anterior. As migrações existentes mantêm sua numeração e conteúdo.

## Protocolo transacional para T15.1

1. A inclusão deve chamar `StudyService.lockForCandidateOperations(studyId)` dentro de sua transação.
2. Após obter o bloqueio, validar candidato, estudo em recrutamento, elegibilidade, consentimento,
   ausência de inclusão anterior e disponibilidade de vaga.
3. Chamar `SimulatedConsentService.lockAfterInclusion(studyId, candidateId)` para impedir alterações
   posteriores do consentimento, dentro dessa mesma transação.
4. Persistir `Participant`, incluindo `includedBy` e `includedAt`, na mesma transação dessas validações.

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

Os testes unitários, HTTP e de concorrência da T13.2 foram integrados à branch da T13.1.
Executar `./mvnw clean verify` para verificar a suíte completa, Checkstyle e o mínimo de 80%
de cobertura.
