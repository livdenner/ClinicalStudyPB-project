import { defineConfig, devices } from "@playwright/test";

/**
 * Os testes E2E rodam no navegador contra o backend e o banco reais da stack de teste
 * (compose.e2e.yaml), suba-a antes com `npm run e2e:stack:up`. A web é servida já
 * compilada (`vite preview`), com o proxy de /api apontando para essa stack.
 */
const PORT = 4173;
const baseURL = `http://localhost:${PORT}`;
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:18080";

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI
        ? [["github"], ["html", { open: "never" }]]
        : [["list"], ["html", { open: "never" }]],
    use: {
        baseURL,
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        locale: "pt-BR",
        timezoneId: "America/Fortaleza",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: {
        command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
        url: baseURL,
        env: { API_PROXY_TARGET: apiTarget },
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
});
