import { expect, test } from "@playwright/test";

const estudo = {
    id: 10,
    title: "Estudo do sono",
    objective: "Avaliar hábitos de sono",
    status: "RECRUITMENT",
    responsibleUserId: 7,
    participantLimit: 2,
    startDate: "2026-11-01",
    endDate: "2027-03-31",
    version: 0,
};
const ativo = {
    id: 501,
    studyId: 10,
    candidateId: 101,
    candidateName: "Ana Silva",
    includedAt: "2026-11-09T12:00:00Z",
    status: "ACTIVE",
};
const retirado = {
    ...ativo,
    id: 502,
    candidateId: 102,
    candidateName: "Bruno Costa",
    status: "WITHDRAWN",
};

for (const contexto of [
    { tela: "recrutamento", largura: 1366, caminho: "/recrutamento" },
    { tela: "participantes do estudo", largura: 1366, caminho: "/estudos/10" },
    { tela: "participantes do estudo", largura: 375, caminho: "/estudos/10" },
]) {
    test(`T22.3: registra retirada em ${contexto.tela} sem liberar vaga (${contexto.largura}px)`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: contexto.largura, height: 900 });
        await page.addInitScript(() =>
            sessionStorage.setItem(
                "clinicalstudypb.auth.session",
                JSON.stringify({
                    accessToken: "fixture-retirada",
                    tokenType: "Bearer",
                    expiresAt: Date.now() + 3600000,
                    user: {
                        id: 9,
                        role: "COORDINATOR",
                        name: "Coordenador Demo",
                        email: "coordenador@example.test",
                        active: true,
                    },
                })
            )
        );
        let atualizado = ativo;
        let consultasParticipantes = 0;
        let retiradas = 0;
        await page.route("**/api/**", async (route) => {
            const path = new URL(route.request().url()).pathname;
            if (path === "/api/studies/10/participants/501/withdrawal") {
                expect(route.request().method()).toBe("POST");
                expect(route.request().postDataJSON()).toEqual({ reason: "Desistência" });
                retiradas += 1;
                atualizado = { ...ativo, status: "WITHDRAWN" };
                return route.fulfill({
                    json: {
                        ...atualizado,
                        withdrawal: {
                            reason: "Desistência",
                            withdrawnAt: "2026-11-19T12:00:00Z",
                            withdrawnByUserId: 9,
                            cancelledVisitCount: 2,
                        },
                    },
                });
            }
            let json: unknown = [];
            if (path === "/api/studies") json = [estudo];
            else if (path === "/api/studies/10") json = estudo;
            else if (path === "/api/studies/10/participants") {
                consultasParticipantes += 1;
                json = [atualizado, retirado];
            } else if (path === "/api/studies/10/candidates")
                json = [
                    {
                        id: 101,
                        studyId: 10,
                        name: "Ana Silva",
                        age: 42,
                        eligibilityStatus: "ELIGIBLE",
                        consentStatus: "GRANTED",
                    },
                ];
            else if (path.endsWith("/consent"))
                json = { studyId: 10, candidateId: 101, status: "GRANTED" };
            return route.fulfill({ json });
        });
        await page.goto(contexto.caminho);
        if (contexto.caminho.startsWith("/estudos"))
            await page.getByRole("tab", { name: "Participantes", exact: true }).click();
        const acao = page.getByRole("button", { name: "Registrar retirada: Ana Silva" });
        await expect(acao).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Registrar retirada: Bruno Costa" })
        ).toHaveCount(0);
        const consultasAntes = consultasParticipantes;
        await acao.click();
        const modal = page.getByRole("dialog", { name: "Registrar retirada" });
        await expect(modal).toBeVisible();
        await expect(modal.getByRole("textbox", { name: "Motivo da retirada" })).toBeFocused();
        await modal.getByRole("button", { name: "Confirmar retirada" }).click();
        await expect(
            modal.getByText("Informe o motivo da retirada com 1 a 500 caracteres.")
        ).toBeVisible();
        expect(retiradas).toBe(0);
        await modal.getByRole("textbox", { name: "Motivo da retirada" }).fill("  Desistência  ");
        await modal.getByRole("button", { name: "Confirmar retirada" }).click();
        await expect(modal).toHaveCount(0);
        await expect(acao).toHaveCount(0);
        await expect(page.getByText("Retirado", { exact: true })).toHaveCount(2);
        await expect(
            page.getByText("Retirada registrada com sucesso.", { exact: true })
        ).toBeVisible();
        if (contexto.caminho.startsWith("/estudos") && contexto.largura === 1366) {
            const tabela = page.getByRole("grid", { name: "Participantes do estudo" });
            expect(await tabela.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        }
        expect(retiradas).toBe(1);
        const listaParticipantes = page.getByRole("list", {
            name:
                contexto.caminho === "/recrutamento"
                    ? "Lista de participantes incluídos"
                    : "Participantes do estudo",
            exact: true,
        });
        await expect(listaParticipantes.locator(".card-padrao__acoes")).toHaveCount(0);
        expect(consultasParticipantes).toBe(consultasAntes);
        if (contexto.caminho === "/recrutamento") {
            await expect(
                page.getByRole("status", { name: "Indicador de vagas do estudo" })
            ).toContainText("2 de 2");
            await expect(
                page.getByRole("status", { name: "Indicador de vagas do estudo" })
            ).toContainText("0 vagas");
            await expect(
                page.getByRole("button", { name: "Incluir participante: Ana Silva" })
            ).toHaveCount(0);
        }
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
        ).toBe(true);
    });
}
