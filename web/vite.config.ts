import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        proxy: {
            "/api": {
                target: "http://localhost:8080",
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
