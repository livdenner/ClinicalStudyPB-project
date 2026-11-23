# T17.8, T19.4 e T20.5 — integracao-pr116-1

- **Terminou em:** 2026-11-23 00:28 (America/Fortaleza)
- **Base:** `6786617`, em merge com origin/development (008dabb), resolução ainda sem commit.
- **Comando executado:** `npm run test:coverage -- --maxWorkers=2`
- **Execução:** automatizada com autorização da usuária; registro gerado a partir do JSON do Vitest.
- **HTTP:** simulado, sem API real ou Docker.
- **Re-rodada de:** `2026-11-21_20-55_TestesWeb_completa-2.md`.
- **Lint:** `npm run lint` concluído sem erros (código de saída 0).
- **Build:** `npm run build` concluído com sucesso (código de saída 0). Vite apresentou apenas o aviso de tamanho dos bundles.
- **Resolução:** os dois testes de retirada T22.3 foram preservados integralmente, assim como os cenários de convite, cancelamento e elegibilidade da PR #116.
- **Cobertura geral de linhas:** 89,50%; todos os 12 arquivos controlados atenderam ao mínimo de 81%.

| Componente controlado | Linhas cobertas |
| --- | --- |
| CardCandidato.tsx | 100% |
| ListaCandidatos.tsx | 100% |
| ModalCancelarCandidatura.tsx | 96,49% |
| ModalConfirmarInclusao.tsx | 84,37% |
| ModalNovoCandidato.tsx | 96,42% |
| ResultadoCadastroCandidato.tsx | 100% |
| FormularioResultadoAtividade.tsx | 100% |
| ListaVisitasAgendadas.tsx | 100% |
| ModalAgendarVisita.tsx | 96,82% |
| ModalDesfechoVisita.tsx | 96,55% |
| ModalResultadosVisita.tsx | 97,29% |
| VisitasParticipante.tsx | 93,18% |

