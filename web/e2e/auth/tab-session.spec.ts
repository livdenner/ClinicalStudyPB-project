import { expect, test } from "@playwright/test";
import { accounts, DEMO_PASSWORD, submitLogin } from "../support/auth";

const chave = "clinicalstudypb.auth.session";

test("T24.5 — Perfis por aba: login e logout não substituem a outra sessão no mesmo contexto", async ({
    page: admin,
    context,
}) => {
    await submitLogin(admin, accounts.administrator, DEMO_PASSWORD);
    await expect(admin).toHaveURL(/\/usuarios$/);
    await expect(admin.getByRole("heading", { name: "Usuários e acessos" })).toBeVisible();

    // As abas compartilham localStorage; cada uma deve manter sua própria sessão.
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

test("T24.5 — Expiração por aba: o redirecionamento preserva a outra sessão", async ({
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

test("T24.5 — Perfis distintos: dois contextos continuam operando após logout em um deles", async ({
    page: admin,
    browser,
    baseURL,
}) => {
    const contextoCoordenador = await browser.newContext({ baseURL });
    const coordenador = await contextoCoordenador.newPage();
    try {
        await Promise.all([
            submitLogin(admin, accounts.administrator, DEMO_PASSWORD),
            submitLogin(coordenador, accounts.coordinator, DEMO_PASSWORD),
        ]);
        await expect(admin).toHaveURL(/\/usuarios$/);
        await expect(coordenador).toHaveURL(/\/recrutamento$/);
        await Promise.all([admin.reload(), coordenador.reload()]);

        for (const [aba, perfil, titulo] of [
            [admin, "ADMINISTRATOR", "Usuários e acessos"],
            [coordenador, "COORDINATOR", "Candidatos e recrutamento"],
        ] as const) {
            await expect(aba.getByRole("heading", { name: titulo })).toBeVisible();
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
        const consulta = coordenador.waitForResponse(
            (response) =>
                new URL(response.url()).pathname === "/api/studies" &&
                response.request().method() === "GET"
        );
        await coordenador.goto("/estudos");
        expect((await consulta).status()).toBe(200);
        await expect(coordenador.getByRole("heading", { name: "Estudos clínicos" })).toBeVisible();
        expect(await admin.evaluate((key) => sessionStorage.getItem(key), chave)).toBeNull();
    } finally {
        await contextoCoordenador.close();
    }
});
