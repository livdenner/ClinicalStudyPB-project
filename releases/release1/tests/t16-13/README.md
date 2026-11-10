# T16.13 — Instalação limpa e aplicativo inicial

Validação concluída em 09/11/2026, fuso America/Fortaleza, a partir do commit `2c6e854a1f5416607e09df916bf0109df427117f` da `development`. Os três critérios de aceitação abaixo foram atendidos.

## Método

O código foi exportado com `git archive` para uma pasta nova, sem `node_modules`, arquivos `.env`, builds ou dados do ambiente de desenvolvimento. A exportação preserva o código versionado do commit indicado. Esta conferência usa uma cópia limpa do código na máquina existente, não uma reinstalação do Windows.

O `.env` foi criado a partir de `.env.example`, com senha local e chave JWT aleatórias. O banco de desenvolvimento existente foi preservado. A stack de validação usa o projeto Compose `clinicalstudypb-t1613`, volume próprio e `DB_HOST_PORT=15433`, opção já oferecida pelo Compose. O backend mantém a porta documentada `8080`.

As correções do guia estão no [README principal](../../../../README.md) e no [README mobile](../../../../mobile/README.md). Segredos locais e arquivos de dependências não fazem parte das evidências versionadas.

## Ambiente

| Ferramenta | Versão observada |
| --- | --- |
| Sistema | Windows, PowerShell |
| Docker Engine | 29.9.2 |
| Docker Compose | v5.6.1 |
| Java | JDK 21.0.7 |
| PostgreSQL | 18.6, imagem `postgres:18` |
| Node.js | 22.23.4 nos testes e servidores; instalação inicial de dependências com o Node 26.13.0 do sistema |
| npm | 10.9.9 com o Node 22 portátil; instalação inicial com npm 11.20.0 |

## Comandos e resultados

Os resultados correspondem à execução desta cópia limpa. Um comando iniciado ou um artefato antigo não equivale a uma aprovação.

| Verificação | Comando ou procedimento | Resultado |
| --- | --- | --- |
| Configuração do Compose | `docker compose -p clinicalstudypb-t1613 config --quiet` | Aprovado |
| Stack limpa | `docker compose -p clinicalstudypb-t1613 up -d --build` | Aprovado: banco saudável e backend em execução, sem reinicializações |
| Migrações | Conferência de `flyway_schema_history` no banco novo | Aprovado: V1–V10 com sucesso |
| Dados fictícios | Comandos de carga documentados no README, repetidos duas vezes | Aprovado: 4 usuários, 5 estudos e 11 visitas; segunda carga sem duplicação |
| Swagger UI e OpenAPI | Requisições HTTP aos endereços documentados | Aprovado: HTTP 200 em ambos |
| Backend | `mvnw.cmd -B -ntp verify` com JDK 21 e Docker | Aprovado: 450 testes, nenhuma falha/erro/skip; Checkstyle e cobertura aprovados |
| Instalação web | `npm ci --no-audit --no-fund` | Aprovado: 309 pacotes |
| Execução e integração web | Vite em `127.0.0.1:5173` e login pelo proxy `/api` | Aprovado: HTTP 200 e autenticação real como `RESEARCHER` |
| Build web | `npm run build` | Aprovado: TypeScript e build Vite |
| Testes web | `npm run test:coverage -- --maxWorkers=1` | Aprovado: 20 arquivos, 157 testes; nenhuma falha; saída 0 |
| Instalação mobile | `npm ci --no-audit --no-fund` | Aprovado: 1.104 pacotes |
| Testes mobile | `npm test -- --runInBand --ci --coverage --json --outputFile=../../logs/mobile-jest.json` | Aprovado: 2 suítes, 2 testes; nenhuma falha |
| TypeScript mobile | `npx tsc --noEmit` | Aprovado, saída 0 |
| Compatibilidade Expo | `npx expo install --check` | Saída 1: consulta online recomenda atualizações de pacotes do SDK 58; não foram aplicadas automaticamente |
| Abertura e navegação Android | Início → Ver estudos → Voltar ao início no Expo Go | Aprovado: execução no celular Android e navegação nos dois sentidos confirmadas pelo usuário |

