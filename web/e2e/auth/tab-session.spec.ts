import { expect, test } from "@playwright/test";
import { accounts, DEMO_PASSWORD, submitLogin } from "../support/auth";

const chave = "clinicalstudypb.auth.session";

test("T24.4: admin e coordenador operam em abas do mesmo navegador; logout é isolado", async ({
    page: admin,
    context,
}) => {
    await submitLogin(admin, accounts.administrator, DEMO_PASSWORD);
    await expect(admin).toHaveURL(/\/usuarios$/);
    await expect(admin.getByRole("heading", { name: "Usuários e acessos" })).toBeVisible();

    // aqui abre uma segunda aba para o coordenador, que compartilha a sessão do administrador
    const coordenador = await context.newPage();
    try {
        await coordenador.goto("/recrutamento");
        await expect(coordenador).toHaveURL(/\/login$/);
        await submitLogin(coordenador, accounts.coordinator, DEMO_PASSWORD);
        await expect(coordenador).toHaveURL(/\/recrutamento$/);
        await expect(
            coordenador.getByRole("heading", { name: "Candidatos e recrutamento" })
        ).toBeVisible();

        await admin.reload();
        await coordenador.reload();
        await expect(admin.getByRole("heading", { name: "Usuários e acessos" })).toBeVisible();
        await expect(
            coordenador.getByRole("heading", { name: "Candidatos e recrutamento" })
        ).toBeVisible();
        for (const [aba, perfil] of [
            [admin, "ADMINISTRATOR"],
            [coordenador, "COORDINATOR"],
        ] as const) {
            expect(
                await aba.evaluate(
                    (key) => JSON.parse(sessionStorage.getItem(key)!).user.role,
                    chave
                )
            ).toBe(perfil);
            expect(await aba.evaluate((key) => localStorage.getItem(key), chave)).toBeNull();
        }

        await admin.getByRole("button", { name: "Sair", exact: true }).click();
        await expect(admin).toHaveURL(/\/login$/);
        await coordenador.reload();
        await expect(
            coordenador.getByRole("heading", { name: "Candidatos e recrutamento" })
        ).toBeVisible();
        await admin.goto("/usuarios");
        await expect(admin).toHaveURL(/\/login$/);
    } finally {
        await coordenador.close();
    }
});

test("T24.4: expiração e redirecionamento de uma aba preservam a outra", async ({
    page: admin,
    context,
}) => {
    await submitLogin(admin, accounts.administrator, DEMO_PASSWORD);
    await expect(admin).toHaveURL(/\/usuarios$/);
    const coordenador = await context.newPage();
    try {
        await submitLogin(coordenador, accounts.coordinator, DEMO_PASSWORD);
        await expect(coordenador).toHaveURL(/\/recrutamento$/);
        // Antecipa só o prazo desta aba; um relógio de contexto afetaria ambas as páginas.
        await admin.evaluate((key) => {
            const sessao = JSON.parse(sessionStorage.getItem(key)!);
            sessao.expiresAt = Date.now() + 2000;
            sessionStorage.setItem(key, JSON.stringify(sessao));
        }, chave);
        await admin.reload();
        await expect(admin).toHaveURL(/\/login$/);
        expect(await admin.evaluate((key) => sessionStorage.getItem(key), chave)).toBeNull();
        await coordenador.reload();
        await expect(
            coordenador.getByRole("heading", { name: "Candidatos e recrutamento" })
        ).toBeVisible();
        expect(
            await coordenador.evaluate(
                (key) => JSON.parse(sessionStorage.getItem(key)!).user.role,
                chave
            )
        ).toBe("COORDINATOR");
    } finally {
        await coordenador.close();
    }
});
