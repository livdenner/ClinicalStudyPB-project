# Aplicativo mobile

Aplicativo do participante, desenvolvido em React Native com Expo e TypeScript. O app usa Expo Router para navegação por arquivos. Nesta etapa, o aplicativo tem login do participante, ativação de primeiro acesso, sessão protegida persistida em armazenamento seguro, troca de senha, consulta/decisão de convites e consulta de estudos em que a conta participa.

## Escopo e estado atual

- `src/app/_layout.tsx` monta o `Stack` protegido. Enquanto a sessão é restaurada, as rotas privadas não são liberadas e uma camada de carregamento cobre a tela.
- `src/app/login.tsx` é a entrada do aplicativo quando não há sessão válida. Também leva à ativação de primeiro acesso.
- `src/app/activation.tsx` ativa um candidato convidado com e-mail e código de ativação.
- `src/app/change-password.tsx` define a senha inicial de uma sessão restrita ou troca a senha de uma conta já ativa.
- `src/app/index.tsx` é o início autenticado, com dados públicos do participante, aviso de persistência, acesso a convites e estudos, troca de senha e saída.
- `src/app/invitations/` lista os convites visíveis da própria conta e exibe o detalhe autorizado, protocolo e termo simulado.
- `src/app/studies/` lista os estudos em que o participante autenticado está incluído (`index.tsx`) e exibe o detalhe protegido com objetivo e visitas previstas (`[participantId].tsx`).
- `src/components/protocol/PlannedVisitCard.tsx` e os selos em `src/components/` (`StatusBadge.tsx`, `studies/StudyStatusBadge.tsx`, `studies/ParticipationStatusBadge.tsx`) são reutilizados entre convites e estudos com tokens semânticos alinhados ao PBI-24 em `src/theme/colors.ts`.
- `src/auth/AuthProvider.tsx` mantém a sessão em memória, restaura do armazenamento, executa login/ativação/troca de senha/logout e centraliza o tratamento de falhas autenticadas.
- `src/auth/secureSessionStorage.ts` grava apenas token, validade absoluta e dados públicos mínimos do usuário em um registro versionado no `expo-secure-store`.
- `src/services/api/apiClient.ts` fornece a requisição JSON e converte respostas fora de 2xx em `ApiError`.
- `src/__tests__/` cobre sessão, armazenamento seguro, cliente HTTP, formulários, política de senha, mensagens de erro, convites, estudos do participante, cartão compartilhado de visitas previstas e a navegação protegida.

O papel de cada integrante pode mudar entre sprints. Antes de iniciar uma alteração, confira no board e no planejamento da sprint quem está responsável por Mobile e quais critérios de aceite pertencem à tarefa atual. Este guia documenta o projeto para qualquer pessoa que assuma essa responsabilidade.

## Pré-requisitos

- Node.js 22 e npm (a versão do Node usada no CI). O arquivo `package-lock.json` fixa a árvore de dependências; use `npm ci` para reproduzir a instalação.
- Android Studio e Android SDK, se for usar um emulador Android; ou um telefone Android com Expo Go compatível com Expo SDK 58.
- Backend em execução e acessível a partir do dispositivo para validar login, ativação e senha. Veja o README principal para subir a stack e conferir as credenciais de demonstração.

Confira as versões atuais em `package.json` antes de atualizar ferramentas: Expo SDK `~58.0.26`, React Native `0.88.1`, React `19.3.0` e TypeScript `~6.0.3`. Não atualize versões isoladamente sem validar a compatibilidade com o SDK do Expo.

## Instalação inicial

Na raiz do repositório, atualize para a base definida pela equipe e abra a pasta mobile:

```powershell
git switch development
git pull --ff-only
cd mobile
npm ci
```

Crie uma branch de tarefa a partir da branch atual conforme a convenção do time antes de alterar arquivos. Se a branch `development` ainda não contém a tarefa ou se o board indicar outra base, siga a orientação da sprint. `npm ci` instala exatamente as versões do lockfile; quando `package.json` mudar intencionalmente, atualize e revise `package-lock.json` junto.

