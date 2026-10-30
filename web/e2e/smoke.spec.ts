import { expect, test } from "@playwright/test";

test("a aplicação carrega e leva o visitante à tela de login", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("ClinicalStudyPB");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Acesso ao sistema" })).toBeVisible();
});
