import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect as baseExpect, test, type Page, type TestInfo } from "@playwright/test";
import { accounts, DEMO_PASSWORD, submitLogin } from "../support/auth";
import {
    createRecruitingStudyWithGrantedCandidate,
    includeAndSchedule,
    scheduledVisits,
    VISIT_NAME,
    type RecruitingStudy,
} from "../support/reference-flow-api";

/**
 * Fluxo de referência do enunciado (T19.5), contra a API e o PostgreSQL reais, sem
 * interceptar respostas: a partir de um estudo em recrutamento com candidato que aceitou o
 * termo, o coordenador inclui o participante, agenda a visita e registra que ela foi realizada.
 * O cenário negativo tenta agendar a mesma visita duas vezes.
 *
 * O estado inicial é montado pela API (support/reference-flow-api.ts), sem depender do E2E do
 * PBI-17. Cada passo gera uma captura anexada ao relatório; com E2E_EVIDENCE_DIR definida, as
 * capturas também são gravadas nessa pasta como evidência da release.
 */

// Fluxo com várias gravações e animações de modal: 5 s (padrão) é pouco em máquinas lentas.
const expect = baseExpect.configure({ timeout: 15_000 });

// Dentro do período do estudo criado pela API (01/02/2027 a 31/07/2027), no horário de Fortaleza.
const SCHEDULED_AT_LOCAL = "2027-02-20T09:00";
const SCHEDULED_AT_UTC = "2027-02-20T12:00:00Z";

async function capture(page: Page, testInfo: TestInfo, name: string) {
    const body = await page.screenshot({ fullPage: true });
    await testInfo.attach(name, { body, contentType: "image/png" });
    const dir = process.env.E2E_EVIDENCE_DIR;
    if (dir) {
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, `${name}.png`), body);
    }
}

async function openRecruitment(page: Page, studyId: number) {
    await submitLogin(page, accounts.coordinator, DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/recrutamento$/);
    await page.goto(`/recrutamento?studyId=${studyId}`);
    await expect(page.getByRole("button", { name: "Novo candidato" })).toBeEnabled();
}

function candidateRow(page: Page, name: string) {
    return page.getByRole("row").filter({ hasText: name });
}

