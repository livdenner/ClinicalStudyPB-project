# Aplicativo mobile

Aplicativo do participante, desenvolvido em React Native com Expo e TypeScript. O app usa Expo Router para navegação por arquivos. A base desta sprint contém as rotas iniciais e um cliente HTTP reutilizável; as telas de início e estudos são provisórias. Não há login, sessão, armazenamento de token nem integração de negócio nesta etapa.

## Escopo e estado atual

- A rota `src/app/index.tsx` é a tela inicial.
- A rota `src/app/studies.tsx` é um destino provisório usado para demonstrar navegação.
- `src/app/_layout.tsx` define o Stack e os títulos das rotas.
- `src/services/api/apiClient.ts` fornece uma função genérica para requisições JSON e erros HTTP.
- `src/__tests__/navigation.test.tsx` verifica a rota inicial e a navegação para estudos.
- O app pode ser executado no Android com Expo Go; não é necessário criar um build nativo para a tarefa de esqueleto.

O papel de cada integrante pode mudar entre sprints. Antes de iniciar uma alteração, confira no board e no planejamento da sprint quem está responsável por Mobile e quais critérios de aceite pertencem à tarefa atual. Este guia documenta o projeto para qualquer pessoa que assuma essa responsabilidade.

## Pré-requisitos

- Node.js LTS e npm. O arquivo `package-lock.json` fixa a árvore de dependências; use `npm ci` para reproduzir a instalação.
- Android Studio e Android SDK, se for usar um emulador Android; ou um telefone Android com Expo Go compatível com Expo SDK 58.
- Para executar o backend e validar chamadas reais, Docker Compose e as variáveis requeridas na raiz do repositório. Veja o README principal. A tarefa atual não depende do backend.

Confira as versões atuais em `package.json` antes de atualizar ferramentas: Expo SDK `~58.0.19`, React Native `0.88.0`, React `19.3.0` e TypeScript `~6.0.3`. Não atualize versões isoladamente sem validar a compatibilidade com o SDK do Expo.

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

Se a rede bloquear a conexão local, use `npm.cmd start -- --tunnel`; a conexão por túnel pode ser mais lenta e requer que a ferramenta de túnel esteja disponível. No Windows, use `npm.cmd` caso o PowerShell não encontre `npm` diretamente. Em macOS/Linux, os comandos equivalentes são `npm`.

## Configurar a URL da API

Copie `.env.example` para `.env` na pasta `mobile/` somente se for desenvolver chamadas à API. O arquivo `.env` é local e ignorado pelo Git. A variável pública `EXPO_PUBLIC_API_BASE_URL` deve apontar para o backend acessível a partir do dispositivo:

- Android Emulator do Android Studio: `http://10.0.2.2:8080/api/v1` (o endereço especial `10.0.2.2` alcança o computador host).
- Telefone físico: use o IPv4 da máquina na rede local, por exemplo `http://192.168.x.x:8080/api/v1`; não use `10.0.2.2` no telefone.
- iOS Simulator: normalmente `http://localhost:8080/api/v1`.

O Expo injeta variáveis `EXPO_PUBLIC_*` no bundle do app; nunca coloque senhas, chaves privadas ou tokens nesse prefixo nem versione segredos. Reinicie o Expo depois de alterar `.env`.

A integração está deliberadamente pendente: o contrato [OpenAPI](../backend/openapi.yaml) define estudos sob `/api/v1/studies`, enquanto o controller/testes do backend ainda expõem `/api/studies`; autenticação está sob `/api/v1/auth`. Até a equipe alinhar a rota de estudos e os modelos, o esqueleto não deve chamar esses endpoints.

## Verificações locais

Na pasta `mobile/`:

```powershell
npm.cmd test -- --runInBand
npx.cmd tsc --noEmit
npx.cmd expo install --check
```

O teste Jest cobre a navegação inicial. `tsc` verifica o TypeScript e `expo install --check` compara as dependências com o SDK do Expo. Não há script de lint mobile configurado nesta base; a configuração do ESLint e a execução no CI estão planejadas na tarefa de qualidade/DevOps da equipe.

## Cliente HTTP

`apiRequest<T>(path, options)` recebe um caminho relativo à URL base, adiciona `Accept: application/json`, serializa `body` como JSON, lê respostas JSON ou texto e retorna `undefined` para HTTP 204. Para respostas fora de 2xx, lança `ApiError` com `status`, `code` e `fieldErrors` quando esses campos estiverem presentes. O chamador pode passar cabeçalhos, inclusive `Authorization`, mas o cliente não adquire, guarda, renova ou remove credenciais.

Exemplo para uma tarefa futura, depois de confirmar contrato e endpoint:

```ts
const studies = await apiRequest<Study[]>('/studies');
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
