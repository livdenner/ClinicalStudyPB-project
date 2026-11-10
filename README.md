# ClinicalStudyPB

## 1. Projeto, escopo e equipe

ClinicalStudyPB é um sistema acadêmico de gestão de estudos clínicos. A Release 1 reúne administração de usuários, autenticação, estudos, protocolo e recrutamento (RF01–RF11), com backend Java, aplicação web e estrutura inicial mobile. O consentimento usa exclusivamente dados fictícios e não possui assinatura ou validade clínica/jurídica.

| Integrante | Sprint 1 | Sprint 2 |
| --- | --- | --- |
| Lívia | Gerência | Backend |
| Lucas | Backend | Gerência |
| Raffael | Web 1 | Web 1 |
| Allan | Web 2 | Web 2 |
| Júlio | Mobile | Mobile |
| Júlia | QA/DevOps | QA/DevOps |

Consulte as [entregas, evidências e pendências da Release 1](releases/release1/README.md), o [processo das duas sprints](releases/release1/processo/README.md), o [índice de releases](releases/README.md) e as [convenções de contribuição](CONTRIBUTING.md). O planejamento e acompanhamento da equipe ficam no [Azure DevOps TEAM5](https://dev.azure.com/engsw2/TEAM5).

## 2. Arquitetura e diagramas

O backend é um **monólito modular em camadas**, executado como uma aplicação Spring Boot. Os módulos `auth`, `users`, `studies`, `criteria`, `visits`, `candidates`, `consent` e `participants` separam `api`, `application`, `domain` e `infrastructure`. `shared` reúne autenticação HTTP, configurações e tratamento de erros comuns. Integrações entre módulos usam os serviços públicos; cada módulo mantém sua persistência interna.

A web chama a API REST com JWT; somente o backend acessa o PostgreSQL. O Flyway versiona o esquema e o Hibernate valida seu mapeamento. O mobile da Release 1 navega entre duas telas iniciais; a integração de login pertence à Sprint 3.

| Diagrama | Visualização no GitHub | Fonte editável | PDF |
| --- | --- | --- | --- |
| Casos de uso | [RF01–RF11](docs/diagrams/casos-de-uso.png) | [Draw.io](docs/diagrams/casos-de-uso.drawio) | [PDF](docs/diagrams/casos-de-uso.drawio.pdf) |
| Classes/domínio | [Estudos e protocolo](docs/diagrams/classes.png), [recrutamento](docs/diagrams/classes-recrutamento.png) | [Draw.io](docs/diagrams/classes.drawio) | [PDF, 2 páginas](docs/diagrams/classes.drawio.pdf) |
| Sequência | [Protocolo e estados](docs/diagrams/sequencia.png), [galeria dos seis fluxos](docs/diagrams/README.md#sequências) | [Draw.io](docs/diagrams/sequencia.drawio) | [PDF, 6 páginas](docs/diagrams/sequencia.drawio.pdf) |
| Arquitetura | [Aplicações, módulos e banco](docs/diagrams/arquitetura.png) | [Draw.io](docs/diagrams/arquitetura.drawio) | [PDF](docs/diagrams/arquitetura.drawio.pdf) |

![Arquitetura do ClinicalStudyPB](docs/diagrams/arquitetura.png)

Os arquivos mantêm a notação UML, as cores e o modelo Draw.io preexistentes. O [guia dos diagramas](docs/diagrams/README.md) explica páginas, relações e exportação. O [contrato OpenAPI](backend/openapi.yaml) e o [guia de integração de elegibilidade e participantes](backend/docs/eligibility-integration.md) complementam os diagramas.

## 3. Funcionalidades e demonstração

| Requisitos | Fluxo e perfil | Situação na Release 1 |
| --- | --- | --- |
| RF01–RF03 | Administrador gerencia usuários; login/logout e autorização por perfil protegem as rotas web e HTTP. | Backend e web concluídos. |
| RF04 | Pesquisador cadastra, consulta e edita seus estudos; coordenador consulta estudos. | Backend e web concluídos. |
| RF05–RF07 | Pesquisador responsável cadastra critérios de inclusão/exclusão, configura visitas/atividades e altera o estado do estudo. | Backend e web concluídos. |
| RF08–RF10 | Coordenador cadastra candidatos, responde critérios e registra consentimento simulado. | Backend e web concluídos. |
| RF11 | Coordenador inclui candidato elegível com consentimento concedido e vaga disponível, pela API de inclusão. | Backend concluído; interface web em integração. |
| Mobile | Estrutura inicial com navegação Início ↔ Estudos provisórios. | Escopo inicial concluído; login integrado na Sprint 3. |
| DevOps/Qualidade | Compose, Flyway, carga fictícia e CI de backend, web, E2E e mobile. | Ambiente e pipeline validados; relatórios na release. |

O [quadro RF01–RF11 da Release 1](releases/release1/README.md#rastreabilidade-dos-requisitos) identifica implementação, testes e integração de cada tela. A navegação de painel, visitas e relatórios que ainda usa protótipos não constitui evidência de persistência dessas funcionalidades.

O [roteiro da Release 1](releases/release1/README.md#roteiro-de-demonstração) detalha a demonstração por perfil, do cadastro de usuários à inclusão. Para o mobile, confira **ClinicalStudyPB → Ver estudos → Voltar ao início**.

![Critérios e recrutamento pela API real](releases/release1/images/05-criterios-sucesso.jpg)

![Validação de permissão](releases/release1/images/10-permissao-negada.jpg)

A [galeria de capturas](releases/release1/images/README.md) contém sucesso e erro, ambiente, requisitos e passos de reprodução. A [validação Android](releases/release1/tests/t16-13/README.md) registra a abertura e a navegação confirmadas em dispositivo.

## 4. Stack e pré-requisitos

| Componente | Versão de referência |
| --- | --- |
| Java / Spring Boot | Java 21 (validação: JDK 21.0.7) / 3.5.16 |
| Maven Wrapper | 3.9.9 |
| PostgreSQL | Imagem `postgres:18` (validação: servidor 18.6) |
| Springdoc / OpenAPI | 2.8.17 / contrato em `backend/openapi.yaml` |
| Web | React 19.3.1, TypeScript 6.0.3, Vite 8.3.5 |
| Interface web | HeroUI 3.2.6, Tailwind CSS 4.3.3, Lucide React 1.61.0 |
| Mobile | Expo 58.0.19, React Native 0.88.0, React 19.3.0, TypeScript 6.0.3 |
| Testes | JaCoCo 0.8.13, Vitest 5.0.5, Playwright 1.64.1, Jest 30.5.2 |
| Node.js / npm | Node 22 no CI; validação com 22.23.4 / npm 10.9.9 |
| Docker / Compose | Validação com 29.9.2 / 5.6.1 |

As versões Java vêm do `backend/pom.xml` e do Wrapper; as dependências Java transitivas são gerenciadas pelo Spring Boot. As versões JavaScript instaladas são fixadas nos respectivos `package-lock.json`; use `npm ci`. A tag Docker `postgres:18` acompanha correções da série 18, portanto não fixa um patch ou digest.

Instale Git, Docker com Compose e Node.js 22 com npm. Para testes ou execução do backend fora do Docker, instale JDK 21 e configure `JAVA_HOME`. Os testes de integração precisam do Docker ativo para o Testcontainers. Para mobile, tenha um Android com Expo Go compatível com SDK 58, ou Android Studio com SDK/emulador configurados. O Maven é fornecido pelo repositório.

## 5. Instalação e execução

```bash
git clone https://github.com/livdenner/ClinicalStudyPB-project.git
cd ClinicalStudyPB-project
```

Execute os comandos na pasta indicada. Siga a ordem: banco/backend, carga fictícia, Swagger, web e mobile. O `npm test` da raiz não executa os testes das três aplicações. O `.env` é local; não copie bancos, `node_modules` ou `.env` de outra instalação para validar uma instalação limpa.

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

As contas abaixo são criadas por `backend/dev/seed_demo_users.sql`, após as migrações. Execute os três scripts na ordem do comando anterior. O Flyway aplica V1–V10 e o Hibernate valida o esquema; o [guia do backend](backend/docs/eligibility-integration.md#migrações) descreve a persistência.

| Perfil | E-mail | Senha de demonstração |
| --- | --- | --- |
| Pesquisador | `pesquisador@clinicalstudypb.test` | `Demo@Clinical2026` |
| Coordenador | `coordenador@clinicalstudypb.test` | `Demo@Clinical2026` |
| Administrador | `administrador@clinicalstudypb.test` | `Demo@Clinical2026` |
| Participante | `participante@clinicalstudypb.test` | `Demo@Clinical2026` |

Essas credenciais são apenas para demonstração e podem ser usadas para obter um token de acesso pelo endpoint de login.

A carga completa cria **seis estudos**, com visitas, critérios e cenários de recrutamento, incluindo **Higiene do sono em trabalhadores noturnos** e a disputa pela última vaga. Consulte a [tabela de estudos, candidatos e participantes/vagas](releases/release1/README.md#dados-e-seeds). Os scripts são repetíveis e também são verificados por `DemoSeedIntegrationTest` e pela stack E2E.

```text
backend/dev/
├── seed_demo_users.sql
├── seed_demo_studies.sql
└── seed_demo_recruitment.sql
```

### Variáveis das aplicações cliente

| Arquivo modelo | Variável | Uso |
| --- | --- | --- |
| [web/.env.example](web/.env.example) | `VITE_API_BASE_URL` | Deixe vazia em desenvolvimento para usar `/api` pelo proxy Vite; para outra API, informe a origem sem `/api` (ex.: `http://localhost:8080`), pois os serviços já acrescentam `/api/...`. |
| [mobile/.env.example](mobile/.env.example) | `EXPO_PUBLIC_API_BASE_URL` | Base da API para a futura integração; exemplo Android emulador: `http://10.0.2.2:8080/api`. No telefone, use o IP da máquina na rede. |

São configurações públicas do aplicativo cliente: nunca coloque chaves privadas ou senhas nessas variáveis. Os modelos ficam versionados; arquivos `.env` e a chave JWT ficam fora do Git. O mobile inicial não precisa de conexão com a API para navegar.

### Aplicação web

A aplicação web fica em `web/` e usa React com TypeScript, Vite, Tailwind CSS, HeroUI e Lucide React. Para executá-la localmente, use:

```bash
cd web
npm ci
npm run dev
```

Mantenha o terminal aberto e acesse o endereço exibido pelo Vite, normalmente `http://localhost:5173`. O proxy de desenvolvimento encaminha `/api` para `http://localhost:8080`; inicie o backend antes de testar o login. Use uma das [contas fictícias](#banco-e-usuários-de-demonstração).

No PowerShell, use `npm.cmd` se a política de execução impedir o uso de `npm.ps1`. Os comandos de validação estão na [seção de testes](#6-testes-cobertura-e-qualidade).

### Aplicativo mobile inicial

Abra outro terminal na raiz do repositório:

```bash
cd mobile
npm ci
npm start
```

Para telefone Android, conecte-o à mesma rede Wi-Fi do computador, abra o Expo Go e leia o QR code exibido pelo Expo. O Expo Go deve ser compatível com o Expo SDK 58 usado pelo projeto. Para emulador, inicie o dispositivo no Android Studio e execute `npm run android` na pasta `mobile/`, ou pressione `a` no terminal do Expo.

Confira a tela **ClinicalStudyPB**, toque em **Ver estudos** e depois em **Voltar ao início**. Essa é a navegação provisória da Release 1: não há login, sessão ou integração de negócio mobile; o login integrado está previsto para a Sprint 3. Não é necessário configurar a URL da API para abrir essas telas.

Para configuração de API, alternativas de conexão e passagem de contexto, consulte [mobile/README.md](mobile/README.md). Execute também os [testes e a verificação de compatibilidade](#6-testes-cobertura-e-qualidade).

### Backend fora do contêiner (alternativa)

Inicie somente o banco com `docker compose up -d db`. Exporte no terminal `DB_URL=jdbc:postgresql://localhost:15432/clinicalstudypb`, `DB_USER`, `DB_PASSWORD` e `JWT_SECRET_BASE64` com os valores do seu `.env` (ajuste a porta se mudou `DB_HOST_PORT`). O Spring Boot iniciado pelo Maven não lê automaticamente o `.env` da raiz. Na pasta `backend/`, execute `./mvnw spring-boot:run`, ou `.\mvnw.cmd spring-boot:run` no PowerShell, e mantenha esse terminal aberto. Não execute simultaneamente outro backend na porta 8080.

O [relatório de instalação limpa](releases/release1/tests/t16-13/README.md) registra os comandos conferidos, as migrações V1–V10, a repetição dos seeds e a navegação Android.

## 6. Testes, cobertura e qualidade

### Backend

Na pasta `backend/`, com Java 21 e Docker ativo, execute Checkstyle, testes e verificação da cobertura mínima de 80%:

```bash
./mvnw verify
```

No PowerShell, use `.\mvnw.cmd verify`. O Testcontainers cria um PostgreSQL descartável para os testes de integração. Os relatórios ficam em `backend/target/surefire-reports/` e `backend/target/site/jacoco/index.html`. A construção da imagem Docker pula testes e não substitui essa verificação. A [documentação Java](backend/docs/release1-api.md#documentação-java) tem instruções próprias de geração.

### Web e mobile

Na pasta `web/`:

```bash
npm ci
npm run format:check
npm run lint
npm run test:coverage
npm run build
```

Se houver falha de inicialização dos workers por recursos da máquina, repita `npm run test:coverage -- --maxWorkers=1`. Os relatórios ficam em `web/coverage/index.html`.

Para os E2E existentes, ainda na pasta `web/`, mantenha as portas 18080 e 4173 livres:

```bash
npx playwright install chromium
npm run e2e:stack:up
npm run test:e2e
npm run test:e2e:report
npm run e2e:stack:down
```

No Linux, se faltarem dependências do navegador, use `npx playwright install --with-deps chromium`. O [guia de contribuição](CONTRIBUTING.md#testes-e2e-playwright) detalha o Playwright e os padrões de qualidade. A stack E2E tem banco descartável e backend próprios; não usa o volume do ambiente de desenvolvimento. O Playwright compila e serve a web com proxy para essa API. Os relatórios ficam em `web/playwright-report/` e `web/test-results/`.

Na pasta `mobile/`:

```bash
npm ci
npm test -- --ci --runInBand --coverage
npx tsc --noEmit
npx expo install --check
```

A cobertura fica em `mobile/coverage/`. Confira também a abertura real no Android. Recomendações do Expo devem ser registradas antes de alterar o lockfile; veja o [relatório da T16.13](releases/release1/tests/t16-13/README.md).

A [CI](.github/workflows/ci.yml) executa backend, web, E2E e mobile em PRs e pushes para `development` e `main`, publicando artefatos JaCoCo, JUnit, Vitest, Jest e Playwright. O JaCoCo exige **80% de linhas no backend**, com as exclusões técnicas declaradas no POM; não se aplica esse mesmo limite à cobertura web/mobile. Os [resultados versionados da Release 1](releases/release1/tests/README.md) identificam comandos, versão, contagens e evidências.

## 7. Swagger UI e contrato da API

Com a stack ativa, abra o [Swagger UI local](http://localhost:8080/swagger-ui/index.html) e o [OpenAPI gerado pela aplicação](http://localhost:8080/v3/api-docs). São endereços do ambiente em execução; o GitHub permite acessar o [contrato estático](backend/openapi.yaml) por link relativo.

No PowerShell, ambos devem responder `200`:

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:8080/swagger-ui/index.html).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:8080/v3/api-docs).StatusCode
```

Em bash, use `curl -f http://localhost:8080/v3/api-docs`. Se a conexão falhar, consulte `docker compose ps` e `docker compose logs backend`.

Autentique com as credenciais fictícias em `POST /api/auth/login` e use **Authorize** com o JWT retornado. As rotas usam `/api`. Consulte operações, permissões, controle de versão e regras de negócio no [resumo da API](backend/docs/release1-api.md), incluindo `GET/POST /api/studies/{studyId}/criteria` e a inclusão de participantes.
