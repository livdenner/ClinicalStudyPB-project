import { expect, test } from "@playwright/test";
import { accounts, DEMO_PASSWORD, loginAsResearcher, submitLogin } from "../support/auth";

/** Fluxo de login (RF02) contra o backend real. */
test.describe("login", () => {
    test("CA-02.1: pesquisador entra com credenciais válidas e vai para estudos", async ({
        page,
    }) => {
        await loginAsResearcher(page);
    });

    test("CA-02.2: senha errada mostra mensagem genérica e mantém na tela de login", async ({
        page,
    }) => {
        await submitLogin(page, accounts.researcher, "senha-errada");

        await expect(page.getByRole("alert")).toContainText("E-mail ou senha inválidos");
        await expect(page).toHaveURL(/\/login$/);
    });

    test("CA-02.2: e-mail inexistente mostra a mesma mensagem genérica", async ({ page }) => {
        await submitLogin(page, "ninguem@clinicalstudypb.test", DEMO_PASSWORD);

        await expect(page.getByRole("alert")).toContainText("E-mail ou senha inválidos");
        await expect(page).toHaveURL(/\/login$/);
    });

    test("rota protegida sem sessão redireciona para o login", async ({ page }) => {
        await page.goto("/estudos");

        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByRole("heading", { name: "Acesso ao sistema" })).toBeVisible();
    });
});
