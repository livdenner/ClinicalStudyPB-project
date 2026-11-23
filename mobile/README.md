# Aplicativo mobile

Aplicativo do participante do **ClinicalStudyPB**, desenvolvido em React Native com Expo e TypeScript usando Expo Router. Esta entrega cobre login do participante, ativação de primeiro acesso por código, definição/troca de senha com bloqueio pré-troca, sessão protegida no `expo-secure-store`, consulta e decisão única de convites (consentimento simulado), estudos em que a conta participa e próximas visitas/histórico de comparecimento.

O projeto usa **exclusivamente dados fictícios** e consentimento estritamente simulado, sem assinatura ou validade clínica/jurídica. Consulte também o [README principal](../README.md) e o [contrato OpenAPI](../backend/openapi.yaml).

**Navegação rápida:** [Pré-requisitos](#pré-requisitos) · [1. Backend e seeds](#1-subir-o-backend-e-carregar-as-seeds-fictícias) · [2. Contas da seed](#2-contas-fictícias-de-participante-da-seed) · [3. Instalar, API e emulador](#3-instalar-o-aplicativo-configurar-a-url-da-api-e-executar-no-emulador) · [Roteiro de demonstração](#roteiro-de-demonstração) · [Testes Jest](#testes-jest-e-verificações-locais) · [Testes E2E (Maestro)](#testes-e2e-maestro) · [Configuração do Expo](#configuração-do-expo-e-mudanças-registradas) · [Estrutura técnica](#estrutura-e-comportamento-das-telas)

---

## Pré-requisitos

- **Git**, **Docker** e **Docker Compose** (para subir PostgreSQL 18 e backend e carregar as seeds).
- **Node.js 22** e **npm** (mesma versão usada na CI; `package-lock.json` fixa as dependências com `npm ci`).
- **Para executar o app:** **Android Studio** com Android SDK e um emulador Android configurado (recomendado **API 34, `x86_64`**), **ou** telefone físico Android na mesma rede Wi-Fi com o aplicativo **Expo Go** compatível com **Expo SDK 58**.
- **Para executar os testes E2E (Maestro):** **JDK 17** e [**Maestro CLI**](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli).

> **Windows (PowerShell):** use `npm.cmd` e `npx.cmd` caso a política de execução bloqueie scripts `.ps1`. Em macOS e Linux, os comandos equivalentes são `npm` e `npx`.

Versões de referência declaradas em [`package.json`](package.json): Expo SDK `~58.0.26`, React Native `0.88.1`, React `19.3.0`, Expo Router `~58.0.32`, TypeScript `~6.0.3`, Jest `~30.5.2` e `jest-expo ~58.0.15`. Não atualize versões isoladamente sem validar a compatibilidade com o SDK do Expo.

---

## 1. Subir o backend e carregar as seeds fictícias

O aplicativo exige o backend em execução para autenticar e carregar dados reais da API. Se ainda não clonou o projeto, baixe o repositório e entre na pasta raiz:

```powershell
git clone https://github.com/livdenner/ClinicalStudyPB-project.git
cd ClinicalStudyPB-project
```

Partindo da **raiz do repositório** (`ClinicalStudyPB-project/`):

1. **Crie o arquivo `.env` da raiz** a partir do modelo (mantenha fora do Git):

   ```powershell
   Copy-Item .env.example .env
   ```

   *(Em macOS/Linux: `cp .env.example .env`.)*

2. **Preencha `DB_PASSWORD` e `JWT_SECRET_BASE64` no `.env` da raiz** com valores locais fictícios. A chave JWT deve ser um Base64 de pelo menos 32 bytes; para gerar uma sem `openssl`:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

   Verifique também se as portas padrão estão livres na máquina: `8080` (backend) e `15432` (ou outra porta definida em `DB_HOST_PORT` para o PostgreSQL).

3. **Suba o banco e o backend** ([`../compose.yaml`](../compose.yaml)):

   ```powershell
   docker compose up -d --build
   docker compose ps
   docker compose logs -f backend
   ```

   Aguarde o Flyway aplicar as migrações (V1–V15) e o Spring Boot iniciar (pressione `Ctrl+C` para sair dos logs; os contêineres continuam ativos). Confirme que `/v3/api-docs` responde HTTP `200`:

   ```powershell
   (Invoke-WebRequest -UseBasicParsing http://localhost:8080/v3/api-docs).StatusCode
   ```

   *(Em macOS/Linux: `curl -f http://localhost:8080/v3/api-docs`.)*

4. **Carregue os quatro scripts de seed na ordem abaixo** (obrigatório após o backend subir):

   ```powershell
   docker compose cp backend/dev/. db:/tmp/seed
   docker compose exec db psql -U clinicalstudypb -d clinicalstudypb -v ON_ERROR_STOP=1 -f /tmp/seed/seed_demo_users.sql -f /tmp/seed/seed_demo_studies.sql -f /tmp/seed/seed_demo_recruitment.sql -f /tmp/seed/seed_demo_followup.sql
   ```

   Se você alterou `DB_USER` no `.env`, substitua `clinicalstudypb` após `-U` pelo valor configurado.

   > **Repetibilidade e validade do código:** os quatro scripts não duplicam registros se forem executados novamente. Reexecutar `seed_demo_followup.sql` renova a validade de **72 horas** do código `CONVITE-DEMO-2026` enquanto ele ainda não tiver sido utilizado. Para apagar o banco e recomeçar uma demonstração limpa, rode `docker compose down -v` e repita os passos 3 e 4.

---

## 2. Contas fictícias de participante da seed

**Não utilize credenciais reais.** Todas as contas e códigos de ativação usados na demonstração vêm dos scripts `backend/dev/seed_demo_users.sql` e `backend/dev/seed_demo_followup.sql`:

| Conta | E-mail | Credencial / código | O que existe na seed e para que usar no app |
| --- | --- | --- | --- |
| **Candidato com convite pendente** (`Rosa Helena Prates`) | `convite@clinicalstudypb.test` | Sem senha inicial; código **`CONVITE-DEMO-2026`** (uso único, válido por 72 h a partir da carga) | Criada por `seed_demo_followup.sql` ainda sem ativação. Possui convite elegível (`CONSENT_PENDING`) em **Vacina contra influenza em idosos**. Demonstra ativação por código, troca obrigatória de senha e decisão de consentimento (`RF02`, `RF03`, `RF10`). |
| **Participante ativo** (`Participante Demo`) | `participante@clinicalstudypb.test` | Senha **`Demo@Clinical2026`** | Conta já ativa de `seed_demo_users.sql` vinculada por `seed_demo_followup.sql`. Participa de **Controle glicêmico no diabetes tipo 2** (`Em execução`) com 1 visita em **Próximas** (*Acompanhamento de 3 meses*, `05/01/2027`) e 1 visita em **Histórico** (*Avaliação inicial*, `05/10/2026`), além de 1 convite `CONSENT_PENDING` em **Vacina contra influenza em idosos**. Demonstra `RF10`, `RF17` e `RF18` diretamente. |
| **Perfis da equipe** (uso apenas Web) | `coordenador@clinicalstudypb.test`, `pesquisador@clinicalstudypb.test`, `administrador@clinicalstudypb.test` | Senha **`Demo@Clinical2026`** | Criadas por `seed_demo_users.sql`. O aplicativo **recusa perfis não participantes** sem criar sessão (`RF03`); use `coordenador@clinicalstudypb.test` na Web (`http://localhost:5173`) apenas se quiser incluir o candidato após o aceite no app. |

> **Nota:** os demais candidatos sintéticos da carga (`demo-candidate-…@clinicalstudypb.invalid`) não são contas ativas para login no aplicativo.

---

## 3. Instalar o aplicativo, configurar a URL da API e executar no emulador

Todos os comandos abaixo partem da pasta `mobile/`:

```powershell
cd mobile
npm ci
```

Se precisar alternar para a branch principal antes da instalação em uma máquina limpa, execute na raiz: `git switch development; git pull --ff-only`.

### Configurar a URL da API

O aplicativo exige `EXPO_PUBLIC_API_BASE_URL` para qualquer chamada HTTP. Copie [`.env.example`](.env.example) para `.env` dentro de `mobile/` (o `.env` é local e ignorado pelo Git):

```powershell
Copy-Item .env.example .env
```

*(Em macOS/Linux: `cp .env.example .env`.)*

O modelo [`.env.example`](.env.example) já vem configurado para o emulador Android (`http://10.0.2.2:8080/api`). A URL deve terminar em `/api` conforme o ambiente:

| Ambiente de execução | Valor de `EXPO_PUBLIC_API_BASE_URL` | Observação |
| --- | --- | --- |
| **Emulador Android** (Android Studio) | `http://10.0.2.2:8080/api` | `10.0.2.2` alcança o `localhost` da máquina host. |
| **Telefone físico** (Expo Go na mesma Wi-Fi) | `http://<IPv4-da-maquina>:8080/api` | Ex.: `http://192.168.1.50:8080/api`. Não use `10.0.2.2` nem `localhost` no telefone. |
| **iOS Simulator** | `http://localhost:8080/api` | Apenas se testar em macOS. |

Se precisar sobrescrever o `.env` apenas na sessão atual do terminal, defina a variável antes de iniciar o Expo (no PowerShell):

```powershell
$env:EXPO_PUBLIC_API_BASE_URL = "http://10.0.2.2:8080/api"
npm.cmd run android
```

*(Em macOS/Linux: `EXPO_PUBLIC_API_BASE_URL="http://10.0.2.2:8080/api" npm run android`.)*

A variável do processo tem precedência sobre o `.env`. Sempre reinicie o Expo (`Ctrl+C` e `npm.cmd start -- --clear`) após mudar `EXPO_PUBLIC_API_BASE_URL`. Nunca armazene senhas, códigos de ativação ou tokens em variáveis `EXPO_PUBLIC_*`.

Os caminhos relativos consumidos pela base `/api` são: `auth/login`, `auth/activation`, `auth/password`, `auth/logout`, `me/invitations`, `me/invitations/{candidateId}`, `me/invitations/{candidateId}/decision`, `me/studies` e `me/visits`.

### Emulador Android

1. Abra o **Android Studio → Device Manager**, inicie um dispositivo virtual (por exemplo, Pixel 6 com API 34) e aguarde o sistema Android terminar de inicializar.
2. No terminal, dentro de `mobile/`, execute:

   ```powershell
   npm.cmd run android
   ```

   Também é possível rodar `npm.cmd start` e pressionar `a` no terminal do Expo. Em uma instalação limpa (sem pasta `mobile/android/`), o Expo CLI instala/abre o **Expo Go** no emulador e carrega o aplicativo automaticamente. Caso já tenha rodado o build nativo do E2E (`mobile/android/` gerada) e queira voltar ao Expo Go em desenvolvimento, remova `mobile/android/` ou use `npx.cmd expo start --go --android`. Mantenha esse terminal aberto enquanto usa o app. Para limpar o cache do bundler: `npm.cmd start -- --clear`.

Se o emulador já tiver uma sessão salva de execução anterior no `expo-secure-store`, toque em **Sair → Sair da conta** na tela inicial para voltar à tela de login.

### Telefone físico com Expo Go

1. Conecte o computador e o telefone à mesma rede Wi-Fi e ajuste `EXPO_PUBLIC_API_BASE_URL` em `mobile/.env` para o IPv4 da máquina na rede (`http://192.168.x.x:8080/api`).
2. Na pasta `mobile/`, rode `npm.cmd start` (use `npm.cmd start -- --tunnel` apenas se o Wi-Fi bloquear conexões locais).
3. Abra o **Expo Go** (compatível com **Expo SDK 58**) no telefone e leia o QR code exibido no terminal.

---

## Roteiro de demonstração

Este roteiro percorre todo o fluxo do participante no emulador usando **exclusivamente a seed padrão** (passo 1).

### Fluxo A — Ativação por código, troca obrigatória de senha e decisão de convite (`convite@clinicalstudypb.test`)

1. Na tela **Login**, toque em **Ativar conta** (ao lado de *Primeiro acesso?*).
2. Na tela **Primeiro acesso**:
   - Em **E-mail cadastrado**, informe `convite@clinicalstudypb.test`.
   - Em **Código de ativação**, informe `CONVITE-DEMO-2026` (diferencia maiúsculas e minúsculas).
   - Toque em **Ativar minha conta**.
3. O aplicativo cria uma sessão restrita (`mustChangePassword = true`) e abre obrigatoriamente **Defina sua nova senha**. Enquanto a senha inicial não for definida, o app mantém todas as rotas privadas (`Ver convites`, `Ver estudos` e `Ver visitas`) bloqueadas e redireciona para essa tela.
4. Digite uma nova senha fictícia de **8 a 72 caracteres, com pelo menos uma letra e um número** (por exemplo, `NovaSenha2026`), repita em **Confirmar nova senha** e toque em **Definir senha**.
5. Já na tela inicial, confirme a saudação **Olá, Rosa!** e toque em **Ver convites**.
6. Abra o convite em **Vacina contra influenza em idosos** (`Aguardando sua decisão`):
   - Confira objetivo, pesquisador responsável, período civil (`DD/MM/AAAA`), visitas previstas e o aviso de que o consentimento é simulado e acadêmico.
   - Toque em **Aceitar convite** (ou **Recusar convite**), experimente **Cancelar** na confirmação para verificar que nada é enviado e, em seguida, confirme a decisão (**Aceitar** ou **Recusar**).
   - Confira a mudança imediata para modo somente leitura (**Consentimento aceito** ou **Consentimento recusado**) — inclusive ao voltar e reabrir o detalhe.
7. *(Opcional)* Confira as garantias do fluxo:
   - Toque em **Ver estudos** para confirmar que aceitar o convite ainda não inclui a pessoa no estudo (aparece a mensagem de conta sem inclusão, com atalho para convites).
   - Toque em **Sair → Sair da conta**, volte a **Ativar conta** e tente enviar `CONVITE-DEMO-2026` novamente: o backend recusa o código já consumido.
   - *(Opcional na Web)* Caso tenha a aplicação Web aberta (`http://localhost:5173`), entre com `coordenador@clinicalstudypb.test` / `Demo@Clinical2026`, abra **Recrutamento → Vacina contra influenza em idosos**, clique em **Atualizar lista** e veja a situação atualizada de Rosa Helena Prates (se você aceitou o convite, o botão **Incluir participante** ficará habilitado).

### Fluxo B — Login de participante ativo, estudos e visitas (`participante@clinicalstudypb.test`)

1. Na tela **Login**, informe `participante@clinicalstudypb.test` e `Demo@Clinical2026`, e toque em **Entrar**.
2. Na tela inicial, confirme **Olá, Participante!** e o e-mail `participante@clinicalstudypb.test`.
3. **Estudos (`RF17`):** toque em **Ver estudos**:
   - Na lista **Meus estudos**, confira o cartão **Controle glicêmico no diabetes tipo 2** exibindo em selos separados o estado do estudo (**Em execução**) e a situação da participação (**Participação ativa**), com a data de inclusão.
   - Toque no cartão para abrir o detalhe: confira objetivo, pesquisador responsável, período civil (`03/08/2026 a 30/07/2027`) e o protocolo das três visitas previstas (**Avaliação inicial**, **Acompanhamento de 3 meses** e **Acompanhamento de 6 meses**), identificadas pelo rótulo **Data prevista** e suas atividades.
4. **Visitas e histórico (`RF18`):** volte ao início e toque em **Ver visitas**:
   - Na aba **Próximas**, confira **Acompanhamento de 3 meses** (`Agendada`, `05/01/2027`, `Estudo: Controle glicêmico no diabetes tipo 2`). Toque no cartão para abrir **Detalhes da visita**, conferir **Atividades previstas** (*Hemoglobina glicada — Coleta de sangue em jejum*) e o bloco informativo reservado para **RF19** (sem botões ativos para confirmar presença ou solicitar reagendamento).
   - Volte à lista e alterne para a aba **Histórico**: confira **Avaliação inicial** (`Realizada`, `05/10/2026`) e abra o detalhe para ver **Desfecho registrado em**, **Atividades previstas** (*Hemoglobina glicada* e *Orientação nutricional*) e o aviso de registro finalizado.
5. *(Opcional)* Volte ao início e confira **Ver convites** (convite `Aguardando sua decisão` em **Vacina contra influenza em idosos**), valide **Trocar senha** (modo de conta ativa exige senha atual) ou teste a recusa de perfil não participante tentando entrar com `coordenador@clinicalstudypb.test` / `Demo@Clinical2026`.

### Como repetir a demonstração do zero

Como o consumo do código `CONVITE-DEMO-2026`, a nova senha de `convite@clinicalstudypb.test` e a decisão do convite persistem no PostgreSQL, execute na raiz do repositório para zerar o banco e recarregar os dados originais:

```powershell
docker compose down -v
docker compose up -d --build
```

Aguarde o backend iniciar (`/v3/api-docs` retornar `200`) e execute novamente os comandos de carga das 4 seeds da seção [1. Subir o backend e carregar as seeds fictícias](#1-subir-o-backend-e-carregar-as-seeds-fictícias). Não registre senhas, códigos de ativação, JWTs ou dados reais em capturas ou logs.

---

## Testes Jest e verificações locais

Na pasta `mobile/`, todos os testes de unidade e componentes usam **HTTP inteiramente simulado** (sem chamadas reais de rede):

```powershell
npm.cmd test -- --runInBand
npm.cmd run test:report -- --runInBand --coverage
npx.cmd tsc --noEmit
npx.cmd expo install --check
```

*(Em macOS/Linux: substitua `npm.cmd` por `npm` e `npx.cmd` por `npx`.)*

- **`npm test`:** executa as 23 suítes Jest com o preset `jest-expo` (atualmente **260 testes** cobrindo login, ativação por código, troca obrigatória de senha e bloqueio pré-troca, sessão/SecureStore/expiração, convites, estudos, visitas e histórico, cartão compartilhado de visitas previstas, navegação protegida e cliente HTTP).
- **`npm run test:report -- --runInBand --coverage`:** cria `test-reports/`, gera `test-reports/jest.json` e aplica a meta mínima global de **80% de linhas** (`coverageThreshold` em [`package.json`](package.json)). As pastas `test-reports/` e `coverage/` são ignoradas pelo Git.
- **`npx tsc --noEmit`:** verifica a tipagem TypeScript de todo o aplicativo e dos testes.
- **`npx expo install --check`:** compara as dependências com o catálogo do Expo SDK 58 (não há script de lint separado nesta base). Não atualize o lockfile automaticamente sem validar testes e Android.
- **CI e rastreabilidade:** no GitHub Actions, o workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) instala via `npm ci` e executa `npm run test:report -- --coverage`, publicando `mobile-coverage` e `resultados-mobile`. A matriz por RF está em [`../releases/release2/README.md`](../releases/release2/README.md#rastreabilidade-e-testes-do-aplicativo-mobile-t234) e o último registro completo está em [`../docs/test-runs/2026-11-21_22-15_T23-4_mobile-jest.md`](../docs/test-runs/2026-11-21_22-15_T23-4_mobile-jest.md).

### Auditoria de dependências

A auditoria registrada em 24/10/2026, quando o projeto usava `expo@58.0.19`, reportou cinco ocorrências de severidade alta associadas a dois pacotes transitivos: `node-forge@1.4.0` e `zod@3.25.76`, dentro da cadeia `expo@58.0.19` → `@expo/cli@58.1.15`. A mesma auditoria com `--omit=dev` manteve os avisos porque o Expo está declarado como dependência de produção. Esses pacotes pertencem ao caminho de ferramentas do Expo/CLI e não são importados diretamente pelas telas ou serviços do app; o risco identificado é na cadeia de desenvolvimento/build.

Os avisos são [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) para node-forge e [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) para Zod. Na data da verificação, o advisory de node-forge não indicava versão corrigida; o fix de Zod requer versão 4.6.6 ou superior. `npm audit fix --force` propõe trocar Expo SDK 58 por Expo 54.0.38, uma atualização incompatível com a stack atual, então não foi aplicado. Encaminhamento: acompanhar uma atualização compatível do Expo CLI/dependências no SDK usado pelo projeto e reexecutar `npm audit`; não forçar downgrade nem override de major sem validar compatibilidade. A auditoria não foi refeita após a aplicação dos patches compatíveis do SDK 58 em `package.json`.

---

## Testes E2E (Maestro)

O fluxo [`e2e/maestro/login-proximas-visitas.yaml`](e2e/maestro/login-proximas-visitas.yaml) (`E2E-MOB-01`, RF02 e RF18) executa o APK de release no emulador Android contra o backend e o PostgreSQL reais da stack isolada [`../compose.e2e.yaml`](../compose.e2e.yaml) (porta `18080`, banco descartável em memória com a seed padrão). O teste entra com `participante@clinicalstudypb.test`, confere a saudação inicial, abre **Ver visitas** e valida **Acompanhamento de 3 meses** em **Próximas** e **Avaliação inicial** em **Histórico**, salvando capturas de cada aba. Rastreabilidade e resultados completos: [`docs/tests/rastreabilidade-e2e-mobile.md`](../docs/tests/rastreabilidade-e2e-mobile.md).

### Decisão de ferramenta: Maestro

Avaliamos o Maestro e o Detox com o projeto atual (Expo SDK 58, React Native 0.88, Expo Router, pasta `android/` gerada por `expo prebuild` e fora do Git). Escolhemos o **Maestro**:

| Critério | Maestro | Detox |
| --- | --- | --- |
| Mudanças no app | Nenhuma no código nativo. Testa o APK instalado, como caixa-preta. Só ganhamos `testID` nos campos do login. | Exige o config plugin `@config-plugins/detox`, que altera o `build.gradle`, adiciona o runner de instrumentação, regras de ProGuard e um APK de teste próprio, com versões casadas com o SDK do Expo. |
| Escrita dos testes | Fluxos em YAML, por texto visível, rótulo de acessibilidade ou `testID`, com espera automática. | Testes em JavaScript com Jest e sincronização gray-box. Mais controle, mas mais configuração. |
| Rodar no Windows | CLI nativo no Windows (zip + Java 17), sem WSL. | Foco em macOS e Linux; no Windows há relatos de problemas e pouco suporte oficial. |
| CI | Um `curl` instala o CLI; o fluxo roda num emulador comum do GitHub Actions e gera JUnit (`--format=JUNIT`). | Também roda em CI, mas com o build de teste e a configuração do Detox mantidos junto com cada atualização do SDK. |

O Detox ganha quando o time precisa de sincronização fina com o React Native ou de testes em JavaScript, o que não é o caso de um fluxo de login e listagem. Com o Maestro, a manutenção fica no YAML e não no build nativo, e o mesmo comando roda na máquina de quem testa e na CI.

### Rodar localmente

Pré-requisitos: Android Studio com um emulador (API 34, `x86_64`), JDK 17, Docker e o [Maestro CLI](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli). No Windows, baixe o `maestro.zip` da [última versão](https://github.com/mobile-dev-inc/maestro/releases/latest), extraia e adicione a pasta `bin` ao `PATH`; no macOS e no Linux, use `curl -fsSL "https://get.maestro.mobile.dev" | bash`. Confira com `maestro --version`.

1. Na **raiz do repositório**, suba a stack descartável de E2E (porta `18080`, isolada da stack comum) com a seed padrão:

   ```powershell
   docker compose -f compose.e2e.yaml up -d --build --wait db backend
   docker compose -f compose.e2e.yaml run --rm seed
   ```

2. Com o emulador Android aberto e as dependências instaladas (`npm ci` em `mobile/`), gere e instale o APK de release apontando para `http://10.0.2.2:18080/api`. Na pasta `mobile/`:

   ```powershell
   $env:EXPO_PUBLIC_API_BASE_URL = "http://10.0.2.2:18080/api"
   $env:CLINICALSTUDYPB_E2E = "1"
   npx.cmd expo prebuild --platform android --clean --no-install
   npx.cmd expo run:android --variant release
   ```

   *(Em bash/macOS/Linux: `EXPO_PUBLIC_API_BASE_URL="http://10.0.2.2:18080/api" CLINICALSTUDYPB_E2E=1 npx expo prebuild --platform android --clean --no-install && npx expo run:android --variant release`.)*

   `CLINICALSTUDYPB_E2E=1` ativa o plugin [`plugins/withE2eCleartextTraffic.js`](plugins/withE2eCleartextTraffic.js), que libera HTTP sem TLS no Android apenas nesse build; um APK de release comum bloqueia HTTP sem HTTPS. Caso volte a gerar um build nativo comum depois do E2E, rode `expo prebuild --clean` sem `CLINICALSTUDYPB_E2E=1` (ou apague `mobile/android/`) para não manter `usesCleartextTraffic="true"` no manifesto local. Além disso, o `prebuild` pode reescrever os scripts `android` e `ios` do `package.json`: desfaça essa alteração antes de commitar (`git checkout package.json`).

3. Execute o fluxo Maestro (na pasta `mobile/`):

   ```powershell
   npm.cmd run test:e2e
   ```

   Para gerar o relatório JUnit e as capturas em `e2e/artefatos/`, como na CI:

   ```powershell
   New-Item -ItemType Directory -Force test-reports, e2e/artefatos | Out-Null
   maestro test --format=JUNIT --output=test-reports/maestro.xml --test-output-dir=e2e/artefatos e2e/maestro
   ```

   *(Em bash/macOS/Linux: `mkdir -p test-reports e2e/artefatos && maestro test --format=JUNIT --output=test-reports/maestro.xml --test-output-dir=e2e/artefatos e2e/maestro`. As pastas `e2e/artefatos/` e `test-reports/` são ignoradas pelo Git.)*

4. Ao final, derrube a stack de teste (na raiz do repositório):

   ```powershell
   docker compose -f compose.e2e.yaml down
   ```

A seed é repetível e `login-proximas-visitas.yaml` apenas lê dados (usando `clearState: true`), podendo ser executado novamente sem recriar o banco.

### Na CI

O workflow [`mobile-e2e.yml`](../.github/workflows/mobile-e2e.yml) repete os mesmos passos num emulador Android (API 34, `x86_64`) do GitHub Actions: sobe `compose.e2e.yaml`, executa a seed, compila o APK de release para `x86_64` com `CLINICALSTUDYPB_E2E=1`, instala o Maestro e executa a suíte, publicando `maestro.xml` e as capturas no artefato `maestro-report`. Fica separado do `ci.yml` pelo tempo maior do build nativo e do emulador (~15–20 min); roda em PRs e pushes para `development` e `main` que alterem `mobile/`, `backend/` ou `compose.e2e.yaml` (e pode ser acionado manualmente via `workflow_dispatch`).

---

## Configuração do Expo e mudanças registradas

Alterações de configuração e empacotamento realizadas no projeto Expo após a entrega inicial da Release 1 ([relatório da T16.13](../releases/release1/tests/t16-13/README.md)):

| Arquivo / escopo | Configuração registrada e motivo |
| --- | --- |
| [`app.json`](app.json) | Define `"scheme": "clinicalstudypb"`, `"android.package": "dev.clinicalstudypb.mobile"` (identificador exigido pelo `expo prebuild` e pelo `appId` do Maestro), `"predictiveBackGestureEnabled": false`, plugins (`expo-router`, `expo-splash-screen`, `expo-image`, `expo-status-bar`, `expo-web-browser`, `expo-secure-store`) e `"experiments": { "typedRoutes": true, "reactCompiler": true }`. |
| [`app.config.js`](app.config.js) | Estende dinamicamente o `app.json` durante build/prebuild. Apenas quando `CLINICALSTUDYPB_E2E === '1'` aplica `withE2eCleartextTraffic`; fora desse contexto devolve o `config` do `app.json` sem alterações. |
| [`plugins/withE2eCleartextTraffic.js`](plugins/withE2eCleartextTraffic.js) | Config plugin (`withAndroidManifest` de `expo/config-plugins`) usado somente no build de E2E para definir `android:usesCleartextTraffic="true"` no `AndroidManifest.xml`, permitindo que o APK de release alcance `http://10.0.2.2:18080/api` no emulador. |
| [`package.json`](package.json) | Patches compatíveis dentro do **Expo SDK 58** aplicados para alinhar catálogo e testes (`@expo/ui ~58.0.29`, `expo ~58.0.26`, `expo-router ~58.0.32`, `expo-web-browser ~58.1.0`, `jest-expo ~58.0.15`, `react-native 0.88.1`), script `test:e2e` e `jest.coverageThreshold.global.lines: 80`. |
| [`.gitignore`](.gitignore) e [`../.gitignore`](../.gitignore) | Mantêm fora do controle de versão as pastas nativas geradas (`/android`, `/ios`), `.expo/`, `e2e/artefatos/`, `test-reports/`, `coverage/` e o `.env` local. |

---

## Estrutura e comportamento das telas

### Telas e serviços (`src/`)

- `src/app/_layout.tsx` monta o `Stack` protegido com `Stack.Protected`. Enquanto a sessão é restaurada, as rotas privadas permanecem bloqueadas e uma camada de carregamento cobre a tela.
- `src/app/login.tsx` é a entrada sem sessão válida (com `testID="login-email"` e `testID="login-password"` usados pelo Maestro) e leva ao primeiro acesso.
- `src/app/activation.tsx` ativa um candidato convidado com e-mail e código (`POST auth/activation`).
- `src/app/change-password.tsx` define a senha inicial de uma sessão restrita (`mustChangePassword = true`) ou troca a senha de uma conta já ativa (`PUT auth/password`).
- `src/app/index.tsx` é o início autenticado, exibindo saudação, dados públicos do participante, aviso de persistência e atalhos para convites, estudos, visitas, troca de senha e saída.
- `src/app/invitations/` (`index.tsx` e `[candidateId].tsx`) lista os convites da própria conta e exibe detalhe com protocolo, datas civis (`YYYY-MM-DD` sem deslocamento de fuso), termo simulado e decisão única (`GRANTED` ou `DECLINED`) via confirmação.
- `src/app/studies/` (`index.tsx` e `[participantId].tsx`) lista os estudos incluídos via `GET /api/me/studies`, mantendo rótulos e selos independentes para `studyStatus` e `participationStatus` (`src/theme/colors.ts`), e exibe detalhe com período civil e visitas previstas (`PlannedVisitCard`).
- `src/app/visits/` (`index.tsx` e `[visitId].tsx`) lista **Próximas** (`SCHEDULED`) e **Histórico** (`DONE`, `ABSENT`, `CANCELLED` com motivo) a partir de `GET /api/me/visits`, e exibe detalhe com atividades previstas do protocolo, desfecho registrado e bloco reservado para `RF19` (fora desta sprint, sem botões ativos).
- `src/auth/AuthProvider.tsx` mantém a sessão em memória, restaura do armazenamento, centraliza `runAuthenticated` e aplica expiração por tempo/primeiro plano e tratamento único de `401` e `403 PASSWORD_CHANGE_REQUIRED`.
- `src/auth/secureSessionStorage.ts` grava apenas token, validade absoluta e dados públicos mínimos do usuário na chave versionada `clinicalstudypb.session.v1` do `expo-secure-store` (senhas e códigos nunca são armazenados; gravação falha mantém sessão apenas em memória com aviso; web sem SecureStore segue ao login).
- `src/services/api/apiClient.ts` executa `apiRequest<T>(path, options)` adicionando `Accept: application/json`, serializando JSON e convertendo respostas fora de 2xx (inclusive corpos vazios ou texto) em `ApiError`.

Para novos recursos protegidos, utilize sempre `runAuthenticated(operation)` fornecido pelo `AuthProvider` em vez de montar o cabeçalho `Authorization` manualmente.

## Handoff entre sprints

Ao assumir Mobile em uma nova sprint:

1. Confira no board o responsável atual, o objetivo da tarefa, dependências e critérios de aceite.
2. Atualize a branch a partir de `development` (`git switch development; git pull --ff-only`), leia as alterações recentes em `mobile/`, `backend/openapi.yaml` e no README principal.
3. Rode `npm ci`, `npm.cmd test -- --runInBand`, `npx.cmd tsc --noEmit` e valide o app no emulador antes de iniciar novas telas.
4. Implemente apenas o fluxo definido pela tarefa e mantenha testes (Jest + E2E Maestro) e documentação alinhados ao comportamento real.
5. Antes do PR, rode as verificações indicadas pela tarefa/CI, evite incluir mudanças automáticas do `expo prebuild` em `package.json` ou segredos reais, e registre limitações ou dependências na descrição do PR.

A pasta `.vscode/` contém recomendações e preferências opcionais do editor; não é necessária para instalar ou executar o app.
