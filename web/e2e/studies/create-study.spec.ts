import { expect, test, type Locator } from "@playwright/test";
import { loginAsResearcher } from "../support/auth";

/** Digita uma data (dd/mm/aaaa, locale pt-BR) nos segmentos do campo de data. */
async function fillDate(dialog: Locator, label: string, date: string) {
    await dialog.getByRole("group", { name: label }).getByRole("spinbutton").first().click();
    await dialog.page().keyboard.type(date.replace(/\//g, ""));
}

/** Fluxo de login + cadastro de estudo (RF04, parte do E2E-01) contra o backend real. */
test.describe("cadastro de estudo", () => {
    test.beforeEach(async ({ page }) => {
        await loginAsResearcher(page);
    });

    test("CA-04.1: pesquisador cadastra um estudo e ele persiste na listagem", async ({ page }) => {
        // Título único: o banco da stack é compartilhado pelos testes de uma mesma execução.
        const title = `Estudo E2E de hipertensão ${Date.now()}`;

        await page.getByRole("button", { name: "Novo estudo" }).click();
        const dialog = page.getByRole("dialog", { name: "Novo estudo" });
        await dialog.getByLabel("Nome do estudo").fill(title);
        await dialog.getByLabel("Objetivo").fill("Avaliar a adesão ao tratamento em 6 meses.");
        await fillDate(dialog, "Data de início", "01/02/2027");
        await fillDate(dialog, "Data de término", "31/07/2027");
        await dialog.getByLabel("Limite de participantes").fill("50");
        await dialog.getByRole("button", { name: "Cadastrar estudo" }).click();

        await expect(dialog).toBeHidden();
        await expect(page.getByText("Estudo cadastrado com sucesso.")).toBeVisible();
        const table = page.getByRole("grid", { name: "Lista de estudos clínicos" });
        await expect(table.getByText(title)).toBeVisible();

        // Recarrega para confirmar que o estudo veio do banco, não só do estado da tela.
        await page.reload();
        await expect(table.getByText(title)).toBeVisible();
    });

    test("valida campos obrigatórios antes de enviar", async ({ page }) => {
        await page.getByRole("button", { name: "Novo estudo" }).click();
        const dialog = page.getByRole("dialog", { name: "Novo estudo" });
        await dialog.getByRole("button", { name: "Cadastrar estudo" }).click();

        await expect(dialog.getByText("Informe o nome do estudo.")).toBeVisible();
        await expect(dialog.getByText("Informe o objetivo do estudo.")).toBeVisible();
        await expect(dialog).toBeVisible();
    });
});
