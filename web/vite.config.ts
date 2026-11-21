import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        proxy: {
            "/api": {
                // O E2E aponta para a stack de teste (compose.e2e.yaml) com API_PROXY_TARGET.
                target: process.env.API_PROXY_TARGET ?? "http://localhost:8080",
                changeOrigin: true,
            },
        },
    },
    test: {
        // Os testes E2E (Playwright) rodam com `npm run test:e2e`, não com o Vitest.
        exclude: [...configDefaults.exclude, "e2e/**"],
        environment: "jsdom",
        setupFiles: "./src/setupTests.ts",
        globals: true,
        // Testes de tela com popovers do HeroUI passam de 5 s quando a suíte roda em paralelo.
        testTimeout: 15_000,
        // O JSON alimenta o relatório de execução dos testes (scripts/relatorio-testes, T25.1).
        reporters: ["default", "json"],
        outputFile: { json: "test-reports/vitest.json" },
        coverage: {
            thresholds: {
                // Na descrição da task que tá no azure, diz que T22.4 exige mais de 80% em cada componente novo da retirada
                "src/components/participantes/*Retirada.tsx": {
                    perFile: true,
                    lines: 81,
                    statements: 81,
                    functions: 81,
                    branches: 81,
                },
            },
        },
    },
});
