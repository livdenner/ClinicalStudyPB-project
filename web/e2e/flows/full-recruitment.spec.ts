import { expect, test, type Locator, type Page } from "@playwright/test";
import { accounts, DEMO_PASSWORD, loginAsResearcher, submitLogin } from "../support/auth";

/**
 * Smoke do fluxo completo da Release 1 (T16.7), contra a API e o PostgreSQL reais, sem
 * interceptar respostas: o pesquisador configura o estudo e abre o recrutamento, e o
 * coordenador cadastra, avalia, registra o consentimento e inclui o participante.
 *
 * Cada etapa fica num test.step, então o relatório mostra onde o fluxo parou. Em falha, o
 * Playwright guarda a captura de tela e, na nova tentativa do CI, o trace.
 */

const INCLUSION_CRITERION = "Ter 18 anos ou mais";
const EXCLUSION_CRITERION = "Estar em gestação";
const VISIT_NAME = "Avaliação inicial";
const PARTICIPANT_LIMIT = 2;

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
    await page.getByRole("button", { name: "Novo critério" }).click();
    const dialog = page.getByRole("dialog", { name: "Novo critério" });
    await dialog.getByRole("button", { name: /Tipo de critério/ }).click();
    await page.getByRole("option", { name: type }).click();
    await dialog.getByRole("textbox", { name: /Descrição/ }).fill(description);
    await dialog.getByRole("button", { name: "Cadastrar critério" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(description)).toBeVisible();
}

async function selectStudy(page: Page, title: string) {
    await page.getByLabel("Estudo clínico").selectOption({ label: title });
}

test.describe("fluxo completo da Release 1", () => {
    test("configura o estudo, abre o recrutamento e inclui um participante", async ({
        page,
        browser,
    }) => {
        test.slow();
        // Título e nome únicos: o banco da stack é compartilhado pelos testes de uma execução.
        const suffix = Date.now();
        const title = `Estudo E2E do fluxo completo ${suffix}`;
        const candidate = `Candidata E2E ${suffix}`;
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
            await page.getByRole("button", { name: "Nova visita" }).click();
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
            await page.getByRole("button", { name: "Abrir recrutamento" }).click();
            const dialog = page.getByRole("dialog", { name: "Abrir recrutamento" });
            await dialog.getByRole("button", { name: "Abrir recrutamento" }).click();
            await expect(dialog).toBeHidden();
            await expect(page.getByText("Recrutamento").first()).toBeVisible();
            await expect(page.getByRole("button", { name: "Iniciar execução" })).toBeVisible();
        });

        // O coordenador usa outro contexto, sem a sessão nem o armazenamento do pesquisador.
        const coordinatorContext = await browser.newContext();
        const coordinator = await coordinatorContext.newPage();

        await test.step("coordenador cadastra o candidato", async () => {
            await submitLogin(coordinator, accounts.coordinator, DEMO_PASSWORD);
            await expect(coordinator).toHaveURL(/\/recrutamento$/);
            await selectStudy(coordinator, title);
            await expect(coordinator.getByText("Nenhum candidato encontrado")).toBeVisible();

            await coordinator.getByRole("button", { name: "Novo candidato" }).click();
            const dialog = coordinator.getByRole("dialog", { name: "Novo candidato" });
            await dialog.getByLabel("Identificação do candidato").fill(candidate);
            await dialog.getByLabel("Idade").fill("34");
            await dialog.getByRole("button", { name: "Cadastrar candidato" }).click();
            await expect(coordinator.getByText("Candidato cadastrado com sucesso.")).toBeVisible();
            await expect(coordinator.getByText(candidate)).toBeVisible();
        });

        await test.step("coordenador avalia a elegibilidade", async () => {
            await coordinator
                .getByRole("button", { name: `Avaliar elegibilidade: ${candidate}` })
                .click();
            await coordinator.getByLabel(INCLUSION_CRITERION).selectOption("true");
            await coordinator.getByLabel(EXCLUSION_CRITERION).selectOption("false");
            await coordinator.getByRole("button", { name: "Salvar avaliação" }).click();
            await expect(
                coordinator.getByText("Avaliação de elegibilidade registrada com sucesso.")
            ).toBeVisible();
            await coordinator.getByRole("button", { name: "Voltar para candidatos" }).click();
            await expect(coordinator.getByText("Elegível").first()).toBeVisible();
        });

        await test.step("coordenador registra o consentimento simulado", async () => {
            await coordinator
                .getByRole("button", { name: `Consentimento simulado: ${candidate}` })
                .click();
            await coordinator.getByLabel("Decisão do consentimento").selectOption("GRANTED");
            await coordinator.getByRole("button", { name: "Salvar consentimento" }).click();
            await expect(
                coordinator.getByText("Consentimento simulado registrado com sucesso.")
            ).toBeVisible();
            await coordinator.getByRole("button", { name: "Voltar para candidatos" }).click();
        });

        await test.step("coordenador inclui o participante", async () => {
            await coordinator
                .getByRole("button", { name: `Incluir participante: ${candidate}` })
                .click();
            const dialog = coordinator.getByRole("dialog", {
                name: "Confirmar inclusão de participante",
            });
            await dialog.getByRole("button", { name: "Confirmar inclusão" }).click();
            await expect(dialog).toBeHidden();
            await expect(
                coordinator.getByText("Participante incluído no estudo com sucesso.")
            ).toBeVisible();
        });

        await test.step("a tela mostra o participante e o contador de vagas", async () => {
            await expectParticipantAndVacancies(coordinator, candidate);
        });

        await test.step("os dados persistem no backend", async () => {
            // Novo contexto, sem cache local: tudo o que aparece veio da API e do banco.
            const freshContext = await browser.newContext();
            const fresh = await freshContext.newPage();
            await submitLogin(fresh, accounts.coordinator, DEMO_PASSWORD);
            await expect(fresh).toHaveURL(/\/recrutamento$/);
            await selectStudy(fresh, title);
            await expectParticipantAndVacancies(fresh, candidate);
            await freshContext.close();

            await page.reload();
            await expect(page.getByRole("button", { name: "Iniciar execução" })).toBeVisible();
            await page.getByRole("tab", { name: "Critérios" }).click();
            await expect(page.getByText(INCLUSION_CRITERION)).toBeVisible();
            await expect(page.getByText(EXCLUSION_CRITERION)).toBeVisible();
            await page.getByRole("tab", { name: "Visitas previstas" }).click();
            await expect(page.getByRole("heading", { name: VISIT_NAME })).toBeVisible();
        });

        await coordinatorContext.close();
    });
});

async function expectParticipantAndVacancies(page: Page, candidate: string) {
    const participants = page.getByRole("grid", { name: "Lista de participantes incluídos" });
    await expect(participants.getByText(candidate)).toBeVisible();
    const vacancies = page.getByRole("status", { name: "Indicador de vagas do estudo" });
    await expect(vacancies).toContainText(`1 de ${PARTICIPANT_LIMIT}`);
    await expect(vacancies).toContainText("1 vaga");
}
