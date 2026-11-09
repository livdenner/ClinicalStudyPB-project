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

A T15.1 completa essa integração com `POST /api/studies/{studyId}/candidates/{candidateId}/inclusion`
e `GET /api/studies/{studyId}/participants[/{participantId}]`. O POST é exclusivo de `COORDINATOR`;
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

Os testes unitários, HTTP e de concorrência da T13.2 foram integrados à branch da T13.1.
Executar `./mvnw clean verify` para verificar a suíte completa, Checkstyle e o mínimo de 80%
de cobertura.
