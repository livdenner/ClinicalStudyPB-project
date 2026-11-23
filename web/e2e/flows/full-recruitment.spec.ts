import {
    expect as baseExpect,
    test,
    type Browser,
    type Locator,
    type Page,
} from "@playwright/test";
import { accounts, DEMO_PASSWORD, loginAsResearcher, submitLogin } from "../support/auth";
import {
    activateCandidate,
    decideConsent,
    expectDecisionIsFinal,
    expectInclusionRejected,
    loginByApi,
} from "../support/candidate-api";

/**
 * Fluxo completo de recrutamento (T16.7, adaptado na T17.11) contra a API e o PostgreSQL
 * reais, sem interceptar respostas. O pesquisador configura o estudo e abre o recrutamento;
 * o coordenador cadastra o candidato com e-mail novo e avalia a elegibilidade; o próprio
 * candidato ativa a conta e decide o consentimento pela API (sem e-mail real: o código vem
 * da resposta do cadastro); por fim o coordenador inclui, ou fica impedido de incluir.
 *
 * Cada etapa fica num test.step, então o relatório mostra onde o fluxo parou. Em falha, o
 * Playwright guarda a captura de tela e, na nova tentativa do CI, o trace.
 */

const INCLUSION_CRITERION = "Ter 18 anos ou mais";
const EXCLUSION_CRITERION = "Estar em gestação";
const VISIT_NAME = "Avaliação inicial";
const PARTICIPANT_LIMIT = 2;
// Fluxo longo com várias gravações e animações de modal: 5 s (padrão) é pouco em máquinas lentas.
const expect = baseExpect.configure({ timeout: 15_000 });

type RegisteredCandidate = { id: number; name: string; activationCode: string };

