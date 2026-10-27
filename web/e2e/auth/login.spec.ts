import { expect, test } from "@playwright/test";
import { mockLogin, validCredentials } from "../support/api-mocks";

/**
 * Fluxo de login.
 *
 * PENDENTE: a tela de login ainda não existe no front (nenhuma branch a implementa).
 * Estes testes definem o contrato esperado da tela, usando seletores acessíveis:
 *   - rota `/login`
 *   - campos com label "E-mail" e "Senha"
 *   - botão "Entrar"
 *   - após sucesso, redireciona para `/estudos`
 *   - em falha, exibe a mensagem retornada pela API em um elemento `role="alert"`
 * Quando a tela for criada seguindo esse contrato, troque `describe.fixme` por `describe`.
 */
test.describe.fixme("login", () => {
    test.beforeEach(async ({ page }) => {
        await mockLogin(page);
        await page.goto("/login");
    });

    test("autentica com credenciais válidas e redireciona", async ({ page }) => {
        await page.getByLabel("E-mail").fill(validCredentials.email);
        await page.getByLabel("Senha").fill(validCredentials.password);
        await page.getByRole("button", { name: "Entrar" }).click();

        await expect(page).toHaveURL(/\/estudos$/);
    });

    test("exibe erro com credenciais inválidas", async ({ page }) => {
        await page.getByLabel("E-mail").fill(validCredentials.email);
        await page.getByLabel("Senha").fill("senha-errada");
        await page.getByRole("button", { name: "Entrar" }).click();

        await expect(page.getByRole("alert")).toContainText("E-mail ou senha inválidos");
        await expect(page).toHaveURL(/\/login$/);
    });
});
