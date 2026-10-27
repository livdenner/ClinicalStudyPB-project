import { expect, test } from "@playwright/test";

test("a aplicação carrega com o layout base", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("ClinicalStudyPB");
    await expect(page.getByRole("banner")).toContainText("ClinicalStudyPB");
    await expect(page.getByRole("main")).toBeVisible();
});
