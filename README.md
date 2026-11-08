# ClinicalStudyPB-project

## Arquitetura utilizada

### Decisão arquitetural

O sistema será organizado como um **monólito modular em camadas**. O backend será uma única aplicação Java com Spring Boot, dividida em módulos de negócio. Cada módulo separa a interface HTTP, os casos de uso, as regras de domínio e os detalhes de infraestrutura. A aplicação será executada e implantada como uma unidade.

Essa organização atende ao escopo do ClinicalStudyPB e permite que a equipe desenvolva as áreas do sistema com responsabilidades definidas, mantendo uma execução simples para o projeto.

### Aplicações e comunicação

- **Web:** aplicação React com TypeScript, destinada aos perfis de pesquisador, coordenador do estudo e administrador.
- **Mobile:** aplicação React Native com Expo, destinada ao participante.
- **Backend:** aplicação Spring Boot que disponibiliza uma API HTTP REST compartilhada pelas aplicações web e mobile. O [contrato OpenAPI da Release 1](backend/openapi.yaml) inclui os endpoints planejados dos RF05 a RF11; a API em execução expõe apenas o que já foi implementado.
- **Banco de dados:** PostgreSQL, acessado somente pelo backend. As aplicações web e mobile não se conectam diretamente ao banco.

O backend valida as requisições, aplica as regras de negócio, controla as permissões dos perfis e realiza as operações de persistência. As alterações do esquema do banco serão mantidas em migrações Flyway dentro do backend.

### Stack e versões acordadas

| Componente | Tecnologia e versão |
| --- | --- |
| Backend | Java 21 e Spring Boot 3.5.16 |
| Build do backend | Maven 3.9.9, fixado pelo Maven Wrapper (`mvnw` e `mvnw.cmd`) |
| Banco de dados | PostgreSQL 18 |
| Documentação da API | OpenAPI com springdoc-openapi 2.8.17 e Swagger UI |
| Web | React 19.3.1, TypeScript 7.0.2 e Vite 8.3.5; Tailwind CSS 4.3.3, HeroUI 3.2.6 e Lucide React 1.61.0 |
| Mobile | React Native 0.88.0, Expo SDK 58 (`expo ~58.0.19`) e TypeScript ~6.0.3; detalhes de instalação e handoff em [mobile/README.md](mobile/README.md) |

