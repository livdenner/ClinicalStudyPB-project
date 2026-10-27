import type { Page } from "@playwright/test";

/**
 * Dados e interceptações da API baseados no contrato `backend/openapi.yaml`.
 * Os testes E2E rodam contra o front real, com a API simulada na camada de rede,
 * para não depender de banco nem do backend. Se o contrato mudar, atualize aqui.
 */

export const researcher = {
    id: 1,
    name: "Pesquisador Demo",
    email: "pesquisador@clinicalstudypb.test",
    role: "RESEARCHER",
    active: true,
};

export const validCredentials = { email: researcher.email, password: "senha-demo-123" };

export type Study = {
    id: number;
    title: string;
    objective: string;
    responsibleUserId: number;
    startDate: string;
    endDate: string;
    participantLimit: number;
};

/** Simula POST /auth/login: aceita apenas `validCredentials`. */
export async function mockLogin(page: Page) {
    await page.route("**/auth/login", async (route) => {
        const body = route.request().postDataJSON() as { email?: string; password?: string };
        if (body.email === validCredentials.email && body.password === validCredentials.password) {
            await route.fulfill({
                status: 200,
                json: {
                    accessToken: "token-e2e",
                    tokenType: "Bearer",
                    expiresIn: 3600,
                    user: researcher,
                },
            });
            return;
        }
        await route.fulfill({
            status: 401,
            json: { code: "INVALID_CREDENTIALS", message: "E-mail ou senha inválidos" },
        });
    });
}

/** Simula GET/POST /studies mantendo os estudos em memória durante o teste. */
export async function mockStudies(page: Page, initial: Study[] = []) {
    const studies = [...initial];
    await page.route("**/studies", async (route) => {
        const request = route.request();
        if (request.method() === "POST") {
            const created = {
                id: studies.length + 1,
                ...(request.postDataJSON() as Omit<Study, "id">),
            };
            studies.push(created);
            await route.fulfill({ status: 201, json: created });
            return;
        }
        await route.fulfill({ status: 200, json: studies });
    });
    return studies;
}