/** Dados fictícios e únicos por execução: o banco da stack é compartilhado pelos testes. */
function fictitiousCandidate(scenario: string) {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000)}`;
    return {
        studyTitle: `Estudo E2E ${scenario} ${suffix}`,
        name: `Candidata E2E ${scenario} ${suffix}`,
        email: `candidata.e2e.${scenario}.${suffix}@exemplo.test`,
        phone: "(83) 99999-0000",
        age: "34",
    };
}

/** Digita uma data (dd/mm/aaaa, locale pt-BR) nos segmentos de um campo de data. */
async function fillDate(scope: Locator, label: string, date: string) {
    await scope.getByRole("group", { name: label }).getByRole("spinbutton").first().click();
    await scope.page().keyboard.type(date.replace(/\//g, ""));
}

async function createStudy(page: Page, title: string): Promise<number> {
    await page.getByRole("button", { name: "Novo estudo" }).click();
    const dialog = page.getByRole("dialog", { name: "Novo estudo" });
    await dialog.getByLabel("Nome do estudo").fill(title);
    await dialog.getByLabel("Objetivo").fill("Validar o fluxo completo de recrutamento.");
    await fillDate(dialog, "Data de início", "01/02/2027");
    await fillDate(dialog, "Data de término", "31/07/2027");
    await dialog.getByLabel("Limite de participantes").fill(String(PARTICIPANT_LIMIT));

    // Só observa a resposta para saber o id gerado; nada é simulado.
    const created = page.waitForResponse(
        (response) =>
            response.request().method() === "POST" &&
            new URL(response.url()).pathname === "/api/studies"
    );
    await dialog.getByRole("button", { name: "Cadastrar estudo" }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    await expect(dialog).toBeHidden();
    return ((await response.json()) as { id: number }).id;
}

async function addCriterion(page: Page, type: "Inclusão" | "Exclusão", description: string) {
    await page.getByRole("button", { name: "Cadastrar critério" }).click();
    const dialog = page.getByRole("dialog", { name: "Novo critério" });
    await dialog.getByRole("button", { name: /Tipo de critério/ }).click();
    await page.getByRole("option", { name: type }).click();
    await dialog.getByRole("textbox", { name: /Descrição/ }).fill(description);
    await dialog.getByRole("button", { name: "Cadastrar critério" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(description)).toBeVisible();
}

/** Protocolo: o pesquisador cadastra o estudo, os critérios e a visita e abre o recrutamento. */
async function prepareRecruitingStudy(page: Page, title: string): Promise<number> {
    let studyId = 0;

    await test.step("pesquisador cadastra o estudo", async () => {
        await loginAsResearcher(page);
        studyId = await createStudy(page, title);
        await page.goto(`/estudos/${studyId}`);
        await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
        await expect(page.getByText("Planejamento").first()).toBeVisible();
    });

    await test.step("pesquisador cadastra os critérios de inclusão e exclusão", async () => {
        await page.getByRole("tab", { name: "Critérios" }).click();
        await addCriterion(page, "Inclusão", INCLUSION_CRITERION);
        await addCriterion(page, "Exclusão", EXCLUSION_CRITERION);
    });

    await test.step("pesquisador define a visita prevista com atividade", async () => {
        await page.getByRole("tab", { name: "Visitas previstas" }).click();
        await page.getByRole("button", { name: "Cadastrar visita" }).click();
        const dialog = page.getByRole("dialog", { name: "Nova visita prevista" });
        await dialog.getByLabel(/^Nome da visita/).fill(VISIT_NAME);
        await fillDate(dialog, "Data prevista", "15/02/2027");
        await dialog.getByLabel(/^Nome da atividade/).fill("Entrevista clínica");
        await dialog.getByLabel(/^Descrição/).fill("Histórico de saúde e medicamentos em uso");
        await dialog.getByRole("button", { name: "Cadastrar visita" }).click();
        await expect(dialog).toBeHidden();
        await expect(page.getByRole("heading", { name: VISIT_NAME })).toBeVisible();
    });

    await test.step("pesquisador abre o recrutamento", async () => {
        // As transições ficam no menu "Alterar estado"; o item só habilita com os requisitos.
        await page.getByRole("button", { name: /Alterar estado/ }).click();
        await page.getByRole("menuitem", { name: "Abrir recrutamento" }).click();
        const dialog = page.getByRole("dialog", { name: "Abrir recrutamento" });
        await dialog.getByRole("button", { name: "Abrir recrutamento" }).click();
        await expect(dialog).toBeHidden();
        await expectStudyInRecruitment(page);
    });

    return studyId;
}

/** O próximo passo oferecido no menu de estado confirma que o estudo está em recrutamento. */
async function expectStudyInRecruitment(page: Page) {
    await expect(page.getByText("Recrutamento").first()).toBeVisible();
    await page.getByRole("button", { name: /Alterar estado/ }).click();
    await expect(page.getByRole("menuitem", { name: "Iniciar execução" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem", { name: "Iniciar execução" })).toBeHidden();
}

/** O coordenador usa outro contexto, sem a sessão nem o armazenamento do pesquisador. */
async function openCoordinator(browser: Browser, studyId: number) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await submitLogin(page, accounts.coordinator, DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/recrutamento$/);
    await openRecruitment(page, studyId);
    return { context, page };
}

/** Abre a lista do estudo direto da API, sem reaproveitar o que a tela já tinha carregado. */
async function openRecruitment(page: Page, studyId: number) {
    await page.goto(`/recrutamento?studyId=${studyId}`);
    await expect(page.getByRole("button", { name: "Novo candidato" })).toBeEnabled();
}

/** Card do candidato na lista em cards da tela de recrutamento (T24.3). */
function candidateCard(page: Page, name: string) {
    return page
        .getByRole("list", { name: "Lista de candidatos" })
        .getByRole("listitem")
        .filter({ hasText: name });
}

async function registerCandidate(
    page: Page,
    data: ReturnType<typeof fictitiousCandidate>
): Promise<RegisteredCandidate> {
    await expect(page.getByText("Nenhum candidato encontrado")).toBeVisible();
    await page.getByRole("button", { name: "Novo candidato" }).click();
    const dialog = page.getByRole("dialog", { name: "Novo candidato" });
    await dialog.getByLabel("Nome do candidato").fill(data.name);
    await dialog.getByLabel("E-mail").fill(data.email);
    await dialog.getByLabel("Telefone").fill(data.phone);
    await dialog.getByLabel("Idade").fill(data.age);

    // Observa a resposta real do cadastro: traz o id e o código de ativação de demonstração.
    const created = page.waitForResponse(
        (response) =>
            response.request().method() === "POST" &&
            /^\/api\/studies\/\d+\/candidates$/.test(new URL(response.url()).pathname)
    );
    await dialog.getByRole("button", { name: "Cadastrar candidato" }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    const body = (await response.json()) as {
        id: number;
        status: string;
        activation: { activationCode: string };
    };
    expect(body.status).toBe("INVITED");

    // E-mail novo: a tela emite o convite e mostra o mesmo código devolvido pela API.
    const invitation = page.getByRole("dialog", { name: "Convite emitido" });
    await expect(invitation.getByText(data.email)).toBeVisible();
    await expect(invitation.getByLabel("Código de ativação")).toHaveText(
        body.activation.activationCode
    );
    await invitation.getByRole("button", { name: "Concluir cadastro" }).click();
    await expect(invitation).toBeHidden();
    await expect(candidateCard(page, data.name)).toBeVisible();

    return { id: body.id, name: data.name, activationCode: body.activation.activationCode };
}

async function evaluateEligibility(page: Page, name: string) {
    await page.getByRole("button", { name: `Avaliar elegibilidade: ${name}` }).click();
    await page.getByLabel(INCLUSION_CRITERION).selectOption("true");
    await page.getByLabel(EXCLUSION_CRITERION).selectOption("false");
    await page.getByRole("button", { name: "Salvar avaliação" }).click();
    await expect(
        page.getByText("Avaliação de elegibilidade registrada com sucesso.")
    ).toBeVisible();
    await page.getByRole("button", { name: "Voltar para candidatos" }).click();
    await expect(candidateCard(page, name)).toContainText("Elegível");
}

async function expectParticipantAndVacancies(page: Page, candidate: string) {
    const participants = page.getByRole("list", { name: "Lista de participantes incluídos" });
    await expect(participants.getByText(candidate)).toBeVisible();
    const vacancies = page.getByRole("status", { name: "Indicador de vagas do estudo" });
    await expect(vacancies).toContainText(`1 de ${PARTICIPANT_LIMIT}`);
    await expect(vacancies).toContainText("1 vaga");
}

test.describe("fluxo completo de recrutamento", () => {
    test("protocolo, candidato, elegibilidade, aceite do candidato e inclusão", async ({
        page,
        browser,
        request,
    }) => {
        test.slow();
        const data = fictitiousCandidate("aceite");
        const studyId = await prepareRecruitingStudy(page, data.studyTitle);
        const coordinator = await openCoordinator(browser, studyId);
        let candidate: RegisteredCandidate | undefined;

        await test.step("coordenador cadastra o candidato com e-mail novo", async () => {
            candidate = await registerCandidate(coordinator.page, data);
        });
        if (!candidate) throw new Error("O cadastro do candidato não foi concluído.");
        const registered = candidate;

        await test.step("coordenador avalia a elegibilidade", async () => {
            await evaluateEligibility(coordinator.page, registered.name);
        });

        await test.step("candidato ativa a conta e aceita o termo pela API", async () => {
            const token = await activateCandidate(request, data.email, registered.activationCode);
            await decideConsent(request, token, registered.id, "GRANTED");
            await expectDecisionIsFinal(request, token, registered.id, "DECLINED");
        });

        await test.step("coordenador vê o aceite e inclui o participante", async () => {
            await openRecruitment(coordinator.page, studyId);
            await expect(candidateCard(coordinator.page, registered.name)).toContainText(/Aceit/);
            await coordinator.page
                .getByRole("button", { name: `Incluir participante: ${registered.name}` })
                .click();
            const dialog = coordinator.page.getByRole("dialog", {
                name: "Confirmar inclusão de participante",
            });
            await dialog.getByRole("button", { name: "Confirmar inclusão" }).click();
            await expect(dialog).toBeHidden();
            await expect(
                coordinator.page.getByText("Participante incluído no estudo com sucesso.")
            ).toBeVisible();
            await expectParticipantAndVacancies(coordinator.page, registered.name);
        });

        await test.step("os dados persistem no backend", async () => {
            // Novo contexto, sem cache local: tudo o que aparece veio da API e do banco.
            const fresh = await openCoordinator(browser, studyId);
            await expectParticipantAndVacancies(fresh.page, registered.name);
            await fresh.context.close();

            await page.reload();
            await expectStudyInRecruitment(page);
            await page.getByRole("tab", { name: "Critérios" }).click();
            await expect(page.getByText(INCLUSION_CRITERION)).toBeVisible();
            await expect(page.getByText(EXCLUSION_CRITERION)).toBeVisible();
            await page.getByRole("tab", { name: "Visitas previstas" }).click();
            await expect(page.getByRole("heading", { name: VISIT_NAME })).toBeVisible();
        });

        await coordinator.context.close();
    });

    test("recusa do candidato impede a inclusão", async ({ page, browser, request }) => {
        test.slow();
        const data = fictitiousCandidate("recusa");
        const studyId = await prepareRecruitingStudy(page, data.studyTitle);
        const coordinator = await openCoordinator(browser, studyId);
        let candidate: RegisteredCandidate | undefined;

        await test.step("coordenador cadastra o candidato e avalia a elegibilidade", async () => {
            candidate = await registerCandidate(coordinator.page, data);
            await evaluateEligibility(coordinator.page, candidate.name);
        });
        if (!candidate) throw new Error("O cadastro do candidato não foi concluído.");
        const registered = candidate;

        await test.step("candidato ativa a conta e recusa o termo pela API", async () => {
            const token = await activateCandidate(request, data.email, registered.activationCode);
            await decideConsent(request, token, registered.id, "DECLINED");
            await expectDecisionIsFinal(request, token, registered.id, "GRANTED");
        });

        await test.step("a tela mostra a recusa e não oferece a inclusão", async () => {
            await openRecruitment(coordinator.page, studyId);
            const card = candidateCard(coordinator.page, registered.name);
            await expect(card).toContainText(/Recus/);
            // Sem botão habilitado: ausente ou desabilitado.
            await expect(
                coordinator.page.getByRole("button", {
                    name: `Incluir participante: ${registered.name}`,
                    disabled: false,
                })
            ).toHaveCount(0);
        });

        await test.step("a API recusa a inclusão e o estudo segue sem participantes", async () => {
            const token = await loginByApi(request, accounts.coordinator, DEMO_PASSWORD);
            await expectInclusionRejected(request, token, studyId, registered.id);
        });

        await coordinator.context.close();
    });
});
