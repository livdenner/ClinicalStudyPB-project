import { expect, test, type Page } from "@playwright/test";
import type { CandidatoApi } from "../../src/types/candidato";

const titulos = [
    "Estudo do sono",
    "Acompanhamento da qualidade de vida de adultos com hipertensão e outras condições crônicas",
    "IdentificadorSemEspacos".repeat(5),
];
const nomes = [
    "Ana Silva",
    "Maria do Socorro Almeida de Albuquerque e Silva",
    "NomeSemEspacos".repeat(8),
];
const estudos = titulos.map((title, i) => ({
    id: 11 + i,
    title,
    objective: "Avaliar hábitos e qualidade de vida.",
    responsibleUserId: 7,
    status: i === 0 ? "RECRUITMENT" : i === 1 ? "PLANNING" : "CLOSED",
    participantLimit: 25,
    startDate: "2026-11-01",
    endDate: "2027-03-31",
    version: 0,
}));
const candidatos = nomes.map((name, i): CandidatoApi => ({
    id: 101 + i,
    studyId: 11,
    userId: 301 + i,
    name,
    age: 42 + i,
    email: `candidato${i}@example.test`,
    phone: "(83) 99999-0001",
    status: i === 0 ? "INCLUDED" : i === 1 ? "GRANTED" : "CONSENT_PENDING",
    eligibilityStatus: i === 2 ? "INELIGIBLE" : "ELIGIBLE",
    consentStatus: i === 2 ? "PENDING" : "GRANTED",
}));
const participantes = nomes.map((candidateName, i) => ({
    id: 201 + i,
    studyId: 11,
    candidateId: i === 0 ? 101 : 110 + i,
    candidateName,
    includedAt: "2026-11-09T12:00:00Z",
    status: i === 2 ? "WITHDRAWN" : "ACTIVE",
}));

async function preparar(page: Page, role: "RESEARCHER" | "COORDINATOR") {
    await page.addInitScript(
        (perfil) =>
            sessionStorage.setItem(
                "clinicalstudypb.auth.session",
                JSON.stringify({
                    accessToken: "layout-fixture",
                    tokenType: "Bearer",
                    expiresAt: Date.now() + 3600000,
                    user: {
                        id: 7,
                        role: perfil,
                        name: "Pesquisador Demo",
                        email: "demo@example.test",
                        active: true,
                    },
                })
            ),
        role
    );
    await page.route("**/api/**", (route) => {
        const url = new URL(route.request().url()).pathname;
        let dados: unknown;
        if (url === "/api/studies") dados = estudos;
        else if (url === "/api/studies/11") dados = estudos[0];
        else if (url.endsWith("/participants")) dados = participantes;
        else if (url.endsWith("/candidates")) dados = candidatos;
        else dados = [];
        return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(dados),
        });
    });
}

async function conferirGrade(page: Page, nome: string, largura: number) {
    const lista = page.getByRole("list", { name: nome, exact: true });
    await expect(lista.getByRole("article")).toHaveCount(3);
    const medidas = await lista.locator(".card-padrao").evaluateAll((cards) =>
        cards.map((card) => {
            const box = card.getBoundingClientRect();
            const footer = card.querySelector(".card-padrao__acoes")?.getBoundingClientRect();
            return {
                x: box.x,
                right: box.right,
                height: box.height,
                footerY: footer?.y,
                footerBottom: footer ? box.bottom - footer.bottom : null,
            };
        })
    );
    const alturas = medidas.map((item) => item.height);
    expect(Math.max(...alturas) - Math.min(...alturas)).toBeLessThanOrEqual(1);
    const colunas = new Set(medidas.map((item) => Math.round(item.x)));
    if (largura === 375) expect(colunas.size).toBe(1);
    else expect(colunas.size).toBeGreaterThan(1);
    for (const medida of medidas) {
        expect(medida.x).toBeGreaterThanOrEqual(0);
        expect(medida.right).toBeLessThanOrEqual(largura + 1);
    }
    const rodapes = medidas.filter((item) => item.footerBottom !== null);
    if (rodapes.length) {
        expect(
            Math.max(...rodapes.map((item) => item.footerBottom!)) -
                Math.min(...rodapes.map((item) => item.footerBottom!))
        ).toBeLessThanOrEqual(1);
        if (largura === 1366)
            expect(
                Math.max(...rodapes.map((item) => item.footerY!)) -
                    Math.min(...rodapes.map((item) => item.footerY!))
            ).toBeLessThanOrEqual(1);
    }
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
}

