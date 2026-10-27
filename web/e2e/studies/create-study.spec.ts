import { expect, test } from "@playwright/test";
import { mockLogin, mockStudies, validCredentials } from "../support/api-mocks";

/**
 * Fluxo de login + cadastro de estudo.
 *
 * PENDENTE: depende de (1) tela de login e (2) tela de estudos integrada à API.
 * Hoje a tela de estudos (branch `feat/3146-studies-web`) usa dados fictícios e
 * ainda não está em `development`. Os seletores abaixo seguem essa tela:
 * botão "Novo estudo", diálogo "Novo estudo", campos "Nome do estudo", "Responsável",
 * "Limite de participantes" e botão "Cadastrar estudo".
 * Quando as duas telas existirem, troque `describe.fixme` por `describe` e
 * complete o preenchimento das datas conforme o componente de data adotado.
 */
test.describe.fixme("cadastro de estudo", () => {
    test("pesquisador faz login e cadastra um estudo", async ({ page }) => {
        await mockLogin(page);
        await mockStudies(page);

        await page.goto("/login");
        await page.getByLabel("E-mail").fill(validCredentials.email);
        await page.getByLabel("Senha").fill(validCredentials.password);
        await page.getByRole("button", { name: "Entrar" }).click();
        await expect(page).toHaveURL(/\/estudos$/);

        await page.getByRole("button", { name: "Novo estudo" }).click();
        const dialog = page.getByRole("dialog", { name: "Novo estudo" });
        await dialog.getByLabel("Nome do estudo").fill("Estudo E2E de hipertensão");
        await dialog.getByLabel("Responsável").fill("Pesquisador Demo");
        await dialog.getByLabel("Limite de participantes").fill("50");
        // TODO: preencher "Data de início" e "Data de término" (componente de data da tela).
        await dialog.getByRole("button", { name: "Cadastrar estudo" }).click();

        await expect(dialog).toBeHidden();
        await expect(page.getByText("Estudo E2E de hipertensão")).toBeVisible();
    });

    test("valida campos obrigatórios", async ({ page }) => {
        await mockStudies(page);
        await page.goto("/estudos");

        await page.getByRole("button", { name: "Novo estudo" }).click();
        await page
            .getByRole("dialog", { name: "Novo estudo" })
            .getByRole("button", { name: "Cadastrar estudo" })
            .click();

        await expect(page.getByText("Preencha todos os campos obrigatórios.")).toBeVisible();
    });
});