O `backend/pom.xml` declara Java, Spring Boot e springdoc. As versões das demais dependências Java são gerenciadas pelo `spring-boot-starter-parent`. O ambiente de desenvolvimento da equipe é reproduzido com Docker Compose; veja [Executando com Docker Compose](#executando-com-docker-compose).

### Aplicação web

A aplicação web fica em `web/` e usa React com TypeScript, Vite, Tailwind CSS, HeroUI e Lucide React. Para executá-la localmente, use:

```bash
cd web
npm install
npm run dev
```

O build de produção pode ser validado com `npm run build` e os testes com `npm test`.

#### Gestão de estudos clínicos (Tarefa 3146)

A rota `/estudos` disponibiliza a listagem de estudos clínicos, busca por título, filtro por status, indicadores resumidos e modais para cadastro e edição. Nesta etapa, os dados são mantidos somente em memória a partir de `web/src/data/estudos-mock.ts`; portanto, inclusões e alterações são perdidas ao recarregar a página. A integração com a API de estudos será realizada quando o contrato e os endpoints do backend estiverem disponíveis.

### Módulos e camadas do backend

Os módulos são organizados por área de negócio. Nesta etapa, a estrutura inclui `auth`, `users` e `studies`, correspondentes às funcionalidades de autenticação, gestão de usuários e gestão de estudos previstas para a Sprint 1. Recrutamento, acompanhamento e monitoramento poderão ser adicionados como módulos quando essas áreas forem implementadas.

Dentro de cada módulo, as pastas representam estas responsabilidades:

- **`api/`** — controllers REST e modelos usados para receber e responder às requisições HTTP.
- **`application/`** — serviços e casos de uso que coordenam cada operação e a comunicação entre as camadas.
- **`domain/`** — entidades e regras de negócio próprias do módulo.
- **`infrastructure/`** — persistência com Spring Data JPA e demais integrações técnicas.

O módulo `shared/` fica reservado a componentes técnicos usados por mais de um módulo, como configurações comuns e tratamento geral de erros. Ele não deve concentrar regras de negócio específicas.

Como regra de dependência, um módulo não deve acessar diretamente as classes internas de persistência de outro módulo. Quando uma operação precisar de outro módulo, a integração deve ocorrer por uma interface ou serviço exposto por ele.

### Estrutura prevista no repositório

```text
backend/
├── dev/
│   └── seed_demo_users.sql
└── src/
    ├── main/
    │   ├── java/clinicalstudypb/
    │   │   ├── auth/
    │   │   │   ├── api/
    │   │   │   ├── application/
    │   │   │   ├── domain/
    │   │   │   └── infrastructure/
    │   │   ├── shared/
    │   │   ├── users/
    │   │   │   ├── api/
    │   │   │   ├── application/
    │   │   │   ├── domain/
    │   │   │   └── infrastructure/
    │   │   └── studies/
    │   │       ├── api/
    │   │       ├── application/
    │   │       ├── domain/
    │   │       └── infrastructure/
    │   └── resources/
    │       └── db/migration/
    └── test/java/clinicalstudypb/
        ├── users/
        └── studies/
```

As pastas `web/` e `mobile/` permanecem na raiz como aplicações independentes que consomem a API. A pasta `releases/` guarda a documentação de cada entrega.

### Executando com Docker Compose

O arquivo `compose.yaml` sobe o PostgreSQL 18 e o backend. O banco só é acessível pela máquina local (`127.0.0.1`), e o backend fica disponível em `http://localhost:8080`. O `compose.yaml` já informa ao backend a conexão com o banco (`DB_URL`), por isso essa variável não faz parte do `.env`.

**Pré-requisito:** Docker com o Docker Compose instalado.

**1. Crie o arquivo `.env`** na raiz do repositório a partir do modelo (ele não é versionado):

```bash
cp .env.example .env
```

No Windows (PowerShell): `Copy-Item .env.example .env`.

**2. Preencha as variáveis** no `.env`:

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DB_USER` | Não | Usuário do banco. Padrão: `clinicalstudypb`. |
| `DB_PASSWORD` | Sim | Senha do banco. Escolha um valor só seu; não coloque no Git. |
| `DB_HOST_PORT` | Não | Porta do banco na máquina local. Padrão: `15432`. |
| `JWT_SECRET_BASE64` | Sim | Chave de assinatura dos JWTs: Base64 de pelo menos 32 bytes aleatórios. Gere com `openssl rand -base64 32`. Mantenha fora do Git. |
| `JWT_EXPIRATION_SECONDS` | Não | Validade do token em segundos. Padrão: `3600`. |

Sem `openssl`, é possível gerar a chave no PowerShell: `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))`. Se `DB_PASSWORD` ou `JWT_SECRET_BASE64` não estiverem definidos, o Docker Compose interrompe a execução e informa qual variável falta.

**3. Suba a stack** (a primeira execução constrói a imagem do backend):

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

O backend só inicia depois que o banco estiver saudável, e o Flyway aplica as migrações na primeira inicialização.

**4. (Opcional) Carregue as contas de demonstração**, depois que o backend tiver iniciado e aplicado as migrações:

```bash
docker compose exec -T db psql -U clinicalstudypb -d clinicalstudypb < backend/dev/seed_demo_users.sql
```

Se você alterou `DB_USER`, use o seu valor no lugar de `clinicalstudypb` após `-U`.

**5. Pare a stack:**

```bash
docker compose stop     # para os contêineres e preserva os dados
docker compose down     # remove os contêineres e preserva os dados
docker compose down -v  # remove também o volume e APAGA o banco
```

Para iniciar novamente sem reconstruir a imagem, use `docker compose up -d`. Depois de alterar o código do backend, use `docker compose up -d --build`.

### Banco e usuários de demonstração

O backend recebe a conexão com o PostgreSQL pelas variáveis de ambiente `DB_URL`, `DB_USER` e `DB_PASSWORD`. Cada integrante configura esses valores para seu próprio ambiente. A senha de acesso ao banco não deve ser colocada no repositório.

A assinatura e a validação dos JWTs usam a variável `JWT_SECRET_BASE64`, que deve conter uma chave aleatória codificada em Base64 com pelo menos 32 bytes. Defina a mesma chave em cada instância do backend e mantenha-a fora do Git. A validade padrão é de 3600 segundos e pode ser alterada com `JWT_EXPIRATION_SECONDS`.

Ao iniciar o backend, o Flyway aplica as migrações pendentes: V1 cria `users`, V2 cria `studies`, V3 adiciona o estado do estudo, V4 cria o histórico de estados, visitas previstas e atividades, V5 cria candidatos, V6 cria critérios de estudo e V7 cria consentimentos simulados. Estudos anteriores à V3 recebem `PLANNING`. O Hibernate valida a correspondência entre as tabelas e as entidades JPA, sem criar ou alterar tabelas automaticamente.

Para carregar as contas fictícias no ambiente local ou de demonstração, execute **manualmente** `backend/dev/seed_demo_users.sql` no banco `clinicalstudypb`, esquema `public`, depois da migração V1. O script pode ser executado novamente sem duplicar as contas. Ele não é uma migração Flyway e não roda na inicialização do backend.

| Perfil | E-mail | Senha de demonstração |
| --- | --- | --- |
| Pesquisador | `pesquisador@clinicalstudypb.test` | `Demo@Clinical2026` |
| Coordenador | `coordenador@clinicalstudypb.test` | `Demo@Clinical2026` |
| Administrador | `administrador@clinicalstudypb.test` | `Demo@Clinical2026` |
| Participante | `participante@clinicalstudypb.test` | `Demo@Clinical2026` |

Essas credenciais são apenas para demonstração e podem ser usadas para obter um token de acesso pelo endpoint de login.

### Autenticação (T4.1)

A autenticação é fornecida pelo módulo `backend/src/main/java/clinicalstudypb/auth/`. O backend usa Spring Security em modo stateless: não cria sessão HTTP e valida os JWTs enviados nas chamadas protegidas. O `DelegatingPasswordEncoder` compartilhado com o módulo de usuários verifica a senha usando o identificador `{bcrypt}` do hash persistido; a senha recebida no login não é armazenada nem devolvida pela API.

| Método e rota | Acesso | Resultado |
| --- | --- | --- |
| `POST /api/auth/login` | Público | `200` com JWT e dados públicos do usuário |
| `POST /api/auth/logout` | Exige JWT válido | `204` sem conteúdo; o cliente descarta o token |

O login recebe e-mail e senha em JSON:

```json
{
  "email": "pesquisador@example.com",
  "password": "senha-de-exemplo"
}
```

Em caso de sucesso, a resposta contém `accessToken`, `tokenType` (`Bearer`), `expiresIn` (segundos) e `user` (id, nome, e-mail, perfil e situação da conta). Para acessar uma rota protegida, o cliente envia o token no cabeçalho `Authorization: Bearer <accessToken>`.

O token é assinado com HS256 e inclui emissor, e-mail no campo `sub`, id do usuário, perfil, instante de emissão e expiração. Sua validade padrão é de 3600 segundos, configurável por `JWT_EXPIRATION_SECONDS`. `JWT_SECRET_BASE64` precisa conter uma chave aleatória codificada em Base64 com pelo menos 32 bytes; a mesma chave deve ser configurada nas instâncias que precisam validar os tokens. A chave deve permanecer fora do Git.

Credenciais inválidas ou conta inativa recebem `401` com código `INVALID_CREDENTIALS`; dados de login ausentes ou inválidos recebem `400` com código `INVALID_REQUEST` e erros por campo. Uma chamada protegida sem token ou com token inválido recebe `401` com código `UNAUTHORIZED`.

O logout não mantém lista de revogação no servidor: por ser stateless, ele apenas confirma o encerramento no cliente, que deve apagar o token. Um token já emitido continua válido até expirar. A autorização específica por perfil ainda pertence à tarefa RF03.

### API de usuários (T3.2)

A API usa a base `/api/users`. As rotas abaixo implementam a gestão de usuários; a gerente ainda poderá ajustar seus nomes no contrato OpenAPI da T2.1.

| Método e rota | Operação | Resposta de sucesso |
| --- | --- | --- |
| `GET /api/users` | Listar usuários | `200` |
| `GET /api/users/{id}` | Consultar usuário | `200` |
| `POST /api/users` | Cadastrar usuário | `201`, com `Location: /api/users/{id}` |
| `PUT /api/users/{id}` | Atualizar nome, e-mail e perfil | `200` |
| `PATCH /api/users/{id}/activate` | Ativar usuário | `200` |
| `PATCH /api/users/{id}/deactivate` | Desativar usuário | `200` |
| `DELETE /api/users/{id}` | Excluir o registro do usuário | `204` |

O cadastro recebe `name`, `email`, `password` e `role`. A atualização recebe `name`, `email` e `role`. `role` aceita `RESEARCHER`, `COORDINATOR`, `ADMINISTRATOR` ou `PARTICIPANT`. Por exemplo, o corpo de um cadastro é:

```json
{
  "name": "Pesquisador Demo",
  "email": "pesquisador@example.com",
  "password": "senha-de-exemplo",
  "role": "RESEARCHER"
}
```

O backend remove espaços nas pontas do nome e do e-mail, guarda o e-mail em minúsculas e verifica duplicidade sem diferenciar maiúsculas de minúsculas. A senha é codificada com `DelegatingPasswordEncoder` no formato `{bcrypt}` antes de ser persistida. Nenhuma resposta da API contém a senha ou o hash. Requisições inválidas recebem `400`, usuários inexistentes recebem `404` e conflitos de e-mail recebem `409`.

O login e o logout usam JWT stateless: o cliente descarta o token no logout, sem revogação do lado do servidor. As rotas de gestão de usuários exigem autenticação, mas as permissões específicas por perfil pertencem à tarefa RF03. O `DELETE` atual exclui o registro; se a regra de negócio aprovada pela equipe exigir somente desativação, o contrato e a implementação deverão ser ajustados juntos.

### API de estudos e visitas previstas (T6.2, T11.1, T10.1 e T16.2)

A API usa a base `/api/studies` e segue o contrato em `backend/openapi.yaml`. Pesquisadores e coordenadores consultam estudos e visitas; somente o pesquisador responsável altera o estudo e seu protocolo.

| Método e rota | Operação | Resposta de sucesso |
| --- | --- | --- |
| `GET /api/studies` | Listar estudos | `200` |
| `GET /api/studies/{id}` | Consultar estudo | `200` |
| `POST /api/studies` | Cadastrar estudo | `201`, com `Location: /api/studies/{id}` |
| `PUT /api/studies/{id}` | Atualizar estudo | `200` |
| `PATCH /api/studies/{id}/status` | Alterar o estado do estudo | `200` |
| `GET /api/studies/{id}/status-history` | Consultar quem alterou o estado e quando | `200` |
| `GET/POST /api/studies/{id}/planned-visits` | Listar ou cadastrar visitas previstas | `200/201` |
| `GET/PUT/DELETE /api/studies/{id}/planned-visits/{visitId}` | Consultar, editar ou excluir uma visita | `200/200/204` |
| `PUT /api/studies/{id}/planned-visits/order` | Reordenar visitas | `200` |
| `DELETE /api/studies/{id}/planned-visits/{visitId}/activities/{activityId}` | Excluir atividade sem esvaziar a visita | `204` |
| `GET/POST /api/studies/{studyId}/candidates` | Listar ou cadastrar candidatos | `200/201` |
| `GET /api/studies/{studyId}/candidates/{candidateId}` | Consultar um candidato do estudo | `200` |
| `GET/PUT /api/studies/{studyId}/candidates/{candidateId}/consent` | Consultar ou registrar consentimento simulado | `200/200` |

Cadastro e atualização recebem `title`, `objective`, `responsibleUserId`, `startDate`, `endDate` e `participantLimit`. As datas usam o formato `AAAA-MM-DD`. O título é obrigatório e tem até 200 caracteres; o objetivo é obrigatório; o limite deve ser maior que zero; a data de término não pode anteceder a de início. O responsável deve existir e ter o perfil `RESEARCHER`, conforme a regra confirmada para a Sprint 1. O serviço consulta o módulo de usuários por `UserService`, sem acessar o repositório interno desse módulo.

O banco mantém a chave estrangeira para `users`, a restrição de datas e a restrição do limite. O serviço valida as regras antes de persistir. Corpos inválidos ou regras violadas recebem `400`; recursos inexistentes recebem `404`. Na atualização, a entidade JPA é alterada dentro de uma transação e o Hibernate grava as mudanças.

O estudo inicia em `PLANNING`. Para alterar o estado, envie, por exemplo, `{"status":"RECRUITMENT","expectedStatus":"PLANNING"}`. O fluxo normal é `PLANNING → RECRUITMENT → EXECUTION → CLOSED`. `RECRUITMENT` pode voltar a `PLANNING`. Os três estados não terminais podem ir a `CANCELLED`, com `reason` obrigatório; cancelamentos anteriores à execução podem retornar somente ao estado de origem. `CLOSED` e o cancelamento originado em `EXECUTION` são terminais. Cada transição grava ator, instante, origem e destino em histórico. A linha do estudo é bloqueada e `expectedStatus` divergente recebe `409`.

Uma visita prevista tem nome, data no período do estudo, posição 1..N e ao menos uma atividade. Cada atividade tem nome e descrição; nomes não se repetem na mesma visita. A lista de atividades enviada no `PUT` é a lista completa: IDs existentes são preservados, atividades novas não trazem ID e atividades omitidas são removidas. A ordem da lista define a posição de cada atividade. O servidor ajusta as posições das visitas em uma transação. O protocolo só pode ser alterado em `PLANNING` ou `RECRUITMENT`. Em cada `POST`, `PUT` e `DELETE` de visita ou atividade, envie `If-Match` com o número de `version` retornado em `GET /api/studies/{id}`, entre aspas (por exemplo, `If-Match: "0"`); uma versão antiga recebe `409`.

`PlannedVisit` e `PlannedActivity` mapeiam as tabelas como entidades JPA. As consultas da API usam o repositório JPA com as atividades carregadas na ordem. As gravações e reordenações usam `JdbcTemplate` na mesma transação, com bloqueio do estudo e restrições únicas no PostgreSQL; esse caminho mantém as posições contínuas quando várias linhas mudam de lugar.

**Integração pendente:** a abertura de `RECRUITMENT` exige visita com atividade e critérios de inclusão e exclusão; `EXECUTION` exige participante incluído. Enquanto os módulos de critérios e inclusão não fornecerem `StudyReadiness`, essas duas transições respondem `409`. Assim, o backend não permite avançar sem validar as condições acordadas.

O consentimento simulado de um candidato é consultado e registrado em
`GET/PUT /api/studies/{studyId}/candidates/{candidateId}/consent`.
Somente o coordenador acessa essas operações. Antes da primeira decisão, a
consulta retorna `PENDING` sem horário. Durante `RECRUITMENT`, o `PUT`
aceita `GRANTED` ou `DECLINED` e o backend registra o horário; `PENDING`
não pode ser enviado como decisão. A migração V7 cria
`simulated_consents`. O método `SimulatedConsentService.lockAfterInclusion`
prepara o bloqueio da decisão após a inclusão e deve ser chamado pela futura
T15.1 na mesma transação que cria o participante. Isso é um registro de teste,
sem assinatura ou validade de consentimento clínico.

O cadastro de candidatos é restrito ao perfil `COORDINATOR`; a consulta também é permitida ao `RESEARCHER` responsável pelo estudo. O cadastro exige estudo em `RECRUITMENT`, inicia `eligibilityStatus` como `PENDING` e rejeita nomes e idades repetidos no mesmo estudo com `409`. Como o contrato atual não fornece outro identificador do candidato, a chave de duplicidade usa o nome normalizado e a idade. A API não acessa repositórios internos do módulo de estudos; consulta o estudo pelo `StudyService`.

Os testes automatizados de estudos verificam as regras do serviço, as respostas HTTP e o fluxo completo com PostgreSQL. A API também foi iniciada com PostgreSQL 18 local: listagem `200`, cadastro `201`, atualização `200` e rejeição de datas invertidas `400`, sem alterar os dados já gravados.

Para conferir a V4 no PostgreSQL, consulte `flyway_schema_history` e as tabelas `study_status_history`, `planned_visits` e `planned_activities` após iniciar a aplicação.

### Testes do backend

Na pasta `backend/`, com Java 21 e o Docker em execução:

```bash
./mvnw test
```

No Windows, use `mvnw.cmd test`. O Docker é necessário porque os testes de integração usam Testcontainers para subir um PostgreSQL descartável, removido ao final da execução. Sem ele, esses testes falham e o comando termina com erro. O mesmo vale para `./mvnw verify`, que também executa os testes.

### Documentação Javadoc

As classes Java do backend, incluindo os testes, registram autor, data de introdução (`@since`) e versão (`@version`). Para gerar a documentação das classes de produção, execute na pasta `backend/`:

```bash
./mvnw javadoc:javadoc
```

No Windows, use `mvnw.cmd javadoc:javadoc`. O resultado fica em `backend/target/reports/apidocs/index.html`. O plugin Maven Javadoc 3.12.0 valida a documentação e falha se houver avisos.

### Swagger UI e OpenAPI

Com o PostgreSQL ativo e o backend em execução na porta 8080, abra `http://localhost:8080/swagger-ui/index.html` no navegador. No Linux com ambiente gráfico, também é possível executar `xdg-open http://localhost:8080/swagger-ui/index.html`. A interface mostra as operações já implementadas e permite inspecionar os corpos e as respostas HTTP. O JSON gerado a partir da aplicação fica em `http://localhost:8080/v3/api-docs`; ele é diferente do contrato estático em `backend/openapi.yaml`, que também descreve as entregas planejadas para a Sprint 2.

Para verificar os dois endereços pelo terminal:

```bash
curl -s -o /dev/null -w 'Swagger UI: %{http_code}\n' http://localhost:8080/swagger-ui/index.html
curl -s -o /dev/null -w 'OpenAPI: %{http_code}\n' http://localhost:8080/v3/api-docs
```

Ambos devem retornar `200`. Se a conexão for recusada, confira se o backend continua em execução; o terminal de `./mvnw spring-boot:run` deve permanecer aberto.

### Estado atual

O backend contém a classe principal, o módulo de usuários com persistência Flyway e contas fictícias, os módulos de autenticação e estudos e o contrato OpenAPI. Login e logout usam JWT stateless; a autorização por perfil permanece para a tarefa RF03. O pacote Java `clinicalstudypb` será mantido como raiz dos módulos nesta etapa.
