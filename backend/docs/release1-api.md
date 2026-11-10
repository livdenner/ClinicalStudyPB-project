# API da Release 1

[Instalação e Swagger](../../README.md#7-swagger-ui-e-contrato-da-api) · [Contrato OpenAPI](../openapi.yaml) · [Elegibilidade e participantes](eligibility-integration.md)

| RF | Base HTTP | Operações |
| --- | --- | --- |
| RF01 | `/api/users` | GET/POST; GET/PUT `/{id}`; PATCH `/{id}/activation`. Exclusivo de administrador. |
| RF02–RF03 | `/api/auth` | POST `/login` e `/logout`; JWT e autorização nas rotas protegidas. |
| RF04 | `/api/studies` | GET/POST; GET/PUT `/{id}`. Escrita pelo pesquisador responsável. |
| RF05 | `/api/studies/{studyId}/criteria` | GET/POST; tipos `INCLUSION` e `EXCLUSION`. Critérios cadastrados são preservados para auditoria. |
| RF06 | `/api/studies/{studyId}/planned-visits` | Visitas e atividades ordenadas; consultar operações e sub-rotas no OpenAPI. Escritas com `If-Match`. |
| RF07 | `/api/studies/{id}/status` | PATCH com `status`, `expectedStatus` e, no cancelamento, `reason`; GET `/{id}/status-history`. |
| RF08 | `/api/studies/{studyId}/candidates` | GET/POST; GET `/{candidateId}`. Cadastro exclusivo do coordenador em recrutamento. |
| RF09 | `/api/studies/{studyId}/candidates/{candidateId}/eligibility` | GET/PUT da avaliação e respostas. |
| RF10 | `/api/studies/{studyId}/candidates/{candidateId}/consent` | GET/PUT da decisão simulada; exclusivo do coordenador. |
| RF11 | `/api/studies/{studyId}/candidates/{candidateId}/inclusion` | POST sem corpo; GET de participantes em `/api/studies/{studyId}/participants` e `/{participantId}`. |

## Protocolo e estados

O pesquisador responsável edita estudo/protocolo em `PLANNING` e `RECRUITMENT`; estados posteriores bloqueiam alterações. Visitas têm atividades e posições ordenadas. Toda escrita de visita/atividade usa `If-Match: "<version>"`, obtida em GET do estudo. Critérios exigem descrição de até 500 caracteres e não podem ser acrescentados depois de respostas de elegibilidade.

O fluxo principal é `PLANNING → RECRUITMENT → EXECUTION → CLOSED`. Abrir recrutamento exige visita com atividade e critérios de inclusão e exclusão. Iniciar execução exige participante incluído. Há retorno de recrutamento para planejamento e cancelamento com justificativa; a restauração de cancelamento originado em planejamento/recrutamento respeita o histórico. Estado/versão desatualizados e pré-condições ausentes retornam `409`.

## Recrutamento

Candidatos pertencem ao estudo; duplicidade usa nome normalizado e idade no mesmo estudo. O coordenador cadastra e avalia candidatos; o pesquisador responsável pode consultá-los. A avaliação substitui o conjunto anterior de respostas e registra autor/instante. Critério não respondido mantém `PENDING`; com todos respondidos, inclusões verdadeiras e exclusões falsas produzem `ELIGIBLE`; caso contrário, `INELIGIBLE`.

Antes de uma decisão, a consulta de consentimento retorna `PENDING`. O PUT aceita `GRANTED` ou `DECLINED` em recrutamento e registra o horário no servidor. O consentimento é estritamente simulado.

A inclusão exige `RECRUITMENT`, candidato `ELIGIBLE`, consentimento `GRANTED`, ausência de inclusão prévia e vaga disponível. A transação bloqueia estudo/candidato/consentimento, verifica capacidade e grava o participante junto do bloqueio definitivo do consentimento. Falha reverte ambas as gravações. A disputa pela última vaga deve aceitar apenas uma inclusão. Não se permite reduzir o limite abaixo dos participantes incluídos.

## Respostas e segurança

`400`: dados inválidos; `401`: autenticação ausente/inválida; `403`: perfil ou responsável sem permissão; `404`: recurso inexistente ou fora do estudo da rota; `409`: conflito de versão ou regra de negócio. A web apresenta as mensagens retornadas e preserva o formulário após falhas.

Não use credenciais pessoais ou dados de pacientes na demonstração. Os modelos `.env.example` não contêm a chave de assinatura; cada instalação gera sua própria chave.