## Executar no Android

### Emulador Android

1. Inicie um dispositivo virtual no Android Studio (Device Manager) e espere a tela inicial do Android carregar.
2. No terminal, dentro de `mobile/`, rode:

```powershell
npm.cmd run android
```

Também é possível iniciar apenas o servidor Metro com `npm.cmd start` e pressionar `a` no terminal do Expo. Mantenha esse terminal aberto enquanto usa o app. Para reiniciar o bundler e limpar seu cache: `npm.cmd start -- --clear`.

### Telefone físico com Expo Go

1. Conecte o computador e o telefone à mesma rede Wi-Fi.
2. Na pasta `mobile/`, rode `npm.cmd start`.
3. Abra o Expo Go no telefone e leia o QR code exibido pelo terminal.

Ao abrir o app pela primeira vez, a tela de login aparece. Para validar o fluxo completo, suba o backend, configure a URL da API e use uma conta de participante ativa. O coordenador, o pesquisador e o administrador são recusados pelo aplicativo; não há sessão utilizável para esses perfis.

Se a rede bloquear a conexão local, use `npm.cmd start -- --tunnel`; a conexão por túnel pode ser mais lenta e requer que a ferramenta de túnel esteja disponível. No Windows, use `npm.cmd` caso a política de execução bloqueie o script `npm.ps1`. Em macOS/Linux, os comandos equivalentes são `npm`.

## Configurar a URL da API

O aplicativo exige `EXPO_PUBLIC_API_BASE_URL` para qualquer chamada HTTP. Copie `.env.example` para `.env` na pasta `mobile/`; o arquivo `.env` é local e ignorado pelo Git. A URL deve terminar na base `/api` e apontar para o backend acessível a partir do dispositivo:

- Android Emulator do Android Studio: `http://10.0.2.2:8080/api` (o endereço especial `10.0.2.2` alcança o computador host).
- Telefone físico: use o IPv4 da máquina na rede local, por exemplo `http://192.168.x.x:8080/api`; não use `10.0.2.2` no telefone.
- iOS Simulator: normalmente `http://localhost:8080/api`.

