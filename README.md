# ClinicalStudyPB-project

## Arquitetura utilizada

### Decisão arquitetural

O sistema será organizado como um **monólito modular em camadas**. O backend será uma única aplicação Java com Spring Boot, dividida em módulos de negócio. Cada módulo separa a interface HTTP, os casos de uso, as regras de domínio e os detalhes de infraestrutura. A aplicação será executada e implantada como uma unidade.

Essa organização atende ao escopo do ClinicalStudyPB e permite que a equipe desenvolva as áreas do sistema com responsabilidades definidas, mantendo uma execução simples para o projeto.

### Aplicações e comunicação

- **Web:** aplicação React com TypeScript, destinada aos perfis de pesquisador, coordenador do estudo e administrador.
- **Mobile:** aplicação React Native com Expo, destinada ao participante.
- **Backend:** aplicação Spring Boot que disponibiliza uma API HTTP REST compartilhada pelas aplicações web e mobile. A API será documentada com OpenAPI.
- **Banco de dados:** PostgreSQL, acessado somente pelo backend. As aplicações web e mobile não se conectam diretamente ao banco.

O backend valida as requisições, aplica as regras de negócio, controla as permissões dos perfis e realiza as operações de persistência. As alterações do esquema do banco serão mantidas em migrações Flyway dentro do backend.

### Stack e versões acordadas

| Componente | Tecnologia e versão |
| --- | --- |
| Backend | Java 21 e Spring Boot 3.5.16 |
| Build do backend | Maven 3.9.9, fixado pelo Maven Wrapper (`mvnw` e `mvnw.cmd`) |
| Banco de dados | PostgreSQL 18 |
| Documentação da API | OpenAPI com springdoc-openapi 2.8.17 e Swagger UI |
| Web | React com TypeScript; versões das dependências serão registradas quando a aplicação for criada |
| Mobile | React Native com Expo; versões das dependências serão registradas quando a aplicação for criada |

O `backend/pom.xml` declara Java, Spring Boot e springdoc. As versões das demais dependências Java são gerenciadas pelo `spring-boot-starter-parent`. O ambiente de desenvolvimento da equipe será reproduzido com Docker Compose; os arquivos de execução ainda serão adicionados.

### Módulos e camadas do backend

Os módulos são organizados por área de negócio. Nesta etapa, a estrutura inicial inclui `users` e `studies`, correspondentes às funcionalidades de usuários, autenticação e gestão de estudos previstas para a Sprint 1. Recrutamento, acompanhamento e monitoramento poderão ser adicionados como módulos quando essas áreas forem implementadas.

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

### Banco e usuários de demonstração

O backend recebe a conexão com o PostgreSQL pelas variáveis de ambiente `DB_URL`, `DB_USER` e `DB_PASSWORD`. Cada integrante configura esses valores para seu próprio ambiente. A senha de acesso ao banco não deve ser colocada no repositório.

Ao iniciar o backend com um banco vazio, o Flyway aplica `backend/src/main/resources/db/migration/V1__create_users.sql`, que cria a tabela `users`. O Hibernate está configurado para validar a correspondência entre a tabela e a entidade JPA, sem criar ou alterar tabelas automaticamente.

Para carregar as contas fictícias no ambiente local ou de demonstração, execute **manualmente** `backend/dev/seed_demo_users.sql` no banco `clinicalstudypb`, esquema `public`, depois da migração V1. O script pode ser executado novamente sem duplicar as contas. Ele não é uma migração Flyway e não roda na inicialização do backend.

| Perfil | E-mail | Senha de demonstração |
| --- | --- | --- |
| Pesquisador | `pesquisador@clinicalstudypb.test` | `Demo@Clinical2026` |
| Coordenador | `coordenador@clinicalstudypb.test` | `Demo@Clinical2026` |
| Administrador | `administrador@clinicalstudypb.test` | `Demo@Clinical2026` |
| Participante | `participante@clinicalstudypb.test` | `Demo@Clinical2026` |

Essas credenciais são apenas para demonstração. O login com elas poderá ser testado quando a autenticação da Sprint 1 estiver implementada.

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

As rotas de gestão de usuários ainda não têm controle de acesso: autenticação e autorização por perfil serão integradas nas tarefas RF02 e RF03. O `DELETE` atual exclui o registro; se a regra de negócio aprovada pela equipe exigir somente desativação, o contrato e a implementação deverão ser ajustados juntos.

### Documentação Javadoc

As classes Java do backend, incluindo os testes, registram autor, data de introdução (`@since`) e versão (`@version`). Para gerar a documentação das classes de produção, execute na pasta `backend/`:

```bash
./mvnw javadoc:javadoc
```

No Windows, use `mvnw.cmd javadoc:javadoc`. O resultado fica em `backend/target/reports/apidocs/index.html`. O plugin Maven Javadoc 3.12.0 valida a documentação e falha se houver avisos.

### Estado atual

As pastas do backend acima foram criadas como estrutura inicial e contêm arquivos `.gitkeep` para que sejam versionadas. O `backend/pom.xml` declara as dependências iniciais, o Maven Wrapper está disponível para Linux e Windows, e a classe principal da aplicação já foi criada. A entidade JPA de usuário, os perfis e a migração Flyway V1 foram implementados; há um script separado para carregar contas fictícias. A API REST de usuários está implementada, mas sua autenticação e autorização ainda dependem das tarefas de RF02 e RF03. A execução com Docker Compose ainda será adicionada na tarefa correspondente da Sprint 1. O pacote Java `clinicalstudypb` será mantido como raiz dos módulos nesta etapa.
