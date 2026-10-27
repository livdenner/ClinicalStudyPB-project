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
    },
});