As opções `--no-audit --no-fund` apenas suprimem a auditoria e a mensagem de financiamento durante a instalação; o lockfile continua determinando as dependências. A primeira tentativa de instalação dentro do sandbox do assistente recebeu `EPERM` na criação de pastas; a execução foi repetida fora desse sandbox, na mesma cópia limpa. Isso é uma restrição da ferramenta de validação, não uma alteração necessária no projeto.

O Node 22 foi obtido do distribuidor oficial, em uma pasta portátil separada, e o SHA256 foi conferido com o manifesto da distribuição. A instalação do Node no Windows não foi substituída.

O JaCoCo mediu **97,27% das linhas**: 891 cobertas e 25 não cobertas. A regra Maven de no mínimo 80% passou. O escopo exclui a classe principal e classes `Configuration`/`Config`, conforme `backend/pom.xml`.

Na execução mobile, a cobertura de linhas foi de 76,47% no conjunto instrumentado, com 100% nas duas telas iniciais. O mínimo de 80% definido na proposta aplica-se ao backend, não a essa métrica mobile. A confirmação de abertura Android foi manual; este relatório não a apresenta como teste E2E automatizado nem como captura de tela.

## Evidências

- [Testes e verificações Maven — trechos conclusivos](backend-verify.txt).
- [Contagem por suíte JUnit](backend-suites.csv).
- [Cobertura JaCoCo por classe](backend-coverage.csv).
- [Serviços HTTP, migrações, banco e autenticação](runtime.txt).
- [Testes e cobertura mobile](mobile-tests.txt).
- [Build web](web-build.txt).
- [Suíte web com um worker e cobertura](web-tests.txt).
- [Tentativa web inicial, encerrada com erro de inicialização de workers](web-tests-inicial.txt).
- [Diagnóstico Expo online](expo-check-online.txt).
- [Conferência Expo offline, com aviso de limitação emitido pela ferramenta](expo-check-offline.txt).

O catálogo online recomendou versões mais novas de 15 dependências, incluindo `expo ~58.0.23` e React Native `0.88.1`. As dependências e o lockfile do projeto foram preservados. O modo offline retornou saída 0 com os dados locais, mas avisou que a validação offline é menos confiável; esse resultado não apaga a recomendação online.

Na primeira execução web, 51 testes passaram, mas sete workers não iniciaram por timeout. Essa execução terminou com erro e não foi considerada uma aprovação da suíte. A repetição limitou o paralelismo a um worker, sem aumentar timeouts ou pular testes, usando a [opção documentada do Vitest](https://vitest.dev/config/maxworkers), e passou nos 157 testes. A cobertura final de linhas web foi de 79,02% (1.006/1.273). A meta de 80% da proposta refere-se ao backend.

O navegador integrado do assistente falhou ao abrir a aba local. A verificação de disponibilidade web e do proxy foi feita por HTTP; isso não é apresentado como um teste de interface no navegador.

## Correções documentais identificadas

- Ordem de primeira execução, pré-requisitos e obtenção do código na raiz.
- Uso de `npm ci` na web para reproduzir o lockfile.
- Versão do TypeScript web alinhada ao manifesto e ao lockfile.
- Instruções mobile na raiz, roteiro de navegação e verificações existentes.
- Geração de chave JWT aleatória com comando compatível com PowerShell.
- Identificação de conflitos de porta e nomes de contêiner antes de iniciar.
- Espera da inicialização do backend antes da carga fictícia.
- Uso de `.\mvnw.cmd` no PowerShell e distinção entre build Docker e testes Maven.
- Conferência do Swagger via `Invoke-WebRequest` no PowerShell.
- README mobile alinhado à execução Jest/cobertura já existente no CI.

## Critérios de aceitação

- [x] Ambiente limpo sobe banco, migrações, dados fictícios, backend e web pelo guia.
- [x] App mobile abre em emulador ou dispositivo e mantém a navegação inicial.
- [x] Testes mobile existentes passam.

O mobile permanece uma estrutura inicial navegável, sem login ou integração de negócio. A execução do app no navegador não será usada como substituto da validação Android.