Se precisar alternar entre emulador e telefone sem editar `.env`, defina a variável no processo antes de iniciar o Expo. No PowerShell:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL = "http://10.0.2.2:8080/api"
npm.cmd start
```

A variável de processo tem precedência sobre o `.env` na inicialização do bundle. Reinicie o Expo depois de qualquer alteração. O Expo injeta variáveis `EXPO_PUBLIC_*` no bundle do app; nunca coloque senhas, chaves privadas ou tokens nesse prefixo nem versione segredos.

Os caminhos usados pelo app são relativos à base `/api`: `auth/login`, `auth/activation`, `auth/password`, `auth/logout`, `me/invitations`, `me/invitations/{candidateId}`, `me/invitations/{candidateId}/decision` e `me/studies`. O [contrato OpenAPI](../backend/openapi.yaml) descreve os endpoints da API, incluindo as rotas do participante autenticado.

## Convites e consentimento simulado

O acesso **Ver convites** na tela inicial consulta apenas os convites da conta participante autenticada. Os caminhos são relativos à base `/api` configurada: `me/invitations`, `me/invitations/{candidateId}` e `me/invitations/{candidateId}/decision`. O aplicativo nunca envia `studyId`, `userId` ou outro identificador como identidade da pessoa.

O detalhe mostra objetivo, período, pesquisador responsável, visitas/atividades previstas e o `termText` devolvido pela API. O aviso de que o consentimento é simulado, acadêmico e sem validade legal acompanha o termo. Datas de protocolo (`YYYY-MM-DD`) são apresentadas como datas civis, sem conversão de fuso horário.

Para um convite em `CONSENT_PENDING`, **Aceitar convite** e **Recusar convite** sempre abrem uma confirmação. Cancelar não envia uma requisição. A confirmação envia exatamente um `POST` com `GRANTED` ou `DECLINED`; somente a resposta da API altera a tela. A decisão é única: resultados `GRANTED` e `DECLINED` permanecem em modo somente leitura, inclusive depois de reabrir o aplicativo. Aceitar não inclui automaticamente a pessoa no estudo nem reserva vaga; a inclusão continua sendo responsabilidade do coordenador, após as demais condições do backend.

Se a resposta ao envio se perder, houver falha de rede/servidor ou `CONSENT_ALREADY_DECIDED`, o app relê o detalhe antes de liberar uma nova confirmação e nunca repete o `POST` automaticamente. Conflitos de candidatura cancelada, consentimento indisponível ou estudo fora de recrutamento bloqueiam nova decisão naquele detalhe e exibem uma mensagem segura. Erros 401 e exigência de troca de senha continuam delegados ao fluxo central de sessão.

### Roteiro manual de demonstração

Use somente contas e dados fictícios em um backend local que contenha as rotas de convites.

1. Crie duas candidaturas elegíveis, ativas e sem decisão, em um estudo em recrutamento; ative as duas contas participantes.
2. Na primeira conta, abra o convite, cancele uma confirmação e confirme o aceite. Reabra o detalhe e confira `GRANTED`, sem ações para mudar a decisão. Com as demais pré-condições satisfeitas, valide a inclusão pelo coordenador.
3. Na segunda conta, confirme a recusa. Reabra o detalhe e confira `DECLINED`, sem ações para mudar a decisão. A tentativa posterior de inclusão pelo coordenador deve ser recusada pelo backend.
4. Confira também uma conta sem convites, uma falha de consulta recuperável, sessão expirada e um convite cancelado enquanto o detalhe estiver aberto.

Não registre senhas, códigos de ativação, JWTs ou dados pessoais reais em capturas, logs ou documentação.

## Estudos do participante

O acesso **Ver estudos** na tela inicial consulta `GET /api/me/studies` (caminho relativo `me/studies`) por meio de `runAuthenticated`. O retorno é um array direto ordenado da inclusão mais recente para a mais antiga e identifica o participante exclusivamente pelo token JWT, sem enviar `userId` ou `participantId` como filtro de conta.

### Complemento de contrato no backend

Como o contrato inicial de `/api/me/studies` ainda não trazia o protocolo de visitas previstas, esta entrega acrescentou `plannedVisits` de forma aditiva em `ParticipantStudy` (sem alterar rotas existentes nem criar migração), reutilizando `PlannedVisitLookup` apenas para os estudos em que a conta autenticada participa e retornando `[]` quando não há visitas cadastradas. Antes de validar no dispositivo ou emulador com Docker Compose, reconstrua o serviço backend preservando o banco:

```powershell
docker compose up -d --build backend
```

### Regras de exibição e estados

- **Separação de conceitos e cores semânticas (PBI-24):** `studyStatus` (`PLANNING`, `RECRUITMENT`, `EXECUTION`, `CLOSED`, `CANCELLED` ou desconhecido neutro) e `participationStatus` (`ACTIVE` informativo ou `WITHDRAWN` neutro) possuem rótulos e selos independentes em `src/theme/colors.ts`. Verde de sucesso não é usado para estado de estudo. Participações retiradas (`WITHDRAWN`) e estudos `CLOSED` ou `CANCELLED` continuam visíveis na lista e no detalhe.
- **Lista (`/studies`):** exibe título, estado do estudo, situação da participação e data/hora de inclusão (`includedAt`, mais `withdrawnAt` quando retirada). Conta sem inclusão exibe orientação informando que a inclusão é realizada pela coordenação, com atalho para **Ver convites**; falhas de rede/servidor ou payload inválido exibem mensagem segura e botão **Tentar novamente** sem mascarar o erro como lista vazia. A consulta é refeita ao retornar ao foco e cancelada ao sair da tela.
- **Detalhe (`/studies/[participantId]`):** resolve os dados exclusivamente a partir de `GET /api/me/studies` (funcionando também em abertura direta/restauração), exibindo objetivo, pesquisador responsável, período civil (`startDate` e `endDate` em `YYYY-MM-DD`, sem conversão de fuso) e protocolo de visitas previstas reutilizando `PlannedVisitCard`. As datas usam explicitamente o rótulo **Data prevista**, diferenciando protocolo de visitas agendadas (fora do escopo desta entrega). Identificador inválido ou participação ausente exibem mensagem própria e retorno à lista.
- **Sessão e privacidade:** expiração (`401`) e troca obrigatória de senha (`403 PASSWORD_CHANGE_REQUIRED`) seguem o fluxo central do `AuthProvider`; o estado da lista e do detalhe é limpo na troca de conta e respostas tardias ou canceladas são descartadas.

### Roteiro manual de demonstração

Use somente contas e dados fictícios em um ambiente com o backend atualizado.

1. Prepare **dois estudos distintos** em `RECRUITMENT`, cada um com critérios de inclusão/exclusão, capacidade disponível e visitas previstas com atividades (incluindo ao menos uma visita sem agendamento em `/api/me/visits`, além de testar opcionalmente um protocolo sem visitas).
2. Cadastre candidaturas para a **mesma conta participante** nos dois estudos, conclua o primeiro acesso (`auth/activation` + `PUT auth/password`), avalie elegibilidade e registre o aceite do convite (`GRANTED`) na tela de convites. Antes da inclusão pelo coordenador, confirme que aceitar o convite ainda não faz o estudo aparecer em **Ver estudos**.
3. Realize a inclusão pelo coordenador nos dois estudos (e opcionalmente altere o estado de um deles para `EXECUTION`, ou registre retirada/encerramento) para conferir selos distintos da tabela do PBI-24.
4. Na conta incluída, abra **Ver estudos** e confira **os dois estudos**, seus títulos, selos separados (estado do estudo e situação da participação) e datas reais de inclusão. Toque em cada estudo para conferir objetivo, pesquisador responsável, período civil e as visitas previstas com **Data prevista** e atividades (inclusive a visita sem agendamento).
5. Entre com uma **conta de controle sem inclusão** e confirme a orientação de lista vazia (sem cartões fictícios) e o atalho para convites. Se usar outra conta com inclusão própria, confirme o isolamento após **Sair** e entrar novamente (nenhum cartão da conta anterior pode permanecer).
6. Simule indisponibilidade temporária do backend e confira mensagem de erro + **Tentar novamente**; restaure o serviço e repita o carregamento com sucesso. Confira também retorno pela navegação e bloqueio quando a sessão expirar ou exigir troca de senha.
7. Para registrar evidências reais após a execução manual no dispositivo/emulador, salve o resumo e capturas selecionadas em `docs/test-runs/` com links relativos, data, commit e comandos executados, sem expor códigos de ativação, senhas, JWTs ou dados pessoais reais.

## Fluxo de autenticação

### Login

A tela de login valida e-mail e senha localmente e envia `POST auth/login`. A senha é transmitida exatamente como digitada, sem aparo ou transformação. Falhas de credencial usam uma mensagem genérica, sem revelar se o e-mail existe. A sessão só é criada para o perfil `PARTICIPANT`; os demais perfis recebem acesso negado e nenhuma sessão é mantida em memória ou no armazenamento.

### Primeiro acesso

Em **Ativar conta**, o candidato informa o e-mail cadastrado e o código de ativação recebido (`POST auth/activation`). O código é apenas aparado nas extremidades; maiúsculas, minúsculas e conteúdo interno são preservados. A resposta é uma sessão restrita (`mustChangePassword = true`), que só permite definir a senha inicial ou sair. Outras rotas privadas ficam bloqueadas até a senha ser definida.

### Senha restrita e troca de senha

Com `mustChangePassword = true`, o app mostra apenas a definição de senha e a opção **Sair**. A nova senha precisa ter de 8 a 72 caracteres, com pelo menos uma letra e um número, e não é aparada nem convertida. A confirmação existe apenas na interface e não é enviada. Em `PUT auth/password`, o modo de primeiro acesso não envia `currentPassword`; a troca de uma conta ativa exige a senha atual. A resposta substitui a sessão anterior, já sem a restrição, antes de voltar ao início.

### Expiração e logout

O vencimento é absoluto, calculado a partir de `expiresIn` no recebimento e gravado junto com a sessão. Um timer encerra a sessão no prazo e, quando o app volta ao primeiro plano, o prazo é conferido novamente porque o sistema pode suspender timers em segundo plano. Um 401 em chamada autenticada invalida a sessão uma única vez, mesmo com respostas simultâneas ou atrasadas. Um `403 PASSWORD_CHANGE_REQUIRED` apenas restringe a sessão; `FORBIDDEN`, falha de rede e erro 5xx não apagam a sessão. Sair limpa a sessão local primeiro e só depois tenta confirmar o logout na API; uma falha nessa confirmação não mantém o acesso no dispositivo.

### Perfis não participantes

Coordenador, pesquisador e administrador são recusados no login e na restauração de sessão. Uma sessão persistida de perfil diferente de `PARTICIPANT` é descartada e o app volta ao login.

## Sessão e armazenamento seguro

A sessão fica em memória e em um registro versionado no `expo-secure-store`, na chave `clinicalstudypb.session.v1`. Apenas o token, o instante absoluto de vencimento e os dados públicos do usuário (`id`, `name`, `email`, `role`, `active`, `mustChangePassword`) são gravados. Senhas e códigos de ativação nunca são armazenados.

- Registros corrompidos, de versão desconhecida ou ilegíveis são descartados e o app volta ao login com aviso genérico.
- Se a remoção nativa falhar, o registro é substituído por um marcador de revogação sem token; a próxima leitura o trata como armazenamento vazio, evitando ressuscitar a sessão.
- Se a gravação falhar, a sessão continua em memória e a interface avisa que, ao fechar o app, será necessário entrar novamente.
- Na web, o SecureStore não está disponível; a leitura informa indisponibilidade e o app segue para o login. O alvo desta tarefa é Android.

Os estados de sessão são `loading`, `anonymous` e `authenticated`. As rotas privadas usam `Stack.Protected` e só são liberadas após a restauração terminar.

## Verificações locais

Na pasta `mobile/`:

```powershell
npm.cmd test -- --runInBand
npm.cmd run test:report -- --runInBand --coverage
npx.cmd tsc --noEmit
npx.cmd expo install --check
```

- `npm test` executa o Jest com o preset `jest-expo`.
- `npm run test:report` cria `test-reports/` e grava o JSON usado pelo relatório de execução (`test-reports/jest.json`). `test-reports/` e `coverage/` são ignorados pelo Git.
- `tsc --noEmit` verifica o TypeScript.
- `expo install --check` compara as dependências com o catálogo do SDK do Expo.

Os testes Jest cobrem login, ativação, troca de senha, expiração, persistência segura, tratamento de 401 e concorrência de sessão, convites, estudos do participante, cartão compartilhado de visitas previstas, navegação protegida e cliente HTTP. Não há script de lint mobile configurado nesta base. O CI instala pelo lockfile e executa `npm run test:report -- --coverage`, publicando os artefatos `mobile-coverage` e `resultados-mobile`.

O comando `expo install --check` pode recomendar atualizações de pacotes dentro do mesmo SDK ao consultar o catálogo online. Registre as versões e o resultado; não atualize dependências nem o lockfile automaticamente durante a conferência de instalação. Na validação da T16.13, o catálogo recomendou atualizações do SDK 58, enquanto os testes, o TypeScript e a navegação em Android passaram com as versões fixadas. A consulta offline usa os dados locais e não substitui o diagnóstico online. Veja o [relatório da execução](../releases/release1/tests/t16-13/README.md). Nesta task, os patches recomendados dentro do SDK 58 para `@expo/ui`, `expo`, `expo-router`, `expo-web-browser` e `jest-expo` foram aplicados de forma deliberada e os testes foram reexecutados; repita o `expo install --check` após a atualização e registre a saída.

### Auditoria de dependências

A auditoria registrada em 24/10/2026, quando o projeto usava `expo@58.0.19`, reportou cinco ocorrências de severidade alta associadas a dois pacotes transitivos: `node-forge@1.4.0` e `zod@3.25.76`, dentro da cadeia `expo@58.0.19` → `@expo/cli@58.1.15`. A mesma auditoria com `--omit=dev` manteve os avisos porque o Expo está declarado como dependência de produção. Esses pacotes pertencem ao caminho de ferramentas do Expo/CLI e não são importados diretamente pelas telas ou serviços do app; o risco identificado é na cadeia de desenvolvimento/build.

Os avisos são [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) para node-forge e [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) para Zod. Na data da verificação, o advisory de node-forge não indicava versão corrigida; o fix de Zod requer versão 4.6.6 ou superior. `npm audit fix --force` propõe trocar Expo SDK 58 por Expo 54.0.38, uma atualização incompatível com a stack atual, então não foi aplicado. Encaminhamento: acompanhar uma atualização compatível do Expo CLI/dependências no SDK usado pelo projeto e reexecutar `npm audit`; não forçar downgrade nem override de major sem validar compatibilidade. A auditoria não foi refeita após a atualização de dependências desta tarefa.

## Cliente HTTP

`apiRequest<T>(path, options)` recebe um caminho relativo à URL base, adiciona `Accept: application/json`, serializa `body` como JSON, lê respostas JSON ou texto e retorna `undefined` para HTTP 204. Para respostas fora de 2xx, lança `ApiError` com `status`, `code` e `fieldErrors` quando esses campos estiverem presentes. Um erro com corpo vazio, texto ou JSON inválido também vira `ApiError`; o status HTTP é o dado usado pelo tratamento central de 401.

O cliente não adquire, guarda, renova ou remove credenciais. Quem gerencia o token é o `AuthProvider`, por meio de `runAuthenticated(operation)`, que injeta o token da sessão atual e aplica a política de expiração. Para um novo recurso protegido, use esse caminho em vez de montar o cabeçalho manualmente:

```ts
const studies = await runAuthenticated((token) =>
  apiRequest<Study[]>('studies', {
    headers: { Authorization: `Bearer ${token}` },
  }),
);
```

Defina o tipo de resposta e o tratamento de erro junto à funcionalidade que integrar o endpoint; não trate a resposta como confiável sem validar o contrato.

## Handoff entre sprints

Ao assumir Mobile em uma nova sprint:

1. Confira no board o responsável atual, o objetivo da tarefa, dependências e critérios de aceite.
2. Atualize a branch a partir da base acordada pela equipe e leia as alterações recentes em `mobile/`, `backend/openapi.yaml` e no README principal.
3. Rode `npm ci`, abra o app em emulador ou dispositivo e execute Jest e TypeScript antes de começar.
4. Implemente apenas o fluxo definido pela tarefa e mantenha testes e documentação alinhados com o comportamento. Confirme com Backend/QA qualquer divergência de API ou critério.
5. Antes do PR, rode as verificações indicadas pela tarefa/CI, valide os critérios de aceite no dispositivo e registre limitações ou dependências no PR.
6. No fim da sprint, deixe no board/PR o que foi concluído, como reproduzir, testes executados e o próximo bloqueio conhecido, para a pessoa que assumir depois.

A pasta `.vscode/` contém recomendações e preferências opcionais do editor; não é necessária para instalar ou executar o app.
