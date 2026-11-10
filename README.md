# ClinicalStudyPB-project

## Primeira execução

Pré-requisitos: Git, Docker com Docker Compose e Node.js 22 com npm (a versão usada no CI). Para executar o backend fora do Docker, instale também o JDK 21; o Maven é fornecido pelo Wrapper. Para o mobile, use um telefone Android com Expo Go compatível com o SDK do projeto ou um emulador configurado no Android Studio.

Em uma pasta de sua escolha, obtenha o projeto:

```bash
git clone https://github.com/livdenner/ClinicalStudyPB-project.git
cd ClinicalStudyPB-project
```

Siga esta ordem: [configure e suba banco/backend](#executando-com-docker-compose), carregue os dados fictícios, confira o [Swagger UI](#swagger-ui-e-openapi), inicie a [web](#aplicação-web) e abra o [mobile](#aplicativo-mobile-inicial). Execute os comandos na pasta indicada; o `npm test` da raiz não executa os testes das três aplicações.

O arquivo `.env` contém configurações locais e não é versionado. Não copie arquivos `.env`, `node_modules` ou dados de banco de outra instalação para validar uma instalação limpa.

Os comandos, resultados e limitações da conferência estão no [relatório de instalação limpa da T16.13](releases/release1/tests/t16-13/README.md).

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
| Web | React 19.3.1, TypeScript 6.0.3 e Vite 8.3.5; Tailwind CSS 4.3.3, HeroUI 3.2.6 e Lucide React 1.61.0 |
| Mobile | React Native 0.88.0, Expo SDK 58 (`expo ~58.0.19`) e TypeScript ~6.0.3; detalhes de instalação e handoff em [mobile/README.md](mobile/README.md) |

O `backend/pom.xml` declara Java, Spring Boot e springdoc. As versões das demais dependências Java são gerenciadas pelo `spring-boot-starter-parent`. O ambiente de desenvolvimento da equipe é reproduzido com Docker Compose; veja [Executando com Docker Compose](#executando-com-docker-compose).

### Aplicação web

A aplicação web fica em `web/` e usa React com TypeScript, Vite, Tailwind CSS, HeroUI e Lucide React. Para executá-la localmente, use:

```bash
cd web
npm ci
npm run dev
```

Mantenha o terminal aberto e acesse o endereço exibido pelo Vite, normalmente `http://localhost:5173`. O proxy de desenvolvimento encaminha `/api` para `http://localhost:8080`; inicie o backend antes de testar o login. Use uma das [contas fictícias](#banco-e-usuários-de-demonstração).

Em outro terminal, na pasta `web/`, valide o build com `npm run build`, os testes com `npm test` e a cobertura com `npm run test:coverage`. No PowerShell, use `npm.cmd` se a política de execução impedir o uso de `npm.ps1`.

Se a inicialização dos workers de teste falhar por timeout em uma máquina ocupada, encerre outras compilações e repita com `npm run test:coverage -- --maxWorkers=1`. Isso limita o paralelismo, preservando os testes e os timeouts configurados.

### Aplicativo mobile inicial

Abra outro terminal na raiz do repositório:

```bash
cd mobile
npm ci
npm start
```

Para telefone Android, conecte-o à mesma rede Wi-Fi do computador, abra o Expo Go e leia o QR code exibido pelo Expo. O Expo Go deve ser compatível com o Expo SDK 58 usado pelo projeto. Para emulador, inicie o dispositivo no Android Studio e execute `npm run android` na pasta `mobile/`, ou pressione `a` no terminal do Expo.

Confira a tela **ClinicalStudyPB**, toque em **Ver estudos** e depois em **Voltar ao início**. Essa é a navegação provisória da Release 1: não há login, sessão ou integração de negócio mobile; o login integrado está previsto para a Sprint 3. Não é necessário configurar a URL da API para abrir essas telas.

Em outro terminal, na pasta `mobile/`, execute:

```bash
npm test -- --runInBand
npx tsc --noEmit
npx expo install --check
```

No PowerShell, os equivalentes são `npm.cmd` e `npx.cmd`. A abertura em navegador não substitui a conferência em emulador ou dispositivo. Para configuração de API, alternativas de conexão e passagem de contexto, consulte [mobile/README.md](mobile/README.md).

### Gestão de estudos clínicos (Tarefa 3146)

A rota `/estudos` disponibiliza listagem, busca por título, cadastro e edição para pesquisadores. A ação Visualizar abre `/estudos/{id}`. Os dados são consultados e persistidos pela API `/api/studies`, com JWT, e permanecem disponíveis ao recarregar a página. A resposta inclui título, objetivo, responsável, datas, limite de participantes, `status` e `version`; não inclui a quantidade de participantes alocados.

A rota `/usuarios` permite ao administrador listar, filtrar, cadastrar, editar, ativar e desativar usuários pela API `/api/users`. Administradores não têm acesso à gestão de estudos; pesquisadores e coordenadores não têm acesso à gestão de usuários. Coordenadores podem consultar estudos e visitas previstas; alterações do protocolo pertencem ao pesquisador responsável. O login e o logout utilizam `/api/auth`. Os mocks dos protótipos de outras seções não são usados para persistir usuários ou estudos.

O roteiro e os resultados de regressão de RF01 a RF04 estão no [README da Release 1](releases/release1/README.md#regressão-de-usuários-e-estudos-task-3479).

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
│   ├── seed_demo_recruitment.sql
│   ├── seed_demo_studies.sql
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

Sem `openssl`, gere uma chave com o Node.js (também funciona no PowerShell) e copie o resultado para `JWT_SECRET_BASE64` no `.env`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Substitua os valores de exemplo de `DB_PASSWORD` e `JWT_SECRET_BASE64`; o texto de exemplo da chave não é uma chave válida. Se uma dessas variáveis estiver vazia, o Docker Compose interrompe a execução e informa qual falta.

Se a porta `15432` já estiver ocupada, escolha uma porta livre em `DB_HOST_PORT` antes de iniciar. A porta `8080` deve estar livre para o backend. Os nomes de contêiner definidos no Compose também precisam estar disponíveis. Não remova contêineres ou volumes de outra instalação para contornar um conflito.

**3. Suba a stack** (a primeira execução constrói a imagem do backend):

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

O backend só inicia depois que o banco estiver saudável, e o Flyway aplica as migrações na primeira inicialização. Espere o log informar a inicialização da aplicação e confirme o Swagger UI antes de carregar o seed. Use `Ctrl+C` para sair do acompanhamento dos logs; os contêineres continuam ativos.

**4. (Opcional) Carregue os dados de demonstração** (contas, estudos e recrutamento), depois que o backend tiver iniciado e aplicado as migrações. Os comandos funcionam no bash e no PowerShell:

```bash
docker compose cp backend/dev/. db:/tmp/seed
docker compose exec db psql -U clinicalstudypb -d clinicalstudypb -v ON_ERROR_STOP=1 -f /tmp/seed/seed_demo_users.sql -f /tmp/seed/seed_demo_studies.sql -f /tmp/seed/seed_demo_recruitment.sql
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

Ao iniciar o backend, o Flyway aplica as migrações pendentes: V1 cria `users`, V2 cria `studies`, V3 adiciona o estado do estudo, V4 cria o histórico de estados, visitas previstas e atividades, V5 cria candidatos, V6 cria critérios de estudo, V7 cria respostas de elegibilidade e V8 cria consentimentos simulados. V9 registra autoria e instante da avaliação; V10 prepara os vínculos de participantes para integração com a T15.1. A sequência e o protocolo de integração estão descritos em [elegibilidade e participantes](backend/docs/eligibility-integration.md). Estudos anteriores à V3 recebem `PLANNING`. O Hibernate valida a correspondência entre as tabelas e as entidades JPA, sem criar ou alterar tabelas automaticamente.

Para carregar as contas fictícias no ambiente local ou de demonstração, execute **manualmente** `backend/dev/seed_demo_users.sql` no banco `clinicalstudypb`, esquema `public`, depois da migração V1. O script pode ser executado novamente sem duplicar as contas. Ele não é uma migração Flyway e não roda na inicialização do backend.

| Perfil | E-mail | Senha de demonstração |
| --- | --- | --- |
| Pesquisador | `pesquisador@clinicalstudypb.test` | `Demo@Clinical2026` |
| Coordenador | `coordenador@clinicalstudypb.test` | `Demo@Clinical2026` |
| Administrador | `administrador@clinicalstudypb.test` | `Demo@Clinical2026` |
| Participante | `participante@clinicalstudypb.test` | `Demo@Clinical2026` |

Essas credenciais são apenas para demonstração e podem ser usadas para obter um token de acesso pelo endpoint de login.

Depois das contas, `backend/dev/seed_demo_studies.sql` cria os seis estudos da tabela abaixo, com o Pesquisador de demonstração como responsável, visitas previstas com atividades e histórico de estados. A carga cobre todos os estados e acrescenta o cenário de disputa pela última vaga. O script pode ser executado novamente: um estudo só é criado se ainda não houver outro com o mesmo título.

Em seguida, `backend/dev/seed_demo_recruitment.sql` acrescenta critérios, candidatos, respostas de elegibilidade, consentimentos simulados e participantes, todos fictícios. Pode ser executado novamente: um estudo só recebe esses dados se ainda não tiver critérios nem candidatos.

| Estudo | Estado | Visitas | Candidatos | Participantes / vagas | Para demonstrar |
| --- | --- | --- | --- | --- | --- |
| Adesão ao tratamento da hipertensão arterial | `PLANNING` | 2 | 0 | 0 / 60 | Edição do protocolo e abertura do recrutamento pela API. |
| Vacina contra influenza em idosos | `RECRUITMENT` | 3 | 8 | 2 / 120 | Candidatos em todas as situações de elegibilidade e consentimento; volta para `PLANNING` e cancelamento com justificativa. |
| Higiene do sono em trabalhadores noturnos | `RECRUITMENT` | 1 | 4 | 2 / 3 | Última vaga, com dois candidatos elegíveis e com consentimento concedido. |
| Controle glicêmico no diabetes tipo 2 | `EXECUTION` | 3 | 4 | 3 / 40 | Protocolo bloqueado para edição. |
| Reabilitação motora após AVC | `CLOSED` | 2 | 3 | 3 / 30 | Estado final: nenhuma transição é aceita. |
| Tratamento da asma em crianças | `CANCELLED` | 1 | 2 | 0 / 50 | Restauração para `RECRUITMENT`, o estado de origem. |

O teste `DemoSeedIntegrationTest` executa os três scripts no PostgreSQL do Testcontainers. Assim, uma migração nova que quebre o seed falha no CI. A stack de E2E também carrega os três scripts.

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
| `GET/POST /api/studies/{studyId}/criteria` | Listar ou cadastrar critérios de inclusão e exclusão | `200/201` |
| `GET /api/studies/{studyId}/criteria/{criterionId}` | Consultar um critério do estudo | `200` |
| `GET/POST /api/studies/{id}/planned-visits` | Listar ou cadastrar visitas previstas | `200/201` |
| `GET/PUT/DELETE /api/studies/{id}/planned-visits/{visitId}` | Consultar, editar ou excluir uma visita | `200/200/204` |
| `PUT /api/studies/{id}/planned-visits/order` | Reordenar visitas | `200` |
| `DELETE /api/studies/{id}/planned-visits/{visitId}/activities/{activityId}` | Excluir atividade sem esvaziar a visita | `204` |
| `GET/POST /api/studies/{studyId}/candidates` | Listar ou cadastrar candidatos | `200/201` |
| `GET /api/studies/{studyId}/candidates/{candidateId}` | Consultar um candidato do estudo | `200` |
| `GET /api/studies/{studyId}/candidates/{candidateId}/eligibility` | Consultar respostas e resultado da elegibilidade | `200` |
| `PUT /api/studies/{studyId}/candidates/{candidateId}/eligibility` | Substituir respostas e recalcular elegibilidade | `200` |
| `GET/PUT /api/studies/{studyId}/candidates/{candidateId}/consent` | Consultar ou registrar consentimento simulado | `200/200` |
| `POST /api/studies/{studyId}/candidates/{candidateId}/inclusion` | Incluir candidato como participante | `201`, com `Location` do participante |
| `GET /api/studies/{studyId}/participants` | Listar participantes incluídos no estudo | `200` |
| `GET /api/studies/{studyId}/participants/{participantId}` | Consultar participante do estudo | `200` |

Cadastro e atualização recebem `title`, `objective`, `responsibleUserId`, `startDate`, `endDate` e `participantLimit`. As datas usam o formato `AAAA-MM-DD`. O título é obrigatório e tem até 200 caracteres; o objetivo é obrigatório; o limite de participantes deve estar entre 1 e 1.000.000, inclusive; a data de término não pode anteceder a de início. O responsável deve existir e ter o perfil `RESEARCHER`, conforme a regra confirmada para a Sprint 1. O serviço consulta o módulo de usuários por `UserService`, sem acessar o repositório interno desse módulo.

O banco mantém a chave estrangeira para `users`, a restrição de datas e a restrição do limite. O serviço valida as regras antes de persistir. Corpos inválidos ou regras violadas recebem `400`; recursos inexistentes recebem `404`. Na atualização, a entidade JPA é alterada dentro de uma transação e o Hibernate grava as mudanças.

O estudo inicia em `PLANNING`. Para alterar o estado, envie, por exemplo, `{"status":"RECRUITMENT","expectedStatus":"PLANNING"}`. O fluxo normal é `PLANNING → RECRUITMENT → EXECUTION → CLOSED`. `RECRUITMENT` pode voltar a `PLANNING`. Os três estados não terminais podem ir a `CANCELLED`, com `reason` obrigatório; cancelamentos anteriores à execução podem retornar somente ao estado de origem. `CLOSED` e o cancelamento originado em `EXECUTION` são terminais. Cada transição grava ator, instante, origem e destino em histórico. A linha do estudo é bloqueada e `expectedStatus` divergente recebe `409`.

Uma visita prevista tem nome, data no período do estudo, posição 1..N e ao menos uma atividade. Cada atividade tem nome e descrição; nomes não se repetem na mesma visita. A lista de atividades enviada no `PUT` é a lista completa: IDs existentes são preservados, atividades novas não trazem ID e atividades omitidas são removidas. A ordem da lista define a posição de cada atividade. O servidor ajusta as posições das visitas em uma transação. O protocolo só pode ser alterado em `PLANNING` ou `RECRUITMENT`. Em cada `POST`, `PUT` e `DELETE` de visita ou atividade, envie `If-Match` com o número de `version` retornado em `GET /api/studies/{id}`, entre aspas (por exemplo, `If-Match: "0"`); uma versão antiga recebe `409`.

`PlannedVisit` e `PlannedActivity` mapeiam as tabelas como entidades JPA. As consultas da API usam o repositório JPA com as atividades carregadas na ordem. As gravações e reordenações usam `JdbcTemplate` na mesma transação, com bloqueio do estudo e restrições únicas no PostgreSQL; esse caminho mantém as posições contínuas quando várias linhas mudam de lugar.

Para abrir `RECRUITMENT`, o estudo precisa ter uma visita com atividade e critérios de inclusão e exclusão. Para iniciar `EXECUTION`, precisa ter um participante incluído. A prontidão consulta critérios e participantes reais pelos serviços públicos desses módulos.

O consentimento simulado de um candidato é consultado e registrado em
`GET/PUT /api/studies/{studyId}/candidates/{candidateId}/consent`.
Somente o coordenador acessa essas operações. Antes da primeira decisão, a
consulta retorna `PENDING` sem horário. Durante `RECRUITMENT`, o `PUT`
aceita `GRANTED` ou `DECLINED` e o backend registra o horário; `PENDING`
não pode ser enviado como decisão. A migração V8 cria
`simulated_consents`. O método `SimulatedConsentService.lockAfterInclusion`
bloqueia a decisão na mesma transação que cria o participante na T15.1. Isso é um registro de teste,
sem assinatura ou validade de consentimento clínico.

Somente o perfil `COORDINATOR` pode cadastrar candidatos. A consulta é permitida ao `COORDINATOR` e ao `RESEARCHER` responsável pelo estudo. O cadastro exige estudo em `RECRUITMENT`, inicia `eligibilityStatus` como `PENDING` e rejeita nomes e idades repetidos no mesmo estudo com `409`. Como o contrato atual não fornece outro identificador do candidato, a chave de duplicidade usa o nome normalizado e a idade. A API não acessa repositórios internos do módulo de estudos; consulta o estudo pelo `StudyService`.

A avaliação de elegibilidade é exclusiva do `COORDINATOR`. Antes da primeira avaliação, o GET retorna `PENDING`, `answers: []` e omite `evaluatedAt`. O PUT recebe `answers` com ao menos uma resposta, substitui todas as anteriores e registra o autor autenticado e o instante da avaliação. Critério sem resposta mantém `PENDING`; com todos respondidos, todas as inclusões devem ter `matches: true` e todas as exclusões, `matches: false`, para obter `ELIGIBLE`. Caso contrário, o resultado é `INELIGIBLE`. Critérios repetidos ou de outro estudo retornam `400`; candidato inexistente ou fora do estudo da rota retorna `404`; estudo sem critérios ou candidato já incluído retorna `409`. As gravações usam o bloqueio compartilhado do estudo e uma única transação. A preparação da integração com participantes está descrita em [elegibilidade e T15.1](backend/docs/eligibility-integration.md).

A inclusão de participantes (T15.1) é exclusiva do `COORDINATOR`, não recebe corpo JSON e exige estudo em `RECRUITMENT`, candidato `ELIGIBLE`, consentimento `GRANTED`, ausência de inclusão anterior e vaga disponível. Essas condições são verificadas sob o mesmo bloqueio da linha do estudo usado nas transições, na avaliação e na alteração de consentimento. A gravação do participante e o bloqueio definitivo do consentimento pertencem à mesma transação: uma falha desfaz ambos. Condições de negócio não atendidas recebem `409`; estudo ou candidato inexistente, inclusive candidato de outro estudo, recebe `404`. Ao iniciar `EXECUTION`, novas inclusões são recusadas. O limite do estudo também não pode ser reduzido abaixo da contagem já incluída (`409`).

As consultas de participantes são permitidas a `COORDINATOR` e `RESEARCHER`, conforme o contrato atual. A listagem retorna `[]` para estudo sem inclusões e não mistura estudos. A consulta individual exige que o participante pertença ao estudo da rota. A resposta contém `id`, `studyId`, `candidateId`, `candidateName` e `includedAt`; o autor autenticado fica registrado internamente em `included_by`. A T15.1 reutiliza a entidade e a tabela `participants` da V10, sem alterar migrações já integradas nem criar outra tabela para o mesmo vínculo.

Os testes automatizados de estudos verificam as regras do serviço, as respostas HTTP e o fluxo completo com PostgreSQL. A API também foi iniciada com PostgreSQL 18 local: listagem `200`, cadastro `201`, atualização `200` e rejeição de datas invertidas `400`, sem alterar os dados já gravados.

Para conferir a V4 no PostgreSQL, consulte `flyway_schema_history` e as tabelas `study_status_history`, `planned_visits` e `planned_activities` após iniciar a aplicação.

### Testes do backend

Na pasta `backend/`, com Java 21 e o Docker em execução:

```bash
./mvnw test
```

No PowerShell, use `.\mvnw.cmd test`. O Docker é necessário porque os testes de integração usam Testcontainers para subir um PostgreSQL descartável, removido ao final da execução. Sem ele, esses testes falham e o comando termina com erro.

Para executar Checkstyle, testes e a verificação da cobertura mínima de 80%, use `./mvnw verify` (PowerShell: `.\mvnw.cmd verify`). Os relatórios ficam em `backend/target/surefire-reports/` e `backend/target/site/jacoco/index.html`. A construção da imagem Docker pula os testes e não substitui essa verificação.

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

No PowerShell, consulte os mesmos endereços com:

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:8080/swagger-ui/index.html).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:8080/v3/api-docs).StatusCode
```

### Estado atual

O backend contém a classe principal, o módulo de usuários com persistência Flyway e contas fictícias, os módulos de autenticação e estudos e o contrato OpenAPI. Login e logout usam JWT stateless; a autorização por perfil permanece para a tarefa RF03. O pacote Java `clinicalstudypb` será mantido como raiz dos módulos nesta etapa.