| Teste | Resultado | Observação |
| --- | --- | --- |
| `Visão geral e relatórios de demonstração; visitas integradas (T7.2 / RF13) renderiza a página de Visão geral com indicadores, progresso dos estudos e pendências` | Passou |  |
| `Visão geral e relatórios de demonstração; visitas integradas (T7.2 / RF13) RF13: consulta visitas reais e confirma desfecho usando a versão da visita` | Passou |  |
| `Visão geral e relatórios de demonstração; visitas integradas (T7.2 / RF13) renderiza indicadores, funil de recrutamento e resumo por estudo em Relatórios` | Passou |  |
| `T24.2: acompanhamento concluído usa a cor de sucesso` | Passou |  |
| `persiste token e usuário apenas na sessão da aba e recupera a sessão após recarga` | Passou |  |
| `descarta a sessão antiga compartilhada sem autenticar a aba com ela` | Passou |  |
| `remove a sessão legada ao salvar um novo login` | Passou |  |
| `limpa somente a chave de autenticação no logout` | Passou |  |
| `descarta sessão inválida sem quebrar o login` | Passou |  |
| `descarta sessão inválida sem quebrar o login` | Passou |  |
| `expiração remove apenas a sessão da aba` | Passou |  |
| `localStorage bloqueado não impede carregar a sessão da aba` | Passou |  |
| `integração HTTP de estudos altera o estado pelo endpoint dedicado com JWT e usa a resposta da API` | Passou |  |
| `integração HTTP de estudos consulta um estudo pelo ID com JWT e sinal de cancelamento` | Passou |  |
| `integração HTTP de estudos lista os dados reais com JWT e sinal de cancelamento` | Passou |  |
| `integração HTTP de estudos envia somente o contrato implementado no cadastro` | Passou |  |
| `integração HTTP de estudos envia somente o contrato implementado no edição` | Passou |  |
| `integração HTTP de estudos preserva a regra de negócio retornada pelo backend` | Passou |  |
| `integração HTTP de estudos propaga a falta de permissão sem usar dados mock` | Passou |  |
| `registra a retirada no participante e estudo corretos com motivo e JWT` | Passou |  |
| `preserva o erro de conflito retornado pelo backend` | Passou |  |
| `Rotas protegidas e menu por perfil (T5.2) redireciona usuário não autenticado para /login ao acessar rota protegida` | Passou |  |
| `Rotas protegidas e menu por perfil (T5.2) exibe apenas os itens de menu permitidos para o perfil RESEARCHER` | Passou |  |
| `Rotas protegidas e menu por perfil (T5.2) exibe apenas os itens de menu permitidos para o perfil ADMINISTRATOR e bloqueia /estudos com 403` | Passou |  |
| `Rotas protegidas e menu por perfil (T5.2) bloqueia acesso direto de RESEARCHER à rota /usuarios com página 403` | Passou |  |
| `Rotas protegidas e menu por perfil (T5.2) bloqueia acesso direto de COORDINATOR a /usuarios sem consultar a API` | Passou |  |
| `Rotas protegidas e menu por perfil (T5.2) encaminha PARTICIPANT autenticado para tela 403 sem itens administrativos no menu` | Passou |  |
| `BuscaFiltroEstudos exibe a busca atual e informa a digitação e a limpeza pelo callback` | Passou |  |
| `T24.1: agrupa apenas as transições permitidas em PLANNING` | Passou |  |
| `T24.1: agrupa apenas as transições permitidas em RECRUITMENT` | Passou |  |
| `T24.1: agrupa apenas as transições permitidas em EXECUTION` | Passou |  |
| `T24.1: agrupa apenas as transições permitidas em CANCELLED` | Passou |  |
| `T24.1: agrupa apenas as transições permitidas em CLOSED` | Passou |  |
| `T24.1: oculta ações de alteração para COORDINATOR de id 7` | Passou |  |
| `T24.1: oculta ações de alteração para RESEARCHER de id 99` | Passou |  |
| `T24.1: mantém confirmação externa e recolhe as ações ao selecionar transição` | Passou |  |
| `T24.1: bloqueia alterações durante processamento` | Passou |  |
| `T24.1: não oferece restauração após cancelamento da execução` | Passou |  |
| `CampoData exibe a data recebida em segmentos acessíveis` | Passou |  |
| `CampoData envia a nova data quando o usuário altera um segmento pelo teclado` | Passou |  |
| `CampoData bloqueia o calendário e a alteração pelo teclado quando está desabilitado` | Passou |  |
| `CampoData mostra a mensagem de erro recebida pelo formulário` | Passou |  |
| `exibe visita realizada, resultados e retirada recebidos da T21.1` | Passou |  |
| `permite tentar novamente após erro e orienta sobre histórico vazio` | Passou |  |
| `cancela a consulta ao sair do histórico` | Passou |  |
| `ListaEstudos mostra responsáveis, limites e períodos inclusive quando atravessam o ano` | Passou |  |
| `ListaEstudos encaminha o registro correto ao callback de edição` | Passou |  |
| `ListaEstudos orienta o usuário quando não existem estudos para exibir` | Passou |  |
| `permissões de edição do estudo permite ao responsável salvar em recrutamento sem enviar estado` | Passou |  |
| `permissões de edição do estudo bloqueia a edição por outro pesquisador, inclusive o envio direto do formulário` | Passou |  |
| `permissões de edição do estudo mantém execução, encerrado e cancelado somente leitura para o próprio responsável` | Passou |  |
| `ModalEstudo valida os campos obrigatórios no cadastro e direciona o foco para o nome` | Passou |  |
| `ModalEstudo envia os dados normalizados e preserva o responsável na edição` | Passou |  |
| `ModalEstudo impede salvar o limite inválido 0` | Passou |  |
| `ModalEstudo impede salvar o limite inválido -1` | Passou |  |
| `ModalEstudo impede salvar o limite inválido 1.5` | Passou |  |
| `ModalEstudo impede salvar o limite inválido 1000001` | Passou |  |
| `ModalEstudo aceita o limite máximo de 1.000.000 participantes` | Passou |  |
| `ModalEstudo aceita limite mínimo e datas de início e término iguais` | Passou |  |
| `ModalEstudo chama onFechar ao acionar Cancelar sem enviar dados` | Passou |  |
| `ModalEstudo chama onFechar ao acionar Fechar modal sem enviar dados` | Passou |  |
| `ModalEstudo bloqueia campos, calendários e fechamento enquanto salva` | Passou |  |
| `ModalEstudo mostra o erro de campo da API sem duplicar o resumo e preserva os valores` | Passou |  |
| `ModalEstudo trata HTTP 401 e mantém o formulário disponível` | Passou |  |
| `ModalEstudo trata HTTP 403 e mantém o formulário disponível` | Passou |  |
| `abre o histórico pela lista e retorna sem recarregar os participantes` | Passou |  |
| `consulta apenas o estudo solicitado e diferencia participantes ativos e retirados` | Passou |  |
| `orienta quando o estudo não tem participantes` | Passou |  |
| `recupera uma consulta após erro usando Tentar novamente` | Passou |  |
| `cancela a consulta ao sair do estudo` | Passou |  |
| `registra a retirada no estudo, atualiza o selo e remove a ação sem consultar a lista novamente` | Passou |  |
| `não oferece retirada em estudo CLOSED` | Passou |  |
| `não oferece retirada em estudo CANCELLED` | Passou |  |
| `não oferece retirada ao perfil RESEARCHER` | Passou |  |
| `não oferece retirada ao perfil ADMINISTRATOR` | Passou |  |
| `não oferece retirada ao perfil PARTICIPANT` | Passou |  |
| `oferece retirada só ao participante ativo no estado PLANNING` | Passou |  |
| `oferece retirada só ao participante ativo no estado RECRUITMENT` | Passou |  |
| `oferece retirada só ao participante ativo no estado EXECUTION` | Passou |  |
| `RF09 / RF10 — integração com o andamento (T17.8) RF09-E01: respostas locais completas não antecipam o parecer retornado pela API` | Passou |  |
| `Tela de avaliação de elegibilidade (RF09 - T13.3 / T13.4) renderiza critérios separando visualmente inclusão e exclusão e exibe parecer pendente` | Passou |  |
| `Tela de avaliação de elegibilidade (RF09 - T13.3 / T13.4) envia avaliação parcial apenas com os critérios respondidos e mantém status pendente` | Passou |  |
| `Tela de avaliação de elegibilidade (RF09 - T13.3 / T13.4) envia avaliação completa, confere payload JSON e apresenta visualmente resultado Elegível` | Passou |  |
| `Tela de avaliação de elegibilidade (RF09 - T13.3 / T13.4) apresenta visualmente resultado Inelegível quando critério de exclusão se aplica` | Passou |  |
| `Tela de avaliação de elegibilidade (RF09 - T13.3 / T13.4) trata falha HTTP ao salvar (HTTP 409) e ao carregar sem perder o contexto da tela` | Passou |  |
| `Tela de avaliação de elegibilidade (RF09 - T13.3 / T13.4) bloqueia edição para perfil sem permissão (RESEARCHER) e para estudo fora de recrutamento` | Passou |  |
| `Tela de avaliação de elegibilidade (RF09 - T13.3 / T13.4) exibe aviso claro quando o estudo não possui critérios cadastrados` | Passou |  |
| `RF11-CARD01: bloqueia a inclusão e explica estudo fora do recrutamento` | Passou |  |
| `RF11-CARD01: bloqueia a inclusão e explica sem vagas` | Passou |  |
| `RF11-CARD01: bloqueia a inclusão e explica vagas ainda desconhecidas` | Passou |  |
| `RF08-CARD02: respeita a situação INVITED retornada pela API` | Passou |  |
| `RF08-CARD02: respeita a situação ACTIVE retornada pela API` | Passou |  |
| `RF08-CARD02: respeita a situação CONSENT_PENDING retornada pela API` | Passou |  |
| `RF08-CARD02: respeita a situação GRANTED retornada pela API` | Passou |  |
| `RF08-CARD02: respeita a situação DECLINED retornada pela API` | Passou |  |
| `RF08-CARD02: respeita a situação INCLUDED retornada pela API` | Passou |  |
| `RF08-CARD02: respeita a situação CANCELLED retornada pela API` | Passou |  |
| `RF11-CARD03: não oferece inclusão sem as pré-condições do candidato ({ eligibilityStatus: 'PENDING', …(1) })` | Passou |  |
| `RF11-CARD03: não oferece inclusão sem as pré-condições do candidato ({ …(2) })` | Passou |  |
| `RF11-CARD03: não oferece inclusão sem as pré-condições do candidato ({ eligibilityStatus: 'ELIGIBLE', …(1) })` | Passou |  |
| `RF11-CARD03: não oferece inclusão sem as pré-condições do candidato ({ eligibilityStatus: 'ELIGIBLE', …(1) })` | Passou |  |
| `RF08-CARD04: encaminha o candidato original nas ações sem acrescentar dados de apresentação` | Passou |  |
| `RF08-CARD05: mantém situação e elegibilidade visíveis em modo de consulta` | Passou |  |
| `RF10-CARD06: preserva a decisão final do candidato e o motivo do cancelamento` | Passou |  |
| `RF11-CARD07: não presume recrutamento quando o contexto do estudo não foi informado` | Passou |  |
| `RF11-CARD08: consentimento e elegibilidade não sobrescrevem situação INVITED da API` | Passou |  |
| `RF11-CARD08: consentimento e elegibilidade não sobrescrevem situação ACTIVE da API` | Passou |  |
| `RF11-CARD08: consentimento e elegibilidade não sobrescrevem situação CONSENT_PENDING da API` | Passou |  |
| `RF11-CARD08: consentimento e elegibilidade não sobrescrevem situação DECLINED da API` | Passou |  |
| `RF11-CARD08: consentimento e elegibilidade não sobrescrevem situação INCLUDED da API` | Passou |  |
| `RF11-CARD08: consentimento e elegibilidade não sobrescrevem situação CANCELLED da API` | Passou |  |
| `RF10 — ConsentimentoSimulado adaptado ao andamento da API (T17.8) RF10-CS01: decisão CONSENT_PENDING é consultada sem ação de registrar ou reverter consentimento` | Passou |  |
| `RF10 — ConsentimentoSimulado adaptado ao andamento da API (T17.8) RF10-CS01: decisão GRANTED é consultada sem ação de registrar ou reverter consentimento` | Passou |  |
| `RF10 — ConsentimentoSimulado adaptado ao andamento da API (T17.8) RF10-CS01: decisão DECLINED é consultada sem ação de registrar ou reverter consentimento` | Passou |  |
| `RF10 — ConsentimentoSimulado adaptado ao andamento da API (T17.8) RF10-CS02: atualizar consulta aceite registrado no app e então libera inclusão` | Passou |  |
| `RF10 — ConsentimentoSimulado adaptado ao andamento da API (T17.8) RF10-CS03: pesquisador consulta a decisão final sem controles de escrita` | Passou |  |
| `RF08 / OBS-CANCELAMENTO — T17.8 OBS-C01: motivo vazio não envia POST` | Passou |  |
| `RF08 / OBS-CANCELAMENTO — T17.8 OBS-C01: motivo espaços não envia POST` | Passou |  |
| `RF08 / OBS-CANCELAMENTO — T17.8 OBS-C01: motivo acima de 500 não envia POST` | Passou |  |
| `RF08 / OBS-CANCELAMENTO — T17.8 OBS-C02: aceita limite mínimo do motivo sem espaços externos` | Passou |  |
| `RF08 / OBS-CANCELAMENTO — T17.8 OBS-C02: aceita limite máximo do motivo sem espaços externos` | Passou |  |
| `RF08 / OBS-CANCELAMENTO — T17.8 OBS-C03: conflito CANDIDATE_ALREADY_INCLUDED é literal e atualiza o contexto sem repetir POST` | Passou |  |
| `RF08 / OBS-CANCELAMENTO — T17.8 OBS-C03: conflito CANDIDATE_ALREADY_CANCELLED é literal e atualiza o contexto sem repetir POST` | Passou |  |
| `RF08 / OBS-CANCELAMENTO — T17.8 OBS-C03: conflito STUDY_NOT_RECRUITING é literal e atualiza o contexto sem repetir POST` | Passou |  |
| `RF08 / OBS-CANCELAMENTO — T17.8 OBS-C04: atualização falha bloqueia confirmação e o botão de recuperação não repete POST` | Passou |  |
| `RF08 / OBS-CANCELAMENTO — T17.8 OBS-C05: erro de campo da API é literal e mantém o motivo` | Passou |  |
| `RF08 / OBS-CANCELAMENTO — T17.8 OBS-C06: contexto não permitido (INCLUDED) impede confirmação` | Passou |  |
| `RF08 / OBS-CANCELAMENTO — T17.8 OBS-C06: contexto não permitido (CANCELLED) impede confirmação` | Passou |  |
| `RF08 / OBS-CANCELAMENTO — T17.8 OBS-C06: contexto não permitido (ACTIVE) impede confirmação` | Passou |  |
| `RF08 / OBS-CANCELAMENTO — T17.8 OBS-C07: envio pendente impede envio duplicado e fechamento` | Passou |  |
| `RF08 / OBS-CANCELAMENTO — T17.8 OBS-C08: voltar ou fechar não envia cancelamento` | Passou |  |
| `Confirmação de inclusão (RF11) RF11-IN01: confirmação bloqueada sem aceite, elegibilidade ou vaga ({ consentStatus: 'PENDING', …(3) })` | Passou |  |
| `Confirmação de inclusão (RF11) RF11-IN01: confirmação bloqueada sem aceite, elegibilidade ou vaga ({ consentStatus: 'DECLINED', …(3) })` | Passou |  |
| `Confirmação de inclusão (RF11) RF11-IN01: confirmação bloqueada sem aceite, elegibilidade ou vaga ({ consentStatus: 'GRANTED', …(3) })` | Passou |  |
| `Confirmação de inclusão (RF11) RF11-IN01: confirmação bloqueada sem aceite, elegibilidade ou vaga ({ consentStatus: 'GRANTED', …(3) })` | Passou |  |
| `Confirmação de inclusão (RF11) RF11-IN01: confirmação bloqueada sem aceite, elegibilidade ou vaga ({ consentStatus: 'GRANTED', …(3) })` | Passou |  |
| `Confirmação de inclusão (RF11) mostra o candidato, o estudo e as vagas que restam` | Passou |  |
| `Confirmação de inclusão (RF11) confirma uma única vez mesmo com cliques repetidos` | Passou |  |
| `Confirmação de inclusão (RF11) mantém o modal aberto e mostra o motivo do 409` | Passou |  |
| `Confirmação de inclusão (RF11) mantém o modal aberto e mostra a falta de permissão` | Passou |  |
| `Confirmação de inclusão (RF11) mantém o modal aberto e mostra a sessão expirada` | Passou |  |
| `Confirmação de inclusão (RF11) mantém o modal aberto e mostra o recurso não encontrado` | Passou |  |
| `Confirmação de inclusão (RF11) mantém o modal aberto e mostra a falha de conexão` | Passou |  |
| `Confirmação de inclusão (RF11) fecha sem incluir ao cancelar` | Passou |  |
| `RF08 — cadastro e convite (T17.8) RF08-C01: obrigatórios destacam os quatro campos e focam o primeiro sem HTTP` | Passou |  |
| `RF08 — cadastro e convite (T17.8) RF08-C02: bloqueia e-mail malformado antes do cadastro` | Passou |  |
| `RF08 — cadastro e convite (T17.8) RF08-C02: bloqueia telefone com letras antes do cadastro` | Passou |  |
| `RF08 — cadastro e convite (T17.8) RF08-C02: bloqueia telefone com poucos dígitos antes do cadastro` | Passou |  |
| `RF08 — cadastro e convite (T17.8) RF08-C02: bloqueia idade zero antes do cadastro` | Passou |  |
| `RF08 — cadastro e convite (T17.8) RF08-C02: bloqueia idade acima do limite antes do cadastro` | Passou |  |
| `RF08 — cadastro e convite (T17.8) RF08-C02: bloqueia idade fracionária antes do cadastro` | Passou |  |
| `RF08 — cadastro e convite (T17.8) RF08-C02: bloqueia nome longo antes do cadastro` | Passou |  |
| `RF08 — cadastro e convite (T17.8) RF08-C02: bloqueia e-mail longo antes do cadastro` | Passou |  |
| `RF08 — cadastro e convite (T17.8) RF08-C03: aceita idade limite 1 e normaliza o payload` | Passou |  |
| `RF08 — cadastro e convite (T17.8) RF08-C03: aceita idade limite 130 e normaliza o payload` | Passou |  |
| `RF08 — cadastro e convite (T17.8) RF08-C04: e-mail de conta existente mostra vínculo sem código de ativação` | Passou |  |
| `RF08 — cadastro e convite (T17.8) RF08-C05: mantém campos e exibe literalmente erro geral e de campo da API` | Passou |  |
| `RF08 — cadastro e convite (T17.8) RF08-C06: bloqueia envios e fechamento durante o cadastro pendente` | Passou |  |
| `RF08 — cadastro e convite (T17.8) RF08-C07: cancelar ou fechar antes do envio não cadastra` | Passou |  |
| `Participantes e vagas (RF11) mostra o estudo sem participantes e com todas as vagas livres` | Passou |  |
| `Participantes e vagas (RF11) lista os participantes e desconta as vagas ocupadas` | Passou |  |
| `Participantes e vagas (RF11) avisa quando o limite de vagas foi atingido` | Passou |  |
| `Participantes e vagas (RF11) mostra o carregamento` | Passou |  |
| `Participantes e vagas (RF11) mostra o erro e permite tentar novamente` | Passou |  |
| `RF12 — ações da agenda no painel (T18.5) T21.2/T22.3: reúne quatro ações e preserva as duas consultas para retirados` | Passou |  |
| `RF12 — ações da agenda no painel (T18.5) RF12-PV01: participante ativo oferece agendamento para o participante selecionado` | Passou |  |
| `RF12 — ações da agenda no painel (T18.5) RF12-PV02: participante retirado não recebe ação de agendar e mantém consulta do histórico` | Passou |  |
| `RF12 — ações da agenda no painel (T18.5) RF12-PV03: ausência de autorização para agendar mantém somente a consulta` | Passou |  |
| `RF08 — confirmação do cadastro (T17.8) RF08-R01: convite mostra código único, validade e aviso de demonstração sem persistir no navegador` | Passou |  |
| `RF08 — confirmação do cadastro (T17.8) RF08-R02: copia exatamente o código e confirma a cópia` | Passou |  |
| `RF08 — confirmação do cadastro (T17.8) RF08-R03: falha na área de transferência orienta a cópia manual e preserva o código` | Passou |  |
| `RF08 — confirmação do cadastro (T17.8) RF08-R04: conta vinculada não mostra convite nem código e permite concluir` | Passou |  |
| `bloqueia motivo inválido e destaca o campo ()` | Passou |  |
| `bloqueia motivo inválido e destaca o campo (   )` | Passou |  |
| `bloqueia motivo inválido e destaca o campo (aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa)` | Passou |  |
| `confirma com o motivo sem espaços nas extremidades e informa o efeito nas vagas` | Passou |  |
| `mantém o modal aberto e mostra a mensagem exata da API` | Passou |  |
| `impede envio duplicado e fechamento enquanto aguarda a API` | Passou |  |
| `permite voltar sem registrar a retirada` | Passou |  |
| `preserva títulos completos e associa cada card ao seu próprio título` | Passou |  |
| `mantém o conteúdo e as ações no mesmo card e executa o callback correto` | Passou |  |
| `mostra a mensagem de erro` | Passou |  |
| `não renderiza sem mensagem` | Passou |  |
| `mostra o label e o erro` | Passou |  |
| `BuscaFiltroUsuarios envia o texto digitado para o callback de busca` | Passou |  |
| `BuscaFiltroUsuarios converte a seleção de Administrador para o perfil esperado` | Passou |  |
| `BuscaFiltroUsuarios converte a seleção de Coordenador para o perfil esperado` | Passou |  |
| `BuscaFiltroUsuarios converte a seleção de Pesquisador para o perfil esperado` | Passou |  |
| `BuscaFiltroUsuarios converte a seleção de Ativo para a situação esperada` | Passou |  |
| `BuscaFiltroUsuarios converte a seleção de Inativo para a situação esperada` | Passou |  |
| `BuscaFiltroUsuarios limpa os filtros com Todos os perfis e Todas as situações` | Passou |  |
| `não oferece Participante no filtro de perfis` | Passou |  |
| `ModalUsuario bloqueia o cadastro quando os campos obrigatórios estão vazios` | Passou |  |
| `ModalUsuario rejeita nome e senha formados apenas por espaços` | Passou |  |
| `ModalUsuario mostra e oculta a senha sem alterar o valor digitado` | Passou |  |
| `ModalUsuario envia o perfil selecionado e o nome sem espaços ao cadastrar` | Passou |  |
| `ModalUsuario preenche a edição sem oferecer alteração de senha` | Passou |  |
| `ModalUsuario chama onFechar ao acionar Cancelar sem salvar` | Passou |  |
| `ModalUsuario chama onFechar ao acionar Fechar modal sem salvar` | Passou |  |
| `ModalUsuario bloqueia os controles e impede envios repetidos durante o cadastro` | Passou |  |
| `ModalUsuario informa sessão expirada e mantém os dados para nova tentativa` | Passou |  |
| `usa Pesquisador como padrão válido e não oferece Participante` | Passou |  |
| `bloqueia perfil e situação da própria conta e permite editar seus dados` | Passou |  |
| `mantém os controles habilitados para outro administrador` | Passou |  |
| `TabelaUsuarios exibe identificação, perfil e situação de cada usuário` | Passou |  |
| `TabelaUsuarios envia ao callback o usuário correspondente ao botão de edição` | Passou |  |
| `TabelaUsuarios exibe orientação quando não existem resultados` | Passou |  |
| `RF14 — campos do resultado (T20.5) RF14-F01: resultado obrigatório bloqueia gravação e recebe foco` | Passou |  |
| `RF14 — campos do resultado (T20.5) RF14-F02: resultado acima de 200 caracteres impede envio` | Passou |  |
| `RF14 — campos do resultado (T20.5) RF14-F03: observação acima de 500 caracteres impede envio` | Passou |  |
| `RF14 — campos do resultado (T20.5) RF14-F04: aceita os limites de 200 e 500 caracteres` | Passou |  |
| `RF14 — campos do resultado (T20.5) RF14-F05: limpar observação existente omite note na substituição completa` | Passou |  |
| `RF14 — campos do resultado (T20.5) RF14-F06: erros de valor e observação da API aparecem literalmente com rascunho intacto` | Passou |  |
| `RF14 — campos do resultado (T20.5) RF14-F07: perda de permissão preserva rascunho e distingue o registro confirmado` | Passou |  |
| `RF14 — campos do resultado (T20.5) RF14-F08: gravação pendente bloqueia duplicidade` | Passou |  |
| `RF14 — campos do resultado (T20.5) RF14-F09: falha inesperada permite nova tentativa sem apagar o valor` | Passou |  |
| `RF14 — campos do resultado (T20.5) RF14-F10: consulta sem resultado prévio respeita ocupado=true e não grava` | Passou |  |
| `RF14 — campos do resultado (T20.5) RF14-F10: consulta sem resultado prévio respeita ocupado=false e não grava` | Passou |  |
| `RF12 — lista de agendamentos (T18.5) RF12-LS01: lista vazia apresenta orientação sem uma tabela fictícia` | Passou |  |
| `RF12 — lista de agendamentos (T18.5) RF12-LS02: situação SCHEDULED da API é exibida como Agendada` | Passou |  |
| `RF12 — lista de agendamentos (T18.5) RF12-LS02: situação DONE da API é exibida como Realizada` | Passou |  |
| `RF12 — lista de agendamentos (T18.5) RF12-LS02: situação ABSENT da API é exibida como Ausente` | Passou |  |
| `RF12 — lista de agendamentos (T18.5) RF12-LS02: situação CANCELLED da API é exibida como Cancelada` | Passou |  |
| `RF12 — lista de agendamentos (T18.5) RF12-LS03: instante UTC é apresentado no horário de Fortaleza` | Passou |  |
| `RF13 / RF14 — ações da lista (T19.4 / T20.5) RF13-L01: somente SCHEDULED oferece desfecho (SCHEDULED)` | Passou |  |
| `RF13 / RF14 — ações da lista (T19.4 / T20.5) RF13-L01: somente SCHEDULED oferece desfecho (DONE)` | Passou |  |
| `RF13 / RF14 — ações da lista (T19.4 / T20.5) RF13-L01: somente SCHEDULED oferece desfecho (ABSENT)` | Passou |  |
| `RF13 / RF14 — ações da lista (T19.4 / T20.5) RF13-L01: somente SCHEDULED oferece desfecho (CANCELLED)` | Passou |  |
| `RF13 / RF14 — ações da lista (T19.4 / T20.5) RF13-L02: ação Realizada encaminha a visita e o desfecho corretos` | Passou |  |
| `RF13 / RF14 — ações da lista (T19.4 / T20.5) RF13-L02: ação Ausente encaminha a visita e o desfecho corretos` | Passou |  |
| `RF13 / RF14 — ações da lista (T19.4 / T20.5) RF13-L02: ação Cancelar encaminha a visita e o desfecho corretos` | Passou |  |
| `RF13 / RF14 — ações da lista (T19.4 / T20.5) RF14-L01: somente DONE oferece acesso aos resultados (SCHEDULED)` | Passou |  |
| `RF13 / RF14 — ações da lista (T19.4 / T20.5) RF14-L01: somente DONE oferece acesso aos resultados (DONE)` | Passou |  |
| `RF13 / RF14 — ações da lista (T19.4 / T20.5) RF14-L01: somente DONE oferece acesso aos resultados (ABSENT)` | Passou |  |
| `RF13 / RF14 — ações da lista (T19.4 / T20.5) RF14-L01: somente DONE oferece acesso aos resultados (CANCELLED)` | Passou |  |
| `RF13 / RF14 — ações da lista (T19.4 / T20.5) RF14-L02: ação de resultados respeita modo de edição (true)` | Passou |  |
| `RF13 / RF14 — ações da lista (T19.4 / T20.5) RF14-L02: ação de resultados respeita modo de edição (false)` | Passou |  |
| `RF12 — formulário de agendamento (T18.5) RF12-AG01: campos obrigatórios impedem envio e recebem indicação de erro` | Passou |  |
| `RF12 — formulário de agendamento (T18.5) RF12-AG02: envio válido usa o identificador da visita e o instante de Fortaleza em ISO` | Passou |  |
| `RF12 — formulário de agendamento (T18.5) RF12-AG03: mensagem HTTP 400 é exibida literalmente` | Passou |  |
| `RF12 — formulário de agendamento (T18.5) RF12-AG03: mensagem HTTP 409 é exibida literalmente` | Passou |  |
| `RF12 — formulário de agendamento (T18.5) RF12-AG04: conflito mantém formulário aberto e preserva visita e data preenchidas` | Passou |  |
| `RF12 — formulário de agendamento (T18.5) RF12-AG05: erros de campo da API ficam associados aos respectivos controles` | Passou |  |
| `RF12 — formulário de agendamento (T18.5) RF12-AG06: nova tentativa consulta as visitas previstas após erro de carregamento` | Passou |  |
| `RF12 — formulário de agendamento (T18.5) RF12-AG07: estudo sem visitas previstas mantém o envio bloqueado` | Passou |  |
| `RF12 — formulário de agendamento (T18.5) RF12-AG08: condição de agendamento indisponível bloqueia os campos e o envio` | Passou |  |
| `RF12 — formulário de agendamento (T18.5) RF12-AG09: confirmação pendente impede envio duplicado e fechamento` | Passou |  |
| `RF12 — formulário de agendamento (T18.5) RF12-AG10: cancelar fecha o formulário sem enviar agendamento` | Passou |  |
| `RF12 — formulário de agendamento (T18.5) RF12-AG11: falha sem resposta HTTP exibe orientação e permite tentar novamente` | Passou |  |
| `RF13 — confirmação do desfecho (T19.4) RF13-D01: cancelar com justificativa vazia () é bloqueado` | Passou |  |
| `RF13 — confirmação do desfecho (T19.4) RF13-D01: cancelar com justificativa vazia (   ) é bloqueado` | Passou |  |
| `RF13 — confirmação do desfecho (T19.4) RF13-D02: justificativa acima de 500 caracteres não é enviada` | Passou |  |
| `RF13 — confirmação do desfecho (T19.4) RF13-D03: cancelar envia justificativa aparada com a versão da visita` | Passou |  |
| `RF13 — confirmação do desfecho (T19.4) RF13-D04: desfecho DONE só envia após confirmação explícita` | Passou |  |
| `RF13 — confirmação do desfecho (T19.4) RF13-D04: desfecho ABSENT só envia após confirmação explícita` | Passou |  |
| `RF13 — confirmação do desfecho (T19.4) RF13-D05: erro 400 e erro de campo são literais e mantêm o formulário` | Passou |  |
| `RF13 — confirmação do desfecho (T19.4) RF13-D06: conflito 409 exibe mensagem e consulta sem repetir a gravação` | Passou |  |
| `RF13 — confirmação do desfecho (T19.4) RF13-D07: falha ao atualizar mantém confirmação bloqueada até recuperação` | Passou |  |
| `RF13 — confirmação do desfecho (T19.4) RF13-D08: visita finalizada após atualização fica somente em consulta` | Passou |  |
| `RF13 — confirmação do desfecho (T19.4) RF13-D09: envio pendente não duplica gravação nem permite fechar` | Passou |  |
| `RF13 — confirmação do desfecho (T19.4) RF13-D10: voltar ou fechar abandona confirmação sem registrar desfecho` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M16: sessão rejeitada impede novas gravações sem repetir o PUT` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M01: apresenta um campo por atividade na ordem do protocolo` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M02: criação 201 atualiza somente a atividade confirmada pela API` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M03: edição 200 substitui resultado e remove observação omitida` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M04: reabrir consulta novamente o resultado persistido` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M05: situação atual SCHEDULED mantém resultados em consulta` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M05: situação atual ABSENT mantém resultados em consulta` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M05: situação atual CANCELLED mantém resultados em consulta` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M06: perfil COORDINATOR e usuário 9 não autorizado consultam sem gravação` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M06: perfil RESEARCHER e usuário 999 não autorizado consultam sem gravação` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M07: estudo CLOSED impede edição` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M07: estudo CANCELLED impede edição` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M08: erro 400 é literal e mantém rascunho sem alterar a outra atividade` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M09: erro 403 atualiza contexto e não repete o PUT` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M09: erro 404 atualiza contexto e não repete o PUT` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M09: erro 409 atualiza contexto e não repete o PUT` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M10: falha na recuperação após conflito bloqueia salvar até Atualizar dados` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M11: erro ao carregar é literal e Tentar novamente refaz a consulta` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M12: visita sem atividades mostra orientação sem formulário fictício` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M13: gravação pendente bloqueia outras atividades e fechamento` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M14: atividade removida na recuperação preserva mensagem de erro no modal` | Passou |  |
| `RF14 — resultados da visita (T20.5) RF14-M15: fechar consulta não grava nem modifica o estudo` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP01: envio válido usa POST do estudo e participante corretos com JSON e token` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP02: criação aparece na lista existente em ordem cronológica sem nova consulta` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP03: filtro de situação apresenta somente os agendamentos correspondentes` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP04: novo agendamento fica visível mesmo se havia outro filtro selecionado` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP05: VISIT_ALREADY_SCHEDULED mantém mensagem literal, formulário e campos sem inserir registro` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP05: VISIT_DATE_NOT_FUTURE mantém mensagem literal, formulário e campos sem inserir registro` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP06: participante retirado permite consulta sem ação ou formulário de agendamento` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP07: pesquisador consulta a agenda sem ação de criar agendamento` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP08: estudo PLANNING não oferece agendamento` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP08: estudo CLOSED não oferece agendamento` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP08: estudo CANCELLED não oferece agendamento` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP09: estudo em execução também oferece agendamento ao coordenador` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP10: erro da consulta é exibido literalmente e a lista pode ser consultada de novo` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP11: atualizar visitas reflete a situação nova recebida pela API` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP12: durante o carregamento não é possível iniciar agendamento` | Passou |  |
| `RF12 — agenda por participante (T18.5) RF12-AP13: voltar retorna ao painel de participantes` | Passou |  |
| `critérios de inclusão e exclusão — RF05 cadastra inclusão em PLANNING e recarrega a lista pela API` | Passou |  |
| `critérios de inclusão e exclusão — RF05 cadastra exclusão em RECRUITMENT e recarrega a lista pela API` | Passou |  |
| `critérios de inclusão e exclusão — RF05 bloqueia tipo ausente e descrição vazia ou composta de espaços` | Passou |  |
| `critérios de inclusão e exclusão — RF05 exibe o erro HTTP 400 no campo e preserva os dados do formulário` | Passou |  |
| `critérios de inclusão e exclusão — RF05 exibe o bloqueio HTTP 409 e exige atualizar antes de outra submissão` | Passou |  |
| `critérios de inclusão e exclusão — RF05 permite somente consulta para coordenador` | Passou |  |
| `critérios de inclusão e exclusão — RF05 permite somente consulta para outro pesquisador` | Passou |  |
| `critérios de inclusão e exclusão — RF05 permite somente consulta para CLOSED` | Passou |  |
| `critérios de inclusão e exclusão — RF05 permite somente consulta para CANCELLED` | Passou |  |
| `critérios de inclusão e exclusão — RF05 permite somente consulta para estudo em execução` | Passou |  |
| `critérios de inclusão e exclusão — RF05 recupera falha de consulta e separa os critérios de inclusão e exclusão` | Passou |  |
| `estudos conectados à API mostra carregamento e depois o estado vazio, liberando o cadastro` | Passou |  |
| `estudos conectados à API lista e busca os registros reais sem inventar status ou participantes` | Passou |  |
| `estudos conectados à API cadastra no backend com o pesquisador logado e usa a resposta do servidor` | Passou |  |
| `estudos conectados à API preserva o responsável na edição e bloqueia o formulário até o PUT terminar` | Passou |  |
| `estudos conectados à API mantém o modal e os dados digitados quando uma regra do backend rejeita a edição` | Passou |  |
| `estudos conectados à API descarta a edição cancelada sem alterar a tabela nem enviar requisição` | Passou |  |
| `estudos conectados à API valida objetivo, limite inteiro e datas antes de enviar` | Passou |  |
| `estudos conectados à API não usa mocks quando a listagem falha e permite tentar novamente` | Passou |  |
| `estudos conectados à API trata a resposta HTTP 401 na listagem sem mostrar dados` | Passou |  |
| `estudos conectados à API trata a resposta HTTP 403 na listagem sem mostrar dados` | Passou |  |
| `estudos conectados à API não chama a API para o perfil ADMINISTRATOR` | Passou |  |
| `estudos conectados à API não chama a API para o perfil PARTICIPANT` | Passou |  |
| `estudos conectados à API redireciona para login quando não há sessão` | Passou |  |
| `bloqueia abrir recrutamento e explica os requisitos ausentes: [ 'critério de inclusão', …(2) ]` | Passou |  |
| `bloqueia abrir recrutamento e explica os requisitos ausentes: [ 'critério de inclusão' ]` | Passou |  |
| `bloqueia abrir recrutamento e explica os requisitos ausentes: [ 'critério de exclusão' ]` | Passou |  |
| `bloqueia abrir recrutamento e explica os requisitos ausentes: [ 'visita prevista com atividade' ]` | Passou |  |
| `libera Abrir recrutamento quando os requisitos são atendidos` | Passou |  |
| `libera Iniciar execução quando os requisitos são atendidos` | Passou |  |
| `libera Encerrar estudo quando os requisitos são atendidos` | Passou |  |
| `bloqueia Iniciar execução consultando somente os dados desse estado` | Passou |  |
| `bloqueia Encerrar estudo consultando somente os dados desse estado` | Passou |  |
| `mantém cancelar e voltar disponíveis durante a consulta e após erro; permite tentar novamente` | Passou |  |
| `refaz a consulta ao reabrir o menu e após atualização do protocolo` | Passou |  |
| `cancela consulta ao fechar e ignora resposta antiga após reabrir` | Passou |  |
| `não consulta requisitos em CLOSED` | Passou |  |
| `não consulta requisitos em CANCELLED` | Passou |  |
| `não consulta requisitos em SEM_PERMISSAO` | Passou |  |
| `visitas previstas e atividades — RF06 cadastra após adicionar e remover atividades e atualiza a lista pela API` | Passou |  |
| `visitas previstas e atividades — RF06 lista atividades e edita durante o recrutamento preservando o ID da atividade restante` | Passou |  |
| `visitas previstas e atividades — RF06 bloqueia visita sem data e atividade sem descrição antes de enviar` | Passou |  |
| `visitas previstas e atividades — RF06 apresenta o erro HTTP no campo e conserva os dados digitados` | Passou |  |
| `visitas previstas e atividades — RF06 permite apenas consulta para execução` | Passou |  |
| `visitas previstas e atividades — RF06 permite apenas consulta para encerrado` | Passou |  |
| `visitas previstas e atividades — RF06 permite apenas consulta para coordenador` | Passou |  |
| `visitas previstas e atividades — RF06 permite apenas consulta para outro pesquisador` | Passou |  |
| `visitas previstas e atividades — RF06 permite apenas consulta para cancelado` | Passou |  |
| `visitas previstas e atividades — RF06 exclui somente após confirmação e recarrega a lista` | Passou |  |
| `visualização de estudos cancela a consulta pendente quando a página é desmontada` | Passou |  |
| `visualização de estudos abre pelo link do card e consulta o endpoint do estudo selecionado` | Passou |  |
| `visualização de estudos carrega os detalhes em modo de consulta para RESEARCHER` | Passou |  |
| `visualização de estudos carrega os detalhes em modo de consulta para COORDINATOR` | Passou |  |
| `visualização de estudos libera as ações do estudo após falha nas visitas e permite recuperar a aba` | Passou |  |
| `visualização de estudos confirma a transição do responsável e atualiza o estado pela resposta da API` | Passou |  |
| `visualização de estudos mostra o motivo do conflito e permite atualizar antes de uma nova transição` | Passou |  |
| `visualização de estudos retorna do recrutamento ao planejamento após confirmação` | Passou |  |
| `visualização de estudos exige justificativa para cancelar e envia o texto sem espaços nas extremidades` | Passou |  |
| `visualização de estudos restaura cancelamento para a origem PLANNING consultada no histórico` | Passou |  |
| `visualização de estudos restaura cancelamento para a origem RECRUITMENT consultada no histórico` | Passou |  |
| `visualização de estudos mantém o estudo visível após falha do histórico e permite repetir somente essa consulta` | Passou |  |
| `visualização de estudos não restaura cancelamento originado de EXECUTION` | Passou |  |
| `visualização de estudos não restaura cancelamento originado de CLOSED` | Passou |  |
| `visualização de estudos mostra a pré-condição do HTTP 409 sem exigir atualização de estado` | Passou |  |
| `visualização de estudos edita pelo modal existente, mantém o responsável e atualiza os detalhes após sucesso` | Passou |  |
| `visualização de estudos não chama a API para o identificador inválido abc` | Passou |  |
| `visualização de estudos não chama a API para o identificador inválido 0` | Passou |  |
| `visualização de estudos não chama a API para o identificador inválido -2` | Passou |  |
| `visualização de estudos não chama a API para o identificador inválido 1.5` | Passou |  |
| `visualização de estudos não chama a API para o identificador inválido 9007199254740992` | Passou |  |
| `visualização de estudos mostra estudo não encontrado quando a API devolve 404` | Passou |  |
| `visualização de estudos permite tentar novamente após uma falha de conexão` | Passou |  |
| `visualização de estudos trata a resposta HTTP 401 sem exibir os detalhes` | Passou |  |
| `visualização de estudos trata a resposta HTTP 403 sem exibir os detalhes` | Passou |  |
| `visualização de estudos não consulta o estudo para o perfil ADMINISTRATOR` | Passou |  |
| `visualização de estudos não consulta o estudo para o perfil PARTICIPANT` | Passou |  |
| `visualização de estudos redireciona para login sem sessão` | Passou |  |
| `carrega participantes apenas ao abrir a aba do estudo` | Passou |  |
| `T24.1: ações e limite de uma primária nas quatro abas em PLANNING para responsável` | Passou |  |
| `T24.1: ações e limite de uma primária nas quatro abas em PLANNING para outro pesquisador` | Passou |  |
| `T24.1: ações e limite de uma primária nas quatro abas em PLANNING para coordenador` | Passou |  |
| `T24.1: ações e limite de uma primária nas quatro abas em RECRUITMENT para responsável` | Passou |  |
| `T24.1: ações e limite de uma primária nas quatro abas em RECRUITMENT para outro pesquisador` | Passou |  |
| `T24.1: ações e limite de uma primária nas quatro abas em RECRUITMENT para coordenador` | Passou |  |
| `T24.1: ações e limite de uma primária nas quatro abas em EXECUTION para responsável` | Passou |  |
| `T24.1: ações e limite de uma primária nas quatro abas em EXECUTION para outro pesquisador` | Passou |  |
| `T24.1: ações e limite de uma primária nas quatro abas em EXECUTION para coordenador` | Passou |  |
| `T24.1: ações e limite de uma primária nas quatro abas em CLOSED para responsável` | Passou |  |
| `T24.1: ações e limite de uma primária nas quatro abas em CLOSED para outro pesquisador` | Passou |  |
| `T24.1: ações e limite de uma primária nas quatro abas em CLOSED para coordenador` | Passou |  |
| `T24.1: ações e limite de uma primária nas quatro abas em CANCELLED para responsável` | Passou |  |
| `T24.1: ações e limite de uma primária nas quatro abas em CANCELLED para outro pesquisador` | Passou |  |
| `T24.1: ações e limite de uma primária nas quatro abas em CANCELLED para coordenador` | Passou |  |
| `T24.1: coordenador abre o recrutamento com o estudo atual selecionado` | Passou |  |
| `T24.1: não oferece Gerenciar candidatos para COORDINATOR em PLANNING` | Passou |  |
| `T24.1: não oferece Gerenciar candidatos para COORDINATOR em EXECUTION` | Passou |  |
| `T24.1: não oferece Gerenciar candidatos para COORDINATOR em CLOSED` | Passou |  |
| `T24.1: não oferece Gerenciar candidatos para COORDINATOR em CANCELLED` | Passou |  |
| `T24.1: não oferece Gerenciar candidatos para RESEARCHER em RECRUITMENT` | Passou |  |
| `Login e gestão de sessão (T4.2) valida campos obrigatórios antes de chamar a API` | Passou |  |
| `Login e gestão de sessão (T4.2) exibe erro quando as credenciais são inválidas ou a conta está inativa (401)` | Passou |  |
| `Login e gestão de sessão (T4.2) exibe erro de conexão e não salva sessão quando a API está indisponível` | Passou |  |
| `Login e gestão de sessão (T4.2) autentica usuário ativo, persiste a sessão, exibe perfil na Sidebar e encerra a sessão no logout` | Passou |  |
| `Login e gestão de sessão (T4.2) descarta automaticamente sessão já expirada no armazenamento da aba` | Passou |  |
| `Tela de candidatos com filtro por estudo (RF08 - T12.3 / T12.4) exibe carregamento inicial e depois lista vazia quando não há registros` | Passou |  |
| `Tela de candidatos com filtro por estudo (RF08 - T12.3 / T12.4) lista candidatos iniciais e consulta a API com o novo studyId ao filtrar` | Passou |  |
| `Tela de candidatos com filtro por estudo (RF08 - T12.3 / T12.4) desabilita o cadastro quando o estudo não está em recrutamento` | Passou |  |
| `Tela de candidatos com filtro por estudo (RF08 - T12.3 / T12.4) valida campos obrigatórios e idade antes da chamada HTTP de cadastro` | Passou |  |
| `Tela de candidatos com filtro por estudo (RF08 - T12.3 / T12.4) cadastra candidato válido e atualiza a listagem com o retorno da API` | Passou |  |
| `Tela de candidatos com filtro por estudo (RF08 - T12.3 / T12.4) exibe erro claro no modal ao receber conflito de duplicidade (HTTP 409)` | Passou |  |
| `Tela de candidatos com filtro por estudo (RF08 - T12.3 / T12.4) trata falha na listagem de candidatos e permite tentar novamente` | Passou |  |
| `Tela de candidatos com filtro por estudo (RF08 - T12.3 / T12.4) permite que RESEARCHER consulte candidatos sem botão de cadastro` | Passou |  |
| `Tela de candidatos com filtro por estudo (RF08 - T12.3 / T12.4) não consulta o consentimento quando o perfil é RESEARCHER` | Passou |  |
| `Tela de candidatos com filtro por estudo (RF08 - T12.3 / T12.4) bloqueia acesso e não consulta a API para o perfil ADMINISTRATOR` | Passou |  |
| `Tela de candidatos com filtro por estudo (RF08 - T12.3 / T12.4) bloqueia acesso e não consulta a API para o perfil PARTICIPANT` | Passou |  |
| `Tela de candidatos com filtro por estudo (RF08 - T12.3 / T12.4) redireciona para login quando não há sessão autenticada` | Passou |  |
| `Consentimento na lista e inclusão de participante (RF10 e RF11) usa a decisão da API sem registro local e permite incluir o participante` | Passou |  |
| `Consentimento na lista e inclusão de participante (RF10 e RF11) ignora a decisão antiga guardada no navegador quando a API diz que está pendente` | Passou |  |
| `Consentimento na lista e inclusão de participante (RF10 e RF11) avisa quando a situação não pôde ser consultada e permite consultar de novo` | Passou |  |
| `Consentimento na lista e inclusão de participante (RF10 e RF11) mantém o botão de inclusão desabilitado quando o estudo já atingiu o limite de vagas` | Passou |  |
| `Consentimento na lista e inclusão de participante (RF10 e RF11) exibe o motivo específico retornado pela API (HTTP 409) quando a última vaga esgota antes da resposta` | Passou |  |
| `Consentimento na lista e inclusão de participante (RF10 e RF11) bloqueia clique duplo e dispara exatamente uma requisição durante a confirmação de inclusão` | Passou |  |
| `T24.1: seleciona o estudo da URL mesmo quando não é o primeiro da lista` | Passou |  |
| `T24.1: não consulta outro estudo silenciosamente para studyId=999` | Passou |  |
| `T24.1: não consulta outro estudo silenciosamente para studyId=abc` | Passou |  |
| `T24.1: não consulta outro estudo silenciosamente para studyId=0` | Passou |  |
| `T24.1: não consulta outro estudo silenciosamente para studyId=1e1` | Passou |  |
| `T24.3: preserva o cancelamento e a consulta de cancelados na lista de cards` | Passou |  |
| `RF08 — andamento e cancelamento (T17.8) RF08-P05: cancelamento mantém filtro ativo e mostra o histórico retornado pela API` | Passou |  |
| `RF08 — andamento e cancelamento (T17.8) RF08-P01: concluir convite remove o código da tela e não o grava em nenhum storage` | Passou |  |
| `RF08 — andamento e cancelamento (T17.8) RF08-P02: filtro de cancelados persiste ao atualizar e pode voltar à lista padrão` | Passou |  |
| `RF08 — andamento e cancelamento (T17.8) RF08-P03: conflito CANDIDATE_ALREADY_INCLUDED consulta candidato e estudo e bloqueia novo cancelamento` | Passou |  |
| `RF08 — andamento e cancelamento (T17.8) RF08-P03: conflito CANDIDATE_ALREADY_CANCELLED consulta candidato e estudo e bloqueia novo cancelamento` | Passou |  |
| `RF08 — andamento e cancelamento (T17.8) RF08-P03: conflito STUDY_NOT_RECRUITING consulta candidato e estudo e bloqueia novo cancelamento` | Passou |  |
| `RF08 — andamento e cancelamento (T17.8) RF09-P04: avaliação elegível recarrega a candidatura e não antecipa o aceite` | Passou |  |
| `T22.3: registra retirada, oculta Agendar e mantém histórico e vaga ocupada` | Passou |  |
| `T22.3: mantém o participante ativo e mostra o erro da API no modal` | Passou |  |
| `RF13 — desfechos e atualização da lista (T19.4) RF13-P07: conflito de versão exige nova confirmação e usa a versão atualizada da visita` | Passou |  |
| `RF13 — desfechos e atualização da lista (T19.4) RF13-P01: confirmar Realizada atualiza o selo sem recarregar a página` | Passou |  |
| `RF13 — desfechos e atualização da lista (T19.4) RF13-P01: confirmar Ausente atualiza o selo sem recarregar a página` | Passou |  |
| `RF13 — desfechos e atualização da lista (T19.4) RF13-P01: confirmar Cancelar atualiza o selo sem recarregar a página` | Passou |  |
| `RF13 — desfechos e atualização da lista (T19.4) RF13-P02: conflito 409 consulta a visita atual e remove as ações quando já finalizada` | Passou |  |
| `RF13 — desfechos e atualização da lista (T19.4) RF13-P03: filtros de situação e participante são enviados à API e mantidos após o desfecho` | Passou |  |
| `RF13 — desfechos e atualização da lista (T19.4) RF13-P04: estudo CLOSED mantém consulta sem ações de desfecho` | Passou |  |
| `RF13 — desfechos e atualização da lista (T19.4) RF13-P04: estudo CANCELLED mantém consulta sem ações de desfecho` | Passou |  |
| `RF13 — desfechos e atualização da lista (T19.4) RF13-P05: pesquisador consulta visitas sem ações de desfecho` | Passou |  |
| `RF13 — desfechos e atualização da lista (T19.4) RF13-P06: erro na listagem é literal e pode ser recuperado` | Passou |  |
| `RF13 — desfechos e atualização da lista (T19.4) RF14-P01: RESEARCHER recebe a ação de resultados adequada` | Passou |  |
| `RF13 — desfechos e atualização da lista (T19.4) RF14-P01: COORDINATOR recebe a ação de resultados adequada` | Passou |  |
| `Gestão de usuários mostra carregamento até receber a lista da API` | Passou |  |
| `Gestão de usuários mostra estado vazio quando a API não retorna usuários` | Passou |  |
| `Gestão de usuários combina busca, perfil e situação e permite limpar os filtros sem novas requisições` | Passou |  |
| `Gestão de usuários só desativa ao salvar e confirmar, bloqueando a requisição pendente` | Passou |  |
| `Gestão de usuários ativa somente após salvar e confirmar` | Passou |  |
| `Gestão de usuários descarta a mudança do interruptor quando o modal é cancelado` | Passou |  |
| `Gestão de usuários mantém a situação original e o formulário se a alteração for recusada` | Passou |  |
| `Gestão de usuários informa salvamento parcial e repete somente a situação ao tentar novamente` | Passou |  |
| `Gestão de usuários não altera a situação quando os dados de edição são rejeitados` | Passou |  |
| `Gestão de usuários rejeita e-mail sem domínio completo no cadastro e permite corrigir` | Passou |  |
| `Gestão de usuários rejeita e-mail sem domínio completo no edição e permite corrigir` | Passou |  |
| `Gestão de usuários lista, cadastra e edita usuários com JWT sem enviar senha na edição` | Passou |  |
| `Gestão de usuários mantém o modal e os dados quando o backend rejeita e-mail duplicado` | Passou |  |
| `Gestão de usuários mostra validação da API apenas no campo correspondente` | Passou |  |
| `Gestão de usuários mantém alerta geral e foco no resumo quando a API fica indisponível ao salvar` | Passou |  |
| `Gestão de usuários mostra erro de carregamento e permite tentar novamente` | Passou |  |
| `Gestão de usuários impede acesso do perfil RESEARCHER sem consultar a API` | Passou |  |
| `Gestão de usuários impede acesso do perfil COORDINATOR sem consultar a API` | Passou |  |
| `Gestão de usuários impede acesso do perfil PARTICIPANT sem consultar a API` | Passou |  |
| `Gestão de usuários mostra a mensagem adequada quando a listagem retorna HTTP 401` | Passou |  |
| `Gestão de usuários mostra a mensagem adequada quando a listagem retorna HTTP 403` | Passou |  |
| `Gestão de usuários redireciona para login quando não há sessão` | Passou |  |
| `cliente HTTP compartilhado envia login ao caminho correto com base ''` | Passou |  |
| `cliente HTTP compartilhado envia login ao caminho correto com base 'https://api.example.test/'` | Passou |  |
| `cliente HTTP compartilhado aceita logout 204 e envia o JWT` | Passou |  |
| `cliente HTTP compartilhado normaliza o erro do backend {"detail":"Estudo não encontrado."}` | Passou |  |
| `cliente HTTP compartilhado normaliza o erro do backend {"code":"INVALID_REQUEST","message":"Dados inválidos.","fieldErrors":[{"field":"email","message":"E-mail inválido."}]}` | Passou |  |
| **Total de testes: 475** | **Passaram: 475 (100,0%); falharam: 0 (0,0%)** | |
