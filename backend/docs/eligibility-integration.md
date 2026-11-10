# Elegibilidade e integração com participantes

A Release 1 já integra avaliação de elegibilidade (T13.1/T13.2) e inclusão de participantes
(T15.1/T15.2). A avaliação usa `GET` e `PUT` na rota
`/api/studies/{studyId}/candidates/{candidateId}/eligibility`, exclusivos de `COORDINATOR`.
A inclusão usa `POST /api/studies/{studyId}/candidates/{candidateId}/inclusion`; a consulta usa
`GET /api/studies/{studyId}/participants` e `GET /api/studies/{studyId}/participants/{participantId}`,
conforme o [contrato OpenAPI](../openapi.yaml).

O PUT substitui o conjunto completo de respostas, exige pelo menos uma e rejeita critérios
duplicados ou de outro estudo. Enquanto existir critério sem resposta, o resultado é `PENDING`.
Com todos respondidos, exige `matches=true` para inclusões e `matches=false` para exclusões.
O autor vem do JWT; `evaluatedAt` usa um relógio UTC injetável. A API retorna somente o instante,
como previsto no contrato; o identificador do autor fica persistido internamente.

## Migrações

- V7: respostas por candidato e critério.
- V8: consentimento simulado.
- V9: autor e instante da última avaliação. O resultado continua em `candidates.eligibility_status`.
- V10: vínculos de participantes usados pela elegibilidade e pela inclusão já implementada.

O Flyway aplica a sequência V1 a V10 em banco novo e somente as versões pendentes em bancos
atualizados pela sequência anterior. As migrações existentes mantêm sua numeração e conteúdo.

## Protocolo transacional da inclusão

1. `ParticipantService` chama `StudyService.lockForCandidateOperations(studyId)` na transação
   de inclusão e bloqueia o candidato com `CandidateService.lockForConsentUpdate`.
2. Confere estudo em recrutamento, elegibilidade, ausência de inclusão anterior e disponibilidade de vaga.
3. Chama `SimulatedConsentService.lockAfterInclusion(studyId, candidateId)` para exigir consentimento
   concedido e impedir alterações posteriores, dentro dessa mesma transação.
4. Persiste `Participant`, incluindo `includedBy` e `includedAt`, na mesma transação dessas validações.

A avaliação já usa esse bloqueio antes de consultar os critérios e `ParticipantLookup`.
A criação de critérios também bloqueia a mesma linha do estudo. Assim, inclusão, avaliação,
mudança de estado e alteração do protocolo são serializadas para o mesmo estudo.
A consulta retorna uma visão consistente com isolamento `REPEATABLE_READ`.

A T13.1 consulta inclusões reais pela existência do vínculo em `participants`. Não há um indicador
de inclusão duplicado no candidato. A chave estrangeira composta impede vincular o candidato a
outro estudo, e a unicidade impede duas inclusões do mesmo candidato.

Os endpoints de inclusão e consulta já estão implementados em `ParticipantController`.
O POST é exclusivo de `COORDINATOR`;
as consultas permitem `RESEARCHER` e `COORDINATOR`. O POST retorna `201` com `Location` e não recebe corpo.
Estudo/candidato inexistente ou candidato de outro estudo retorna `404`; pré-condições de negócio
não atendidas retornam `409`, conforme o contrato atual.

`ParticipantService` valida recrutamento, elegibilidade, duplicidade e capacidade sob o bloqueio
do estudo. Em seguida bloqueia o consentimento concedido e grava o vínculo na mesma transação.
Uma falha de persistência desfaz também o bloqueio do consentimento. A capacidade usa a contagem
real de `participants`; não existe um contador separado de vagas que possa ficar desatualizado.

`IntegratedStudyReadiness` é a implementação principal de `StudyReadiness`: consulta critérios
pelo serviço de critérios e inclusões por `ParticipantLookup`. A execução só começa após uma
inclusão real. O mesmo serviço público de contagem impede reduzir o limite do estudo abaixo da
quantidade já incluída. Nenhuma migração existente precisa ser alterada: a V10 já contém autoria,
instante, unicidade e a chave estrangeira composta necessários à inclusão.

## Validação e testes

Os testes unitários, HTTP e de concorrência de elegibilidade e participantes estão em
[`candidates`](../src/test/java/clinicalstudypb/candidates) e
[`participants`](../src/test/java/clinicalstudypb/participants). Execute `./mvnw verify`
na pasta `backend/` (PowerShell: `.\mvnw.cmd verify`) para verificar a suíte completa,
Checkstyle e o mínimo de 80% de cobertura. Os [resultados da Release 1](../../releases/release1/tests/README.md)
identificam a versão validada e preservam os relatórios.