/** A partir do painel de participantes do recrutamento, abre a agenda já com o agendamento. */
async function openScheduling(page: Page, study: RecruitingStudy) {
    await page.getByRole("button", { name: `Agendar visita: ${study.candidateName}` }).click();
    await expect(
        page.getByRole("heading", { level: 1, name: `Visitas de ${study.candidateName}` })
    ).toBeVisible();
    const dialog = page.getByRole("dialog", { name: "Agendar visita" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/^Visita prevista/).selectOption({ label: VISIT_NAME });
    await dialog.getByLabel(/^Data e hora/).fill(SCHEDULED_AT_LOCAL);
    return dialog;
}

test.describe("fluxo de referência: incluir, agendar e registrar desfecho", () => {
    test("coordenador inclui o participante, agenda a visita e registra que foi realizada", async ({
        page,
        request,
    }, testInfo) => {
        test.slow();
        let study: RecruitingStudy | undefined;

        await test.step("estudo em recrutamento com candidato que aceitou (API)", async () => {
            study = await createRecruitingStudyWithGrantedCandidate(request, "realizada");
        });
        if (!study) throw new Error("O estado inicial do fluxo não foi criado.");
        const ready = study;

        await test.step("coordenador inclui o participante", async () => {
            await openRecruitment(page, ready.studyId);
            await expect(candidateRow(page, ready.candidateName)).toContainText("Aceitou");
            await capture(page, testInfo, "01-candidato-aceitou");

            await page
                .getByRole("button", { name: `Incluir participante: ${ready.candidateName}` })
                .click();
            const dialog = page.getByRole("dialog", { name: "Confirmar inclusão de participante" });
            await dialog.getByRole("button", { name: "Confirmar inclusão" }).click();
            await expect(dialog).toBeHidden();
            await expect(
                page.getByText("Participante incluído no estudo com sucesso.")
            ).toBeVisible();
            const participants = page.getByRole("grid", {
                name: "Lista de participantes incluídos",
            });
            await expect(participants.getByText(ready.candidateName)).toBeVisible();
            await capture(page, testInfo, "02-participante-incluido");
        });

        await test.step("coordenador agenda a visita prevista", async () => {
            const dialog = await openScheduling(page, ready);
            await capture(page, testInfo, "03-agendamento-preenchido");
            await dialog.getByRole("button", { name: "Agendar visita" }).click();
            await expect(dialog).toBeHidden();
            await expect(
                page.getByText(`Visita ${VISIT_NAME} agendada com sucesso.`)
            ).toBeVisible();
            const agenda = page.getByRole("region", { name: "Agenda do participante" });
            await expect(agenda.getByRole("row").filter({ hasText: VISIT_NAME })).toContainText(
                "Agendada"
            );
            await capture(page, testInfo, "04-visita-agendada");
        });

        await test.step("coordenador registra a visita como realizada", async () => {
            await page.goto(`/visitas?studyId=${ready.studyId}`);
            const row = page.getByRole("row").filter({ hasText: ready.candidateName });
            await expect(row).toContainText("Agendada");
            await page
                .getByRole("button", {
                    name: `Realizada: ${VISIT_NAME} — ${ready.candidateName}`,
                })
                .click();
            const dialog = page.getByRole("dialog", { name: "Confirmar visita realizada" });
            await capture(page, testInfo, "05-confirmacao-realizada");
            await dialog.getByRole("button", { name: "Confirmar realizada" }).click();
            await expect(dialog).toBeHidden();
            await expect(page.getByText("Desfecho registrado: Realizada.")).toBeVisible();
            await expect(row).toContainText("Realizada");
            await capture(page, testInfo, "06-visita-realizada");
        });

        await test.step("o desfecho persiste no backend", async () => {
            await page.reload();
            const row = page.getByRole("row").filter({ hasText: ready.candidateName });
            await expect(row).toContainText("Realizada");
            await expect(
                page.getByRole("button", {
                    name: `Realizada: ${VISIT_NAME} — ${ready.candidateName}`,
                })
            ).toHaveCount(0);
        });
    });

    test("agendar a mesma visita duas vezes mostra o erro da API", async ({
        page,
        request,
    }, testInfo) => {
        test.slow();
        let study: RecruitingStudy | undefined;
        let participantId = 0;

        await test.step("participante incluído com a visita já agendada (API)", async () => {
            study = await createRecruitingStudyWithGrantedCandidate(request, "duplicada");
            participantId = await includeAndSchedule(request, study, SCHEDULED_AT_UTC);
        });
        if (!study) throw new Error("O estado inicial do fluxo não foi criado.");
        const ready = study;

        await test.step("a segunda tentativa de agendamento é recusada", async () => {
            await openRecruitment(page, ready.studyId);
            const dialog = await openScheduling(page, ready);
            await dialog.getByRole("button", { name: "Agendar visita" }).click();
            await expect(dialog.getByRole("alert")).toContainText(
                "Já existe um agendamento ativo ou concluído desta visita para o participante."
            );
            // O modal continua aberto com os dados, sem criar outro registro.
            await expect(dialog).toBeVisible();
            await expect(dialog.getByLabel(/^Data e hora/)).toHaveValue(SCHEDULED_AT_LOCAL);
            await capture(page, testInfo, "07-agendamento-duplicado");
        });

        await test.step("continua existindo um único agendamento", async () => {
            const visits = await scheduledVisits(request, ready.studyId, participantId);
            expect(visits).toHaveLength(1);
            expect(visits[0]).toMatchObject({ plannedVisitName: VISIT_NAME, status: "SCHEDULED" });
        });
    });
});
