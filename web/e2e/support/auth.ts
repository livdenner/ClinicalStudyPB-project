import { expect, type Page } from "@playwright/test";

/**
 * Contas fictícias criadas por backend/dev/seed_demo_users.sql na stack de teste
 * (compose.e2e.yaml). Todas usam a mesma senha de demonstração do README.
 */
export const DEMO_PASSWORD = "Demo@Clinical2026";

export const accounts = {
    researcher: "pesquisador@clinicalstudypb.test",
    coordinator: "coordenador@clinicalstudypb.test",
    administrator: "administrador@clinicalstudypb.test",
} as const;

/** Preenche e envia o formulário de login a partir da tela /login. */
export async function submitLogin(page: Page, email: string, password: string) {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
}

/** Entra como pesquisador e espera a tela de estudos carregar. */
export async function loginAsResearcher(page: Page) {
    await submitLogin(page, accounts.researcher, DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/estudos$/);
    await expect(page.getByRole("heading", { name: "Estudos clínicos" })).toBeVisible();
}