for (const largura of [1366, 375]) {
    test(`T24.3: estudos com nomes curtos e extensos ficam alinhados em ${largura}px`, async ({
        page,
    }, testInfo) => {
        await page.setViewportSize({ width: largura, height: 900 });
        await preparar(page, "RESEARCHER");
        await page.goto("/estudos");
        await conferirGrade(page, "Lista de estudos clínicos", largura);
        await expect(
            page.getByRole("link", { name: `Visualizar estudo: ${titulos[0]}` })
        ).toBeVisible();
        await page.screenshot({
            path: testInfo.outputPath(`estudos-${largura}.png`),
            fullPage: true,
            animations: "disabled",
        });
        await page.getByRole("link", { name: `Visualizar estudo: ${titulos[0]}` }).click();
        await expect(page.getByRole("heading", { name: titulos[0], exact: true })).toBeVisible();
    });

    test(`T24.3: candidatos e participantes ficam alinhados em ${largura}px`, async ({
        page,
    }, testInfo) => {
        await page.setViewportSize({ width: largura, height: 900 });
        await preparar(page, "COORDINATOR");
        await page.goto("/recrutamento");
        await conferirGrade(page, "Lista de candidatos", largura);
        await conferirGrade(page, "Lista de participantes incluídos", largura);
        await expect(
            page.getByRole("button", { name: `Incluir participante: ${nomes[1]}` })
        ).toBeEnabled();
        await expect(
            page.getByRole("button", { name: `Incluir participante: ${nomes[2]}` })
        ).toHaveCount(0);
        await expect(page.getByRole("button", { name: /consentimento/i })).toHaveCount(0);
        const candidatosNaTela = page.getByRole("list", {
            name: "Lista de candidatos",
            exact: true,
        });
        await expect(candidatosNaTela.getByText("Incluído", { exact: true })).toBeVisible();
        await expect(
            candidatosNaTela.getByText("Aguardando decisão", { exact: true })
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: `Cancelar candidatura: ${nomes[1]}` })
        ).toBeEnabled();
        await page.screenshot({
            path: testInfo.outputPath(`recrutamento-${largura}.png`),
            fullPage: true,
            animations: "disabled",
        });
        if (largura === 375) {
            const abrir = page.getByRole("button", { name: "Abrir menu de navegação" });
            await abrir.click();
            const menu = page.getByRole("dialog", { name: "Menu de navegação" });
            await expect(menu).toBeVisible();
            await page.keyboard.press("Tab");
            expect(await menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
            await page.keyboard.press("Escape");
            await expect(menu).toBeHidden();
            await expect(abrir).toBeFocused();
        }
    });

    test(`T24.3: aba de participantes adapta a listagem em ${largura}px`, async ({
        page,
    }, testInfo) => {
        await page.setViewportSize({ width: largura, height: 900 });
        await preparar(page, "RESEARCHER");
        await page.goto("/estudos/11");
        await page.getByRole("tab", { name: "Participantes", exact: true }).click();
        const tabela = page.getByRole("grid", { name: "Participantes do estudo" });
        const cards = page.getByRole("list", { name: "Participantes do estudo", exact: true });
        if (largura === 375) {
            await conferirGrade(page, "Participantes do estudo", largura);
            await expect(tabela).toHaveCount(0);
        } else {
            await expect(tabela).toBeVisible();
            await expect(tabela.getByRole("rowheader")).toHaveCount(3);
            await expect(cards).toHaveCount(0);
            await expect(
                tabela.getByRole("rowheader", { name: nomes[2], exact: true })
            ).toBeVisible();
            expect(await tabela.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
            ).toBe(true);
        }
        await expect(page.getByText("Retirado", { exact: true })).toBeVisible();
        await page.screenshot({
            path: testInfo.outputPath(`participantes-${largura}.png`),
            fullPage: true,
            animations: "disabled",
        });
        await page.setViewportSize({ width: largura === 375 ? 1366 : 375, height: 900 });
        if (largura === 375) {
            await expect(tabela).toBeVisible();
            await expect(cards).toHaveCount(0);
        } else {
            await conferirGrade(page, "Participantes do estudo", 375);
            await expect(tabela).toHaveCount(0);
        }
    });
}
